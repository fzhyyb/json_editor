import { createJsonEditor } from './editor-view.js';
import { createUtoolsAdapter } from './utools-adapter.js';
import { createWorkbenchController } from './workbench-controller.js';

const adapter = createUtoolsAdapter();
const editorParent = document.querySelector('#editor');
const status = document.querySelector('#status');
const validity = document.querySelector('#validity');
const warningPanel = document.querySelector('#warning-panel');
const warnings = document.querySelector('#warnings');
const linePosition = document.querySelector('#line-position');
const lineCount = document.querySelector('#line-count');
const characterCount = document.querySelector('#character-count');
const byteCount = document.querySelector('#byte-count');

function setStatus(message, kind = 'neutral') {
  status.textContent = message;
  status.dataset.kind = kind;
}

function setWarnings(items) {
  warnings.replaceChildren(...items.map((item) => {
    const entry = document.createElement('li');
    entry.textContent = `${item.path}：${item.message}`;
    return entry;
  }));
  warningPanel.hidden = items.length === 0;
}

function setValidity(label, kind) {
  validity.textContent = label;
  validity.dataset.kind = kind;
}

function setMetadata(value) {
  linePosition.textContent = `第 ${value.line} 行，第 ${value.column} 列`;
  lineCount.textContent = `${value.lines} 行`;
  characterCount.textContent = `${value.characters.toLocaleString()} 字符`;
  byteCount.textContent = `${value.bytes.toLocaleString()} 字节`;
}

let controller;
let validationTimer;
const editor = createJsonEditor({
  parent: editorParent,
  onUpdate(value) {
    controller?.handleEditorUpdate(value);
    if (typeof value.text === 'string') {
      clearTimeout(validationTimer);
      validationTimer = setTimeout(() => controller?.validate(value.text), 200);
    }
  },
  onPaste(text) {
    return controller?.handlePaste(text) ?? false;
  },
  onPasteFallback(text) {
    return controller?.handlePastedDocument(text) ?? false;
  },
});

controller = createWorkbenchController({
  editor,
  adapter,
  setStatus,
  setWarnings,
  setValidity,
  setMetadata,
});

const actions = {
  parse: () => controller.parse(),
  format: () => controller.format(),
  minify: () => controller.minify(),
  escape: () => controller.escape(),
  unescape: () => controller.unescape(),
  'fold-all': () => controller.foldAll(),
  'unfold-all': () => controller.unfoldAll(),
  search: () => controller.search(),
  copy: () => controller.copy(),
  clear: () => controller.clear(),
};

for (const button of document.querySelectorAll('[data-action]')) {
  button.addEventListener('click', actions[button.dataset.action]);
}

document.addEventListener('keydown', (event) => {
  const command = event.metaKey || event.ctrlKey;
  if (command && event.key === 'Enter') {
    event.preventDefault();
    controller.parse();
  }
  if (command && event.shiftKey && event.key.toLowerCase() === 'c') {
    event.preventDefault();
    controller.copy();
  }
});

adapter.onTextEnter((payload) => {
  if (controller.handleTextEntry(payload)) {
    editor.focus();
  }
});

const initialSnapshot = editor.getSnapshot();
controller.handleEditorUpdate(initialSnapshot);
controller.validate(initialSnapshot.text);
editor.focus();
