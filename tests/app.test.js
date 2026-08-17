import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createWorkbenchController } from '../src/workbench-controller.js';

function createFakeEditor() {
  return {
    text: '',
    selection: { from: 0, to: 0 },
    replacements: [],
    calls: [],
    getText() {
      return this.text;
    },
    getSelection() {
      return this.selection;
    },
    replaceDocument(text, selection = { from: text.length, to: text.length }) {
      this.text = text;
      this.selection = selection;
      this.replacements.push({ text, selection });
    },
    focus() {
      this.calls.push('focus');
    },
    foldAll() {
      this.calls.push('foldAll');
    },
    unfoldAll() {
      this.calls.push('unfoldAll');
    },
    openSearch() {
      this.calls.push('openSearch');
    },
  };
}

let editor;
let clipboard;
let statuses;
let warningSets;
let validities;
let metadata;
let controller;

beforeEach(() => {
  editor = createFakeEditor();
  clipboard = [];
  statuses = [];
  warningSets = [];
  validities = [];
  metadata = [];
  controller = createWorkbenchController({
    editor,
    adapter: {
      copyText(text) {
        clipboard.push(text);
        return true;
      },
    },
    setStatus(message, kind) {
      statuses.push({ message, kind });
    },
    setWarnings(items) {
      warningSets.push(items);
    },
    setValidity(label, kind) {
      validities.push({ label, kind });
    },
    setMetadata(value) {
      metadata.push(value);
    },
  });
});

test('recursive parse replaces the document without copying', () => {
  editor.text = JSON.stringify({ payload: JSON.stringify({ id: 1 }) });

  assert.equal(controller.parse(), true);

  assert.equal(editor.text, JSON.stringify({ payload: { id: 1 } }, null, 2));
  assert.equal(clipboard.length, 0);
  assert.deepEqual(statuses.at(-1), { message: '已展开 1 个嵌套字段', kind: 'success' });
  assert.deepEqual(warningSets.at(-1), []);
});

test('uTools text entry automatically recursively parses the payload', () => {
  const payload = JSON.stringify({ data: JSON.stringify([1, 2]) });

  assert.equal(controller.handleTextEntry(payload), true);

  assert.equal(editor.text, JSON.stringify({ data: [1, 2] }, null, 2));
  assert.equal(clipboard.length, 0);
  assert.deepEqual(editor.selection, { from: 0, to: 0 });
});

test('full-document paste is intercepted and automatically parsed', () => {
  const payload = JSON.stringify({ data: JSON.stringify({ ok: true }) });
  editor.text = 'replace me';
  editor.selection = { from: 0, to: editor.text.length };

  assert.equal(controller.handlePaste(payload), true);
  assert.equal(editor.text, JSON.stringify({ data: { ok: true } }, null, 2));
  assert.deepEqual(editor.selection, { from: 0, to: 0 });
});

test('naked escaped JSON is automatically restored on paste and uTools entry', () => {
  const value = {
    mode: 'A',
    pass: true,
    check_items: [{ id: '1', status: '提醒' }],
  };
  const naked = JSON.stringify(JSON.stringify(value)).slice(1, -1);

  assert.equal(controller.handlePaste(naked), true);
  assert.equal(editor.text, JSON.stringify(value, null, 2));
  assert.deepEqual(editor.selection, { from: 0, to: 0 });

  editor.text = '';
  assert.equal(controller.handleTextEntry(naked), true);
  assert.equal(editor.text, JSON.stringify(value, null, 2));
});

test('default whole-document paste can be parsed after clipboardData is unavailable', () => {
  const payload = JSON.stringify(JSON.stringify({
    task_id: '7672091721177517688',
    form_ai_context: JSON.stringify({ service: 'ark' }),
  }));
  editor.text = payload;
  editor.selection = { from: payload.length, to: payload.length };

  assert.equal(controller.handlePastedDocument(payload), true);
  assert.equal(editor.text, JSON.stringify({
    task_id: '7672091721177517688',
    form_ai_context: { service: 'ark' },
  }, null, 2));
  assert.deepEqual(editor.selection, { from: 0, to: 0 });
});

test('partial paste and invalid whole-document paste fall through unchanged', () => {
  editor.text = '{"a":1}';
  editor.selection = { from: 2, to: 2 };

  assert.equal(controller.handlePaste('{"b":2}'), false);
  assert.equal(editor.text, '{"a":1}');

  editor.selection = { from: 0, to: editor.text.length };
  assert.equal(controller.handlePaste('{broken'), false);
  assert.equal(editor.text, '{"a":1}');
});

test('format and minify transform the document without recursive expansion', () => {
  const nested = JSON.stringify({ id: 1 });
  editor.text = JSON.stringify({ payload: nested });

  assert.equal(controller.format(), true);
  assert.equal(editor.text, JSON.stringify({ payload: nested }, null, 2));
  assert.deepEqual(editor.selection, { from: 0, to: 0 });

  assert.equal(controller.minify(), true);
  assert.equal(editor.text, JSON.stringify({ payload: nested }));
});

test('escape and unescape prefer a non-empty selection', () => {
  editor.text = 'before {"a":1} after';
  editor.selection = { from: 7, to: 14 };

  assert.equal(controller.escape(), true);
  assert.equal(editor.text, 'before "{\\"a\\":1}" after');
  assert.deepEqual(editor.selection, { from: 7, to: 18 });

  assert.equal(controller.unescape(), true);
  assert.equal(editor.text, 'before {"a":1} after');
  assert.deepEqual(editor.selection, { from: 7, to: 14 });
});

test('folding and search delegate to the editor adapter', () => {
  controller.foldAll();
  controller.unfoldAll();
  controller.search();

  assert.deepEqual(editor.calls, ['foldAll', 'unfoldAll', 'openSearch']);
});

test('copy is explicit and clear resets the workbench', () => {
  editor.text = '{"ok":true}';

  assert.equal(controller.copy(), true);
  assert.deepEqual(clipboard, ['{"ok":true}']);

  controller.clear();
  assert.equal(editor.text, '');
  assert.deepEqual(warningSets.at(-1), []);
  assert.deepEqual(editor.calls, ['focus']);
  assert.deepEqual(statuses.at(-1), { message: '已清空，等待粘贴 JSON', kind: 'neutral' });
});

test('failed transforms preserve the document and expose an error', () => {
  editor.text = '{broken';

  assert.equal(controller.format(), false);
  assert.equal(controller.parse(), false);
  assert.equal(editor.text, '{broken');
  assert.equal(editor.replacements.length, 0);
  assert.equal(statuses.at(-1).kind, 'error');
});

test('editor updates report metadata while validation is a separate operation', () => {
  controller.handleEditorUpdate({
    line: 3,
    column: 7,
    lines: 12,
    characters: 2048,
    bytes: 2050,
  });
  assert.equal(validities.length, 0);
  controller.validate('{"ok":true}');
  assert.deepEqual(validities.at(-1), { label: 'JSON 有效', kind: 'valid' });
  assert.deepEqual(metadata.at(-1), {
    line: 3,
    column: 7,
    lines: 12,
    characters: 2048,
    bytes: 2050,
  });

  controller.validate('{broken');
  assert.deepEqual(validities.at(-1), { label: 'JSON 无效', kind: 'invalid' });

  controller.validate('');
  assert.deepEqual(validities.at(-1), { label: '等待输入', kind: 'neutral' });
});
