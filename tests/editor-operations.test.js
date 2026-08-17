import test from 'node:test';
import assert from 'node:assert/strict';

import {
  escapeJson,
  formatJson,
  minifyJson,
  transformSelection,
  unescapeJson,
} from '../src/editor-operations.js';

test('formats JSON with two spaces without expanding stringified fields', () => {
  const nested = JSON.stringify({ id: 1 });
  const input = JSON.stringify({ payload: nested });

  assert.equal(formatJson(input), JSON.stringify({ payload: nested }, null, 2));
});

test('minifies JSON without expanding stringified fields', () => {
  const nested = JSON.stringify({ id: 1 });
  const input = JSON.stringify({ payload: nested }, null, 2);

  assert.equal(minifyJson(input), JSON.stringify({ payload: nested }));
});

test('formatting and minification repair unsupported string escapes', () => {
  const input = String.raw`{"url":"https://example.com?a=1\&b=2"}`;
  const expected = { url: 'https://example.com?a=1&b=2' };

  assert.equal(formatJson(input), JSON.stringify(expected, null, 2));
  assert.equal(minifyJson(input), JSON.stringify(expected));
});

test('formatting and minification accept JSON primitives', () => {
  assert.equal(formatJson('true'), 'true');
  assert.equal(minifyJson('"hello"'), '"hello"');
});

test('invalid JSON operations throw without producing replacement text', () => {
  assert.throws(() => formatJson('{broken'));
  assert.throws(() => minifyJson('{broken'));
});

test('escape and unescape apply exactly one JSON string layer', () => {
  const input = '{"a":1}';
  const escaped = '"{\\"a\\":1}"';

  assert.equal(escapeJson(input), escaped);
  assert.equal(unescapeJson(escaped), input);
  assert.equal(escapeJson(escaped), '"\\"{\\\\\\"a\\\\\\":1}\\""');
});

test('unescape restores a naked escaped JSON container', () => {
  const original = JSON.stringify({
    mode: 'A',
    pass: true,
    check_items: [{ id: '1', status: '提醒' }],
  });
  const naked = JSON.stringify(original).slice(1, -1);

  assert.equal(unescapeJson(naked), original);
});

test('unescape rejects values that are not JSON strings', () => {
  assert.throws(
    () => unescapeJson('{"a":1}'),
    (error) => error instanceof TypeError && error.message === '去转义目标必须是 JSON 字符串',
  );
});

test('unescape requires a strictly valid JSON string', () => {
  for (const input of [String.raw`"a\&b"`, String.raw`"\x41"`, String.raw`"\uZZZZ"`]) {
    assert.throws(() => unescapeJson(input));
  }
});

test('formatting applies two-space indentation beyond the recursive expansion limit', () => {
  let value = 1;
  for (let depth = 0; depth < 102; depth += 1) value = [value];
  const input = JSON.stringify(value);

  assert.equal(formatJson(input), JSON.stringify(value, null, 2));
});

test('selection transforms the selection or the whole document and selects the replacement', () => {
  const selected = transformSelection('before {"a":1} after', { from: 7, to: 14 }, escapeJson);
  assert.deepEqual(selected, {
    text: 'before "{\\"a\\":1}" after',
    selection: { from: 7, to: 18 },
  });

  const whole = transformSelection('{"a":1}', { from: 3, to: 3 }, escapeJson);
  assert.deepEqual(whole, {
    text: '"{\\"a\\":1}"',
    selection: { from: 0, to: 11 },
  });
});
