import {
  escapeJson,
  formatJson,
  minifyJson,
  transformSelection,
  unescapeJson,
} from './editor-operations.js';
import { JsonInputError, unwrapJsonText } from './json-unwrapper.js';

export function createWorkbenchController({
  editor,
  adapter,
  setStatus = () => {},
  setWarnings = () => {},
  setValidity = () => {},
  setMetadata = () => {},
}) {
  function errorMessage(error) {
    if (error instanceof JsonInputError || error instanceof TypeError) {
      return error.message;
    }
    return `操作失败：${error.message ?? '请检查 JSON'}`;
  }

  function announceExpansion(result, prefix = '') {
    const detail = result.expandedCount === 0
      ? '未发现可展开的嵌套 JSON 字符串'
      : `已展开 ${result.expandedCount} 个嵌套字段`;
    const warningDetail = result.warnings.length === 0
      ? ''
      : `，${result.warnings.length} 个路径未能完全展开`;
    setStatus(`${prefix}${detail}${warningDetail}`, result.warnings.length > 0 ? 'warning' : 'success');
  }

  function applyRecursive(text, { cursorAtStart = false, silentFailure = false } = {}) {
    try {
      const result = unwrapJsonText(text);
      const selection = cursorAtStart ? { from: 0, to: 0 } : undefined;
      editor.replaceDocument(result.text, selection);
      setWarnings(result.warnings);
      announceExpansion(result);
      return true;
    } catch (error) {
      if (!silentFailure) {
        setStatus(errorMessage(error), 'error');
      }
      return false;
    }
  }

  function applyDocumentOperation(operation, successMessage, selection) {
    try {
      const text = operation(editor.getText());
      editor.replaceDocument(text, selection);
      setWarnings([]);
      setStatus(successMessage, 'success');
      return true;
    } catch (error) {
      setStatus(errorMessage(error), 'error');
      return false;
    }
  }

  function applySelectionOperation(operation, successMessage) {
    try {
      const result = transformSelection(editor.getText(), editor.getSelection(), operation);
      editor.replaceDocument(result.text, result.selection);
      setWarnings([]);
      setStatus(successMessage, 'success');
      return true;
    } catch (error) {
      setStatus(errorMessage(error), 'error');
      return false;
    }
  }

  return {
    parse() {
      return applyRecursive(editor.getText());
    },

    handleTextEntry(payload) {
      if (typeof payload !== 'string') return false;
      return applyRecursive(payload, { cursorAtStart: true });
    },

    handlePaste(payload) {
      if (typeof payload !== 'string') return false;
      const text = editor.getText();
      const selection = editor.getSelection();
      const replacesWholeDocument = text.length === 0
        || (selection.from === 0 && selection.to === text.length);
      if (!replacesWholeDocument) return false;
      return applyRecursive(payload, { cursorAtStart: true, silentFailure: true });
    },

    handlePastedDocument(payload) {
      if (typeof payload !== 'string') return false;
      return applyRecursive(payload, { cursorAtStart: true, silentFailure: true });
    },

    format() {
      return applyDocumentOperation(formatJson, '已格式化 JSON', { from: 0, to: 0 });
    },

    minify() {
      return applyDocumentOperation(minifyJson, '已压缩 JSON');
    },

    escape() {
      return applySelectionOperation(escapeJson, '已增加一层转义');
    },

    unescape() {
      return applySelectionOperation(unescapeJson, '已移除一层转义');
    },

    foldAll() {
      editor.foldAll();
    },

    unfoldAll() {
      editor.unfoldAll();
    },

    search() {
      editor.openSearch();
    },

    copy() {
      const text = editor.getText();
      if (!text) return false;

      let copied = false;
      try {
        copied = adapter.copyText(text);
      } catch {
        copied = false;
      }
      setStatus(copied ? '已复制编辑器内容' : '复制失败，请手动复制', copied ? 'success' : 'warning');
      return copied;
    },

    clear() {
      editor.replaceDocument('', { from: 0, to: 0 });
      setWarnings([]);
      setValidity('等待输入', 'neutral');
      setStatus('已清空，等待粘贴 JSON', 'neutral');
      editor.focus();
    },

    handleEditorUpdate(value) {
      setMetadata({
        line: value.line,
        column: value.column,
        lines: value.lines,
        characters: value.characters,
        bytes: value.bytes,
      });
    },

    validate(text) {
      if (!text.trim()) {
        setValidity('等待输入', 'neutral');
        return;
      }

      try {
        JSON.parse(text);
        setValidity('JSON 有效', 'valid');
      } catch {
        setValidity('JSON 无效', 'invalid');
      }
    },
  };
}
