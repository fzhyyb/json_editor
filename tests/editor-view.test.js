import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldRetryWholeDocumentPaste } from '../src/editor-view.js';

test('retries automatic parsing after a default paste replaces the whole document', () => {
  assert.equal(shouldRetryWholeDocumentPaste({
    beforeText: '',
    beforeSelection: { from: 0, to: 0 },
    afterText: '{"payload":"{\\"ok\\":true}"}',
  }), true);

  assert.equal(shouldRetryWholeDocumentPaste({
    beforeText: 'old',
    beforeSelection: { from: 0, to: 3 },
    afterText: '{"ok":true}',
  }), true);
});

test('does not reinterpret an ordinary partial paste as a whole JSON document', () => {
  assert.equal(shouldRetryWholeDocumentPaste({
    beforeText: '{"message":""}',
    beforeSelection: { from: 12, to: 12 },
    afterText: '{"message":"hello"}',
  }), false);
});
