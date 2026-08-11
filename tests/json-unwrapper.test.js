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

test('rejects a top-level valid primitive string', () => {
  assert.throws(
    () => unwrapJsonText('"123"'),
    (error) => error instanceof JsonInputError && error.code === 'OUTER_NOT_CONTAINER',
  );
});
