import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('warning panel is a named polite live region', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(
    html,
    /<aside(?=[^>]*\bid="warning-panel")(?=[^>]*\brole="region")(?=[^>]*\baria-live="polite")(?=[^>]*\baria-label="解析警告")[^>]*>/,
  );
});

test('parse and copy are separate controls without a textarea length limit', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /<button[^>]*id="run-button"[^>]*>解析<\/button>/);
  assert.match(html, /<button[^>]*id="copy-button"[^>]*>复制结果<\/button>/);
  assert.doesNotMatch(html, /<textarea[^>]*\bmaxlength=/i);
});
