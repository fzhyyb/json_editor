import { JsonInputError, unwrapJsonText } from './json-unwrapper.js';
import { createUtoolsAdapter } from './utools-adapter.js';

const adapter = createUtoolsAdapter();
const source = document.querySelector('#source');
const result = document.querySelector('#result');
const status = document.querySelector('#status');
const runButton = document.querySelector('#run-button');
const copyButton = document.querySelector('#copy-button');
const clearButton = document.querySelector('#clear-button');
const warningPanel = document.querySelector('#warning-panel');
const warnings = document.querySelector('#warnings');

function setStatus(message, kind = 'neutral') {
  status.textContent = message;
  status.dataset.kind = kind;
}

function renderWarnings(items) {
  warnings.replaceChildren(...items.map((item) => {
    const entry = document.createElement('li');
    entry.textContent = `${item.path}：${item.message}`;
    return entry;
  }));
  warningPanel.hidden = items.length === 0;
}

function safeCopyText(text) {
  try {
    return adapter.copyText(text);
  } catch {
    return false;
  }
}

function copyResult() {
  if (!result.textContent) return false;

  const copied = safeCopyText(result.textContent);
  setStatus(
    copied ? '已复制结果' : '复制失败，请手动复制结果',
    copied ? 'success' : 'warning',
  );
  return copied;
}

function processSource() {
  if (!source.value.trim()) {
    setStatus('请先粘贴 JSON', 'error');
    source.focus();
    return;
  }

  try {
    const unwrapped = unwrapJsonText(source.value);
    result.textContent = unwrapped.text;
    copyButton.disabled = false;
    renderWarnings(unwrapped.warnings);

    const detail = unwrapped.expandedCount === 0
      ? '未发现可展开的嵌套 JSON 字符串'
      : `已展开 ${unwrapped.expandedCount} 个字段`;
    const warningDetail = unwrapped.warnings.length > 0
      ? `，其中 ${unwrapped.warnings.length} 个路径未能完全展开`
      : '';
    setStatus(
      `${detail}${warningDetail}`,
      unwrapped.warnings.length > 0 ? 'warning' : 'success',
    );
  } catch (error) {
    const message = error instanceof JsonInputError
      ? error.message
      : '处理失败，请检查输入';
    setStatus(message, 'error');
  }
}

runButton.addEventListener('click', processSource);
copyButton.addEventListener('click', copyResult);
clearButton.addEventListener('click', () => {
  source.value = '';
  result.textContent = '';
  copyButton.disabled = true;
  renderWarnings([]);
  setStatus('已清空，等待输入');
  source.focus();
});

document.addEventListener('keydown', (event) => {
  const command = event.metaKey || event.ctrlKey;
  if (command && event.key === 'Enter') {
    event.preventDefault();
    processSource();
  }
  if (command && event.shiftKey && event.key.toLowerCase() === 'c') {
    event.preventDefault();
    copyResult();
  }
});

adapter.onTextEnter((payload) => {
  source.value = payload;
  processSource();
});

source.focus();
