import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

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

const parseCsv = (source) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let afterQuote = false;

  const pushField = () => {
    row.push(field.trim());
    field = '';
    afterQuote = false;
  };
  const pushRow = () => {
    pushField();
    if (row.some((cell) => cell !== '')) rows.push(row);
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inQuotes) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
        afterQuote = true;
      } else {
        field += character;
        if (character === '\r' && source[index + 1] === '\n') {
          field += '\n';
          index += 1;
        }
      }
      continue;
    }

    if (afterQuote) {
      if (character === ',') {
        pushField();
      } else if (character === '\r' || character === '\n') {
        pushRow();
        if (character === '\r' && source[index + 1] === '\n') index += 1;
      } else if (character !== ' ' && character !== '\t') {
        throw new Error('CSV contains unexpected characters after a quoted field');
      }
      continue;
    }

    if (character === '"') {
      if (field.trim() !== '') throw new Error('CSV contains a quote inside an unquoted field');
      field = '';
      inQuotes = true;
    } else if (character === ',') {
      pushField();
    } else if (character === '\r' || character === '\n') {
      pushRow();
      if (character === '\r' && source[index + 1] === '\n') index += 1;
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new Error('CSV contains an unclosed quoted field');
  if (field !== '' || row.length > 0 || afterQuote) pushRow();
  return rows;
};

const readRecipients = () => {
  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  if (rows.length < 2) {
    throw new Error(`CSV ${csvPath} must contain a header row and at least one recipient`);
  }
  const [headerRow, ...recipientRows] = rows;
  const header = headerRow.map((name) => name.toLowerCase());
  const idx = {
    email: header.indexOf('email'),
    firstName: header.indexOf('firstname'),
    lastName: header.indexOf('lastname'),
  };
  for (const [name, position] of Object.entries(idx)) {
    if (position === -1) throw new Error(`CSV header must include column "${name}"`);
  }

  const seenEmails = new Set();
  return recipientRows.map((cells, index) => {
    const email = cells[idx.email] ?? '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Invalid e-mail address in CSV record ${index + 2}: "${email}"`);
    }
    const duplicateKey = email.toLowerCase();
    if (seenEmails.has(duplicateKey)) {
      throw new Error(`Duplicate e-mail address in CSV: "${email}"`);
    }
    seenEmails.add(duplicateKey);
    return { email, firstName: cells[idx.firstName] ?? '', lastName: cells[idx.lastName] ?? '' };
  });
};

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'recipient';
const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character]);
const createStableId = (value) => createHash('sha256').update(value.toLowerCase()).digest('hex');
const fileNameFor = (email) => `${slugify(email).slice(0, 80)}-${createStableId(email)}.eml`;
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
  const boundary = `----=_PowerHV_${createStableId(email)}`;
  const safeFirstName = escapeHtml(firstName);
  const safeLastName = escapeHtml(lastName);
  // В src/email-responsive.html по умолчанию стоит плейсхолдер «[Имя Отчество]»;
  // при рассылке заменяем обращение на персонализированное.
  const personalized = htmlWithCid
    .replace('[Имя Отчество]', `${safeFirstName} ${safeLastName}`)
    .replaceAll('{{firstName}}', safeFirstName)
    .replaceAll('{{lastName}}', safeLastName);
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
const generatedFiles = recipients.map((recipient) => ({
  fileName: fileNameFor(recipient.email),
  content: buildEml(recipient),
}));
const manifestPath = resolve(outputDir, '.campaign-manifest.json');
let previousFileNames = [];
if (existsSync(manifestPath)) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    throw new Error(`Campaign manifest is invalid: ${manifestPath}`);
  }
  if (!Array.isArray(manifest) || manifest.some((fileName) =>
    typeof fileName !== 'string' || basename(fileName) !== fileName || !fileName.endsWith('.eml'))
  ) {
    throw new Error(`Campaign manifest contains invalid file names: ${manifestPath}`);
  }
  previousFileNames = manifest;
} else if (existsSync(outputDir)) {
  previousFileNames = readdirSync(outputDir).filter((fileName) =>
    fileName === '.eml' || /^[a-z0-9]+(?:-[a-z0-9]+){2,}\.eml$/.test(fileName)
  );
}

mkdirSync(outputDir, { recursive: true });
const currentFileNames = new Set(generatedFiles.map(({ fileName }) => fileName));
for (const fileName of previousFileNames) {
  if (!currentFileNames.has(fileName)) {
    const stalePath = resolve(outputDir, fileName);
    if (existsSync(stalePath)) unlinkSync(stalePath);
  }
}
for (const { fileName, content } of generatedFiles) {
  writeFileSync(resolve(outputDir, fileName), content, 'utf8');
}
writeFileSync(manifestPath, `${JSON.stringify([...currentFileNames], null, 2)}\n`, 'utf8');
console.log(`Generated ${recipients.length} personalized .eml file(s) in ${outputDir}`);
