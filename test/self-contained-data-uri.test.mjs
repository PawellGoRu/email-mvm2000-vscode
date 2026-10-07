import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const readSource = (name) =>
  readFileSync(resolve(import.meta.dirname, '../src', name), 'utf8');

test('build script embeds the banner as an inline related MIME image', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'powerhv-email-'));
  const outputPath = join(tempDir, 'test.eml');

  try {
    execFileSync(process.execPath, [resolve(import.meta.dirname, '../scripts/build-eml.mjs'), outputPath]);

    const eml = readFileSync(outputPath, 'utf8');
    const boundary = eml.match(/boundary="([^"]+)"/)?.[1];
    assert.ok(boundary, 'MIME boundary is missing');

    const parts = eml
      .split(`--${boundary}`)
      .slice(1, -1)
      .map((part) => part.replace(/^\r\n/, '').replace(/\r\n$/, ''))
      .map((part) => {
        const separator = part.indexOf('\r\n\r\n');
        return {
          headers: part.slice(0, separator),
          body: part.slice(separator + 4).replaceAll('\r\n', ''),
        };
      });
    const htmlPart = parts.find(({ headers }) => headers.includes('Content-Type: text/html'));
    const imagePart = parts.find(({ headers }) => headers.includes('Content-ID: <powerhv-banner>'));

    assert.ok(htmlPart, 'HTML MIME part is missing');
    assert.ok(imagePart, 'inline banner MIME part is missing');
    assert.match(imagePart.headers, /Content-Disposition: inline/);

    const html = Buffer.from(htmlPart.body, 'base64').toString('utf8');
    assert.match(html, /src="cid:powerhv-banner"/);
    assert.doesNotMatch(html, /data:image\/jpeg;base64,/);

    const sourceHtml = readSource('email-responsive.html');
    const sourceBanner = sourceHtml.match(/src="data:image\/jpeg;base64,([^"]+)"/);
    assert.ok(sourceBanner, 'source banner is missing');
    assert.deepEqual(Buffer.from(imagePart.body, 'base64'), Buffer.from(sourceBanner[1], 'base64'));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('single-send EML carries campaign-compliant headers', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'powerhv-email-'));
  const outputPath = join(tempDir, 'test.eml');

  try {
    execFileSync(process.execPath, [resolve(import.meta.dirname, '../scripts/build-eml.mjs'), outputPath]);
    const eml = readFileSync(outputPath, 'utf8');

    assert.match(eml, /^From: .+ <mvm-2000@bk\.ru>$/m, 'From header must be filled');
    assert.match(eml, /^Subject: =\?UTF-8\?B\?.+\?=$/m, 'Subject header must be encoded and non-empty');
    assert.match(eml, /^List-Unsubscribe: <https?:\/\/.+>$/m, 'List-Unsubscribe header is required for campaigns');
    assert.match(eml, /^List-Unsubscribe-Post: List-Unsubscribe=One-Click$/m);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('templates are self-contained and accessible', () => {
  for (const name of ['email.html', 'email-responsive.html']) {
    const html = readSource(name);
    assert.doesNotMatch(html, /https?:\/\/[^"]*(fonts|cdn)[^"]*"/i, `${name} must not load external fonts/CDN`);
    assert.doesNotMatch(html, /<img(?![^>]*\salt=)[^>]*>/s, `${name}: every img needs alt`);
    assert.ok(
      /Preheader/i.test(html) && /max-height: 0/.test(html),
      `${name} must include a hidden preheader block`,
    );
    assert.ok(
      /Уважаемый \[Имя Отчество\]!/.test(html),
      `${name} must contain the greeting placeholder [Имя Отчество]`,
    );
  }
});

test('both templates share the same visible copy blocks', () => {
  const strip = (html) =>
    html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/data:image[^"]*/g, '')
      .replace(/src="cid:[^"]*"/g, '')
      .replace(/<div[^>]*max-height: 0[\s\S]*?<\/div>/i, '') // preheader
      .replace(/<!\[if mso\][\s\S]*?<!\[endif\]-->/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([><])\s*/g, '$1')
      .trim();

  const responsive = strip(readSource('email-responsive.html'));
  const plain = strip(readSource('email.html'));

  for (const fragment of [
    'Уважаемый [Имя Отчество]!',
    'бренд<strong style="color: #0d6794">PowerHV</strong>',
    'Референс-листы поставок в Россию и за рубеж (с 2014 года).',
    'Горбатюк Павел Витальевич',
    'mvm-2000@bk.ru',
  ]) {
    assert.ok(responsive.includes(fragment), `responsive template misses: ${fragment}`);
    assert.ok(plain.includes(fragment), `email.html misses: ${fragment}`);
  }
});
