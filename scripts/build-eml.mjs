import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const htmlPath = resolve(projectRoot, 'src/email-responsive.html');
const imagePath = resolve(projectRoot, 'assets/images/baner600x95_3.jpg');
const outputPath = resolve(projectRoot, 'dist/powerhv-introduction.eml');
const boundary = '----=_PowerHV_Email_20260907';
const imageReference = '../assets/images/baner600x95_3.jpg';
const imageContentId = 'powerhv-banner';

const wrapBase64 = (value) => Buffer.from(value, 'utf8').toString('base64').match(/.{1,76}/g).join('\r\n');
const wrapBytes = (value) => value.toString('base64').match(/.{1,76}/g).join('\r\n');

const sourceHtml = readFileSync(htmlPath, 'utf8');
if (!sourceHtml.includes(imageReference)) {
  throw new Error(`Image reference not found in ${htmlPath}: ${imageReference}`);
}

// Embed the local JPEG as an image MIME part and rewrite the HTML image
// reference to a Content-ID reference. The resulting .eml remains fully
// self-contained and does not depend on an external public URL.
const html = sourceHtml.replace(imageReference, `cid:${imageContentId}`);
const image = readFileSync(imagePath);
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
  'Content-Type: image/jpeg; name="powerhv-banner.jpg"',
  'Content-Transfer-Encoding: base64',
  `Content-ID: <${imageContentId}>`,
  'Content-Disposition: inline; filename="powerhv-banner.jpg"',
  '',
  wrapBytes(image),
  '',
  `--${boundary}--`,
  '',
].join('\r\n');

mkdirSync(resolve(projectRoot, 'dist'), { recursive: true });
writeFileSync(outputPath, eml, 'utf8');
