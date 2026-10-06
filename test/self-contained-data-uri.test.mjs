import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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

    const sourceHtml = readFileSync(resolve(import.meta.dirname, '../src/email-responsive.html'), 'utf8');
    const sourceBanner = sourceHtml.match(/src="data:image\/jpeg;base64,([^"]+)"/);
    assert.ok(sourceBanner, 'source banner is missing');
    assert.deepEqual(Buffer.from(imagePart.body, 'base64'), Buffer.from(sourceBanner[1], 'base64'));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
