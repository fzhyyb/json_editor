import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlUrl = new URL('../index.html', import.meta.url);

test('workbench exposes one accessible editor and no textarea length limit', async () => {
  const html = await readFile(htmlUrl, 'utf8');

  assert.match(html, /<div(?=[^>]*\bid="editor")(?=[^>]*\brole="region")(?=[^>]*\baria-label="JSON 编辑器")[^>]*>/);
  assert.equal((html.match(/\bid="editor"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<textarea\b/i);
  assert.doesNotMatch(html, /\bmaxlength=/i);
});

test('toolbar includes every approved action as a named button', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const actions = [
    'parse',
    'format',
    'minify',
    'escape',
    'unescape',
    'fold-all',
    'unfold-all',
    'search',
    'copy',
    'clear',
  ];

  for (const action of actions) {
    assert.match(
      html,
      new RegExp(`<button(?=[^>]*\\bdata-action="${action}")(?=[^>]*\\baria-label="[^"]+")[^>]*>`),
      `missing accessible ${action} action`,
    );
  }
});

test('validity, feedback, warnings, and editor metadata are accessible', async () => {
  const html = await readFile(htmlUrl, 'utf8');

  assert.match(html, /id="validity"[^>]*role="status"/);
  assert.match(html, /id="status"[^>]*role="status"/);
  assert.match(
    html,
    /<aside(?=[^>]*\bid="warning-panel")(?=[^>]*\brole="region")(?=[^>]*\baria-live="polite")(?=[^>]*\baria-label="解析警告")[^>]*>/,
  );
  for (const id of ['line-position', 'line-count', 'character-count', 'byte-count']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('page loads only the local bundled browser entry', async () => {
  const html = await readFile(htmlUrl, 'utf8');

  assert.match(html, /<script src="\.\/dist\/app\.js"><\/script>/);
  assert.doesNotMatch(html, /src="https?:\/\//i);
});
