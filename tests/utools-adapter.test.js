import test from 'node:test';
import assert from 'node:assert/strict';

import { createUtoolsAdapter } from '../src/utools-adapter.js';

test('forwards supported string text entries to the registered handler', () => {
  let pluginEnterCallback;
  const api = {
    onPluginEnter(callback) {
      pluginEnterCallback = callback;
    },
  };
  const received = [];

  createUtoolsAdapter(api).onTextEnter((text) => received.push(text));
  pluginEnterCallback({ type: 'over', payload: '{"a":1}' });
  pluginEnterCallback({ type: 'img', payload: 'ignored' });

  assert.deepEqual(received, ['{"a":1}']);
});

test('reports whether text was copied through uTools', () => {
  assert.equal(createUtoolsAdapter({ copyText: () => true }).copyText('ok'), true);
  assert.equal(createUtoolsAdapter({ copyText: () => false }).copyText('ok'), false);
  assert.equal(createUtoolsAdapter(undefined).copyText('browser'), false);
});
