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
