import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('build script rewrites the local banner reference into a self-contained data:image/jpeg;base64 URI', () => {
  const sourceHtml = readFileSync(new URL('../src/email-responsive.html', import.meta.url), 'utf8');
  assert.match(sourceHtml, /\.\.\/assets\/images\/baner600x95_3\.jpg/);
});
