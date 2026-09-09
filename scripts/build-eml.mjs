import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const htmlPath = resolve(projectRoot, 'src/email-responsive.html');
const outputPath = resolve(projectRoot, 'dist/powerhv-introduction.eml');
const boundary = '----=_PowerHV_Email_20260907';

// Self-contained email generation rule:
// the HTML source is already a full self-contained HTML template with
// an inlined data:image/jpeg;base64 banner URI. The EML should carry
// only the HTML content as a MIME part and not generate a separate image part.

const wrapBase64 = (value) => Buffer.from(value, 'utf8').toString('base64').match(/.{1,76}/g).join('\r\n');

const sourceHtml = readFileSync(htmlPath, 'utf8');
if (!sourceHtml.includes('data:image/jpeg;base64,')) {
  throw new Error(`Embedded data URI image not found in ${htmlPath}`);
}

const html = sourceHtml;
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
  `--${boundary}--`,
  '',
].join('\r\n');

mkdirSync(resolve(projectRoot, 'dist'), { recursive: true });
writeFileSync(outputPath, eml, 'utf8');
