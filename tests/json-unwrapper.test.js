import test from 'node:test';
import assert from 'node:assert/strict';

import { JsonInputError, unwrapJsonText } from '../src/json-unwrapper.js';

test('formats an outer JSON object without expanding fields', () => {
  const result = unwrapJsonText('{"name":"小明","active":true}');

  assert.deepEqual(result, {
    value: { name: '小明', active: true },
    text: JSON.stringify({ name: '小明', active: true }, null, 2),
    expandedCount: 0,
    warnings: [],
  });
});

test('expands a single stringified object field', () => {
  const result = unwrapJsonText(JSON.stringify({ data: JSON.stringify({ id: 7 }) }));

  assert.deepEqual(result, {
    value: { data: { id: 7 } },
    text: JSON.stringify({ data: { id: 7 } }, null, 2),
    expandedCount: 1,
    warnings: [],
  });
});

test('maps malformed outer JSON to INVALID_OUTER_JSON', () => {
  assert.throws(
    () => unwrapJsonText('{"broken":}'),
    (error) => error instanceof JsonInputError && error.code === 'INVALID_OUTER_JSON',
  );
});

test('repairs unsupported escapes inside outer JSON strings', () => {
  const result = unwrapJsonText(String.raw`{"url":"https://example.com?a=1\&b=2"}`);

  assert.deepEqual(result.value, { url: 'https://example.com?a=1&b=2' });
  assert.equal(result.expandedCount, 0);
  assert.deepEqual(result.warnings, []);
});

test('repairs unsupported escapes while expanding nested JSON strings', () => {
  const nested = String.raw`{"url":"https://example.com?a=1\&b=2"}`;
  const result = unwrapJsonText(JSON.stringify({ payload: nested }));

  assert.deepEqual(result.value, {
    payload: { url: 'https://example.com?a=1&b=2' },
  });
  assert.equal(result.expandedCount, 1);
  assert.deepEqual(result.warnings, []);
});

test('keeps all valid JSON escape sequences unchanged', () => {
  const expected = {
    quote: '"',
    slash: '/',
    backslash: '\\',
    controls: '\b\f\n\r\t',
    unicode: '中',
  };

  const result = unwrapJsonText(JSON.stringify(expected));

  assert.deepEqual(result.value, expected);
});

test('recursively expands stringified containers at every level', () => {
  const input = JSON.stringify({
    data: JSON.stringify({
      profile: JSON.stringify({ name: '小明' }),
      items: JSON.stringify([JSON.stringify({ id: 1 }), 2]),
    }),
  });

  const result = unwrapJsonText(input);

  assert.deepEqual(result.value, {
    data: {
      profile: { name: '小明' },
      items: [{ id: 1 }, 2],
    },
  });
  assert.equal(result.expandedCount, 4);
  assert.deepEqual(result.warnings, []);
});

test('unwraps top-level JSON strings before recursively visiting their contents', () => {
  const input = JSON.stringify(JSON.stringify({ payload: JSON.stringify([]) }));

  const result = unwrapJsonText(input);

  assert.deepEqual(result.value, { payload: [] });
  assert.equal(result.expandedCount, 2);
  assert.deepEqual(result.warnings, []);
});

test('leaves JSON primitive strings unchanged', () => {
  const input = JSON.stringify({ number: '123', bool: 'true', nil: 'null' });

  const result = unwrapJsonText(input);

  assert.deepEqual(result.value, { number: '123', bool: 'true', nil: 'null' });
  assert.equal(result.expandedCount, 0);
});

test('keeps malformed nested candidates and reports their path', () => {
  const input = JSON.stringify({ data: { payload: '{broken}' } });

  const result = unwrapJsonText(input);

  assert.deepEqual(result.value, { data: { payload: '{broken}' } });
  assert.deepEqual(result.warnings, [
    {
      code: 'INVALID_NESTED_JSON',
      path: '$.data.payload',
      message: '疑似 JSON 的字符串无法解析',
    },
  ]);
});

test('uses escaped bracket notation for warning paths with unsafe object keys', () => {
  const input = JSON.stringify({
    'a.b': '{broken}',
    'quote"key': '[broken',
    '': '{broken}',
  });

  const result = unwrapJsonText(input);

  assert.deepEqual(
    result.warnings.map(({ path }) => path),
    ['$["a.b"]', '$["quote\\"key"]', '$[""]'],
  );
});

test('preserves __proto__ as an own enumerable JSON property without prototype pollution', () => {
  const input = '{"__proto__":{"polluted":true}}';
  const expected = JSON.parse(input);

  const result = unwrapJsonText(input);

  assert.equal(Object.hasOwn(result.value, '__proto__'), true);
  assert.equal(Object.prototype.propertyIsEnumerable.call(result.value, '__proto__'), true);
  assert.equal(Object.getPrototypeOf(result.value), Object.prototype);
  assert.equal(result.value.polluted, undefined);
  assert.deepEqual(JSON.parse(result.text), expected);
});

test('preserves empty containers, Unicode, Emoji, backslashes, and escaped newlines', () => {
  const expected = {
    emptyObject: {},
    emptyArray: [],
    unicode: '你好，世界',
    emoji: '🚀🎉',
    escaped: 'C:\\temp\\file\nnext line',
  };

  const result = unwrapJsonText(JSON.stringify(expected));

  assert.deepEqual(result.value, expected);
  assert.equal(result.text, JSON.stringify(expected, null, 2));
  assert.deepEqual(result.warnings, []);
});

test('retains containers at maxDepth and reports the stopped path', () => {
  const original = JSON.stringify({ c: 1 });
  const input = JSON.stringify({ a: { b: original } });

  const result = unwrapJsonText(input, { maxDepth: 1 });

  assert.equal(result.value.a.b, original);
  assert.deepEqual(result.warnings, [
    {
      code: 'DEPTH_LIMIT',
      path: '$.a',
      message: '已达到最大递归深度 1',
    },
  ]);
});

test('does not parse or count candidate strings at maxDepth', () => {
  const original = JSON.stringify({ b: 1 });
  const input = JSON.stringify({ a: original });

  const result = unwrapJsonText(input, { maxDepth: 1 });

  assert.equal(result.value.a, original);
  assert.equal(result.expandedCount, 0);
  assert.deepEqual(result.warnings, [
    {
      code: 'DEPTH_LIMIT',
      path: '$.a',
      message: '已达到最大递归深度 1',
    },
  ]);
});

test('serializes a retained 12,000-level array subtree without recursive overflow', () => {
  const nestedDepth = 12_000;
  const input = `${'['.repeat(nestedDepth)}1${']'.repeat(nestedDepth)}`;

  const result = unwrapJsonText(input, { maxDepth: 5 });

  assert.deepEqual(result.warnings, [
    {
      code: 'DEPTH_LIMIT',
      path: '$[0][0][0][0][0]',
      message: '已达到最大递归深度 5',
    },
  ]);

  let originalCursor = result.value;
  let serializedCursor = JSON.parse(result.text);
  for (let depth = 0; depth < nestedDepth; depth += 1) {
    assert.equal(originalCursor.length, 1);
    assert.equal(serializedCursor.length, 1);
    originalCursor = originalCursor[0];
    serializedCursor = serializedCursor[0];
  }
  assert.equal(originalCursor, 1);
  assert.equal(serializedCursor, 1);
});

test('accepts maxDepth at the upper bound of 100', () => {
  const result = unwrapJsonText('{"ok":true}', { maxDepth: 100 });

  assert.deepEqual(result.value, { ok: true });
  assert.deepEqual(result.warnings, []);
});

test('rejects maxDepth values outside the integer range from 0 to 100', () => {
  for (const maxDepth of [-1, 1.5, '1', 101]) {
    assert.throws(
      () => unwrapJsonText('{}', { maxDepth }),
      (error) => error instanceof TypeError && error.message === 'maxDepth 必须是 0 到 100 之间的整数',
    );
  }
});

test('rejects a top-level valid primitive string', () => {
  assert.throws(
    () => unwrapJsonText('"123"'),
    (error) => error instanceof JsonInputError && error.code === 'OUTER_NOT_CONTAINER',
  );
});
