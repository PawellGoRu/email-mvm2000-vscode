import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Собирает персонализированные .eml из CSV-списка рассылки.
//
// Использование:
//   node scripts/send-campaign.mjs recipients.csv [выходная_папка]
//
// Формат CSV (заголовок обязателен): email,firstName,lastName
// В src/email-responsive.html токены {{firstName}} и {{lastName}}
// подставляются в текст письма; адрес получателя попадает в заголовок To:.
//
// ВАЖНО: SPF/DKIM/DMARC настраиваются на стороне почтового домена и
// SMTP-сервера — этот скрипт только генерирует файлы для отправки.

const projectRoot = resolve(import.meta.dirname, '..');
const htmlPath = resolve(projectRoot, 'src/email-responsive.html');
const csvPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(projectRoot, 'recipients.csv');
const outputDir = process.argv[3]
  ? resolve(process.argv[3])
  : resolve(projectRoot, 'dist/campaign');

const parseCsvLine = (line) => {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
};

const readRecipients = () => {
  const lines = readFileSync(csvPath, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) {
    throw new Error(`CSV ${csvPath} must contain a header row and at least one recipient`);
  }
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = {
    email: header.indexOf('email'),
    firstName: header.indexOf('firstname'),
    lastName: header.indexOf('lastname'),
  };
  for (const [name, pos] of Object.entries(idx)) {
    if (pos === -1) throw new Error(`CSV header must include column "${name}"`);
  }
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const email = cells[idx.email];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Invalid e-mail address in CSV row: "${line}"`);
    }
    return { email, firstName: cells[idx.firstName] ?? '', lastName: cells[idx.lastName] ?? '' };
  });
};

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const wrapBase64 = (value) => Buffer.from(value).toString('base64').match(/.{1,76}/g).join('\r\n');

const sourceHtml = readFileSync(htmlPath, 'utf8');
const bannerMatch = sourceHtml.match(/src="data:image\/jpeg;base64,([^"]+)"/);
if (!bannerMatch) {
  throw new Error(`Embedded data URI image not found in ${htmlPath}`);
}
const banner = Buffer.from(bannerMatch[1], 'base64');
const htmlWithCid = sourceHtml.replace(bannerMatch[0], 'src="cid:powerhv-banner"');
const subjectText = 'Высоковольтные испытательные и измерительные системы PowerHV';

const buildEml = ({ email, firstName, lastName }) => {
  const boundary = `----=_PowerHV_${slugify(email).replace(/-/g, '_')}`;
  const personalized = htmlWithCid
    .replaceAll('{{firstName}}', firstName)
    .replaceAll('{{lastName}}', lastName);
  if (/{{\w+}}/.test(personalized)) {
    throw new Error(`Unresolved personalization token remained for ${email}`);
  }
  const encodedSubject = Buffer.from(subjectText, 'utf8').toString('base64');
  return [
    'From: "МВМ-2000" <mvm-2000@bk.ru>',
    `To: =?UTF-8?B?${Buffer.from(`${firstName} ${lastName}`.trim(), 'utf8').toString('base64')}?= <${email}>`,
    `Subject: =?UTF-8?B?${encodedSubject}?=`,
    // Заголовок отписки обязателен для массовых рассылок; URL подставьте свой.
    'List-Unsubscribe: <https://www.mvm-2000.ru/unsubscribe?email=' + encodeURIComponent(email) + '>',
    'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(personalized),
    '',
    `--${boundary}`,
    'Content-Type: image/jpeg; name="baner600x95_3.jpg"',
    'Content-Transfer-Encoding: base64',
    'Content-ID: <powerhv-banner>',
    'Content-Disposition: inline; filename="baner600x95_3.jpg"',
    '',
    wrapBase64(banner),
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n');
};

const recipients = readRecipients();
mkdirSync(outputDir, { recursive: true });
for (const recipient of recipients) {
  const fileName = `${slugify(recipient.email)}.eml`;
  writeFileSync(resolve(outputDir, fileName), buildEml(recipient), 'utf8');
}
console.log(`Generated ${recipients.length} personalized .eml file(s) in ${outputDir}`);
