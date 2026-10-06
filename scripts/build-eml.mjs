import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const htmlPath = resolve(projectRoot, 'src/email-responsive.html');
const outputPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(projectRoot, 'dist/powerhv-introduction.eml');
const boundary = '----=_PowerHV_Email_20260907';
const bannerContentId = 'powerhv-banner';

const wrapBase64 = (value) => Buffer.from(value).toString('base64').match(/.{1,76}/g).join('\r\n');

const sourceHtml = readFileSync(htmlPath, 'utf8');
const bannerMatch = sourceHtml.match(/src="data:image\/jpeg;base64,([^"]+)"/);
if (!bannerMatch) {
  throw new Error(`Embedded data URI image not found in ${htmlPath}`);
}

const html = sourceHtml.replace(bannerMatch[0], `src="cid:${bannerContentId}"`);
const banner = Buffer.from(bannerMatch[1], 'base64');
const subject = Buffer.from('Высоковольтные испытательные и измерительные системы PowerHV', 'utf8').toString('base64');

const eml = [
  'From: "МВМ-2000" <mvm-2000@bk.ru>',
  'To:',
  `Subject: =?UTF-8?B?${subject}?=`,
  'MIME-Version: 1.0',
  `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"`,
  '',
  `--${boundary}`,
  'Content-Type: text/html; charset="UTF-8"',
  'Content-Transfer-Encoding: base64',
  '',
  wrapBase64(html),
  '',
  `--${boundary}`,
  'Content-Type: image/jpeg; name="baner600x95_3.jpg"',
  'Content-Transfer-Encoding: base64',
  `Content-ID: <${bannerContentId}>`,
  'Content-Disposition: inline; filename="baner600x95_3.jpg"',
  '',
  wrapBase64(banner),
  '',
  `--${boundary}--`,
  '',
].join('\r\n');

mkdirSync(resolve(outputPath, '..'), { recursive: true });
writeFileSync(outputPath, eml, 'utf8');
