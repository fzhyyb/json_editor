import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class FakeElement {
  constructor() {
    this.listeners = new Map();
    this.dataset = {};
    this.reset();
  }

  reset() {
    this.textContent = '';
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.children = [];
    this.dataset = {};
  }

  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }

  dispatch(type, event = {}) {
    return this.listeners.get(type)?.(event);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  focus() {
    document.activeElement = this;
  }
}

const ids = [
  'source',
  'result',
  'status',
  'run-button',
  'copy-button',
  'clear-button',
  'warning-panel',
  'warnings',
];
const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement()]));

globalThis.document = {
  activeElement: null,
  querySelector(selector) {
    return elements[selector.slice(1)];
  },
  createElement() {
    return new FakeElement();
  },
  addEventListener() {},
};

let copyImplementation = () => false;
globalThis.utools = {
  onPluginEnter() {},
  copyText(text) {
    return copyImplementation(text);
  },
};

await import('../src/app.js');

beforeEach(() => {
  for (const element of Object.values(elements)) element.reset();
  elements['copy-button'].disabled = true;
  document.activeElement = null;
  copyImplementation = () => false;
});

test('clipboard exceptions keep valid output and become normal copy failures', () => {
  copyImplementation = () => {
    throw new Error('clipboard unavailable');
  };
  elements.source.value = JSON.stringify({ data: JSON.stringify({ id: 1 }) });

  assert.doesNotThrow(() => elements['run-button'].dispatch('click'));
  assert.equal(elements.result.textContent, JSON.stringify({ data: { id: 1 } }, null, 2));
  assert.equal(elements.status.textContent, '已展开 1 个字段，请手动复制');
  assert.equal(elements.status.dataset.kind, 'warning');

  assert.doesNotThrow(() => elements['copy-button'].dispatch('click'));
  assert.equal(elements.status.textContent, '无法自动复制，请手动复制结果');
  assert.equal(elements.status.dataset.kind, 'warning');
});

test('outer parse errors preserve the previous result and its warnings', () => {
  elements.source.value = JSON.stringify({ payload: '{broken}' });
  elements['run-button'].dispatch('click');

  const previousResult = elements.result.textContent;
  assert.equal(elements['warning-panel'].hidden, false);
  assert.deepEqual(
    elements.warnings.children.map((item) => item.textContent),
    ['$.payload：疑似 JSON 的字符串无法解析'],
  );

  elements.source.value = '{broken';
  elements['run-button'].dispatch('click');

  assert.equal(elements.result.textContent, previousResult);
  assert.equal(elements['copy-button'].disabled, false);
  assert.equal(elements['warning-panel'].hidden, false);
  assert.deepEqual(
    elements.warnings.children.map((item) => item.textContent),
    ['$.payload：疑似 JSON 的字符串无法解析'],
  );
  assert.match(elements.status.textContent, /^外层 JSON 解析失败：/);
  assert.equal(elements.status.dataset.kind, 'error');
});

test('successful copying still announces incomplete expansion as a warning', () => {
  copyImplementation = () => true;
  const input = {
    data: JSON.stringify({ id: 1 }),
    payload: '{broken}',
  };
  elements.source.value = JSON.stringify(input);

  elements['run-button'].dispatch('click');

  assert.equal(
    elements.result.textContent,
    JSON.stringify({ data: { id: 1 }, payload: '{broken}' }, null, 2),
  );
  assert.equal(
    elements.status.textContent,
    '已展开 1 个字段，其中 1 个路径未能完全展开，已复制',
  );
  assert.equal(elements.status.dataset.kind, 'warning');
  assert.equal(elements['warning-panel'].hidden, false);
  assert.deepEqual(
    elements.warnings.children.map((item) => item.textContent),
    ['$.payload：疑似 JSON 的字符串无法解析'],
  );
});
