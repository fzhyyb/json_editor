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
