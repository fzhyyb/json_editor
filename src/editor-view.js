import { indentWithTab } from '@codemirror/commands';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { foldAll as foldAllCode, unfoldAll as unfoldAllCode } from '@codemirror/language';
import { linter } from '@codemirror/lint';
import { openSearchPanel, search } from '@codemirror/search';
import { EditorSelection } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { basicSetup, EditorView } from 'codemirror';

function metadata(view, bytes) {
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  return {
    line: line.number,
    column: head - line.from + 1,
    lines: view.state.doc.lines,
    characters: view.state.doc.length,
    bytes,
  };
}

function snapshot(view) {
  const text = view.state.doc.toString();
  return {
    ...metadata(view, new TextEncoder().encode(text).length),
    text,
  };
}

export function shouldRetryWholeDocumentPaste({
  beforeText,
  beforeSelection,
  afterText,
}) {
  const replacedWholeDocument = beforeText.length === 0
    || (beforeSelection.from === 0 && beforeSelection.to === beforeText.length);
  return replacedWholeDocument && afterText !== beforeText;
}

export function createJsonEditor({ parent, onUpdate, onPaste, onPasteFallback }) {
  let cachedBytes = 0;
  const view = new EditorView({
    parent,
    extensions: [
      basicSetup,
      json(),
      linter(jsonParseLinter()),
      search({ top: true }),
      keymap.of([indentWithTab]),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        'aria-label': 'JSON 编辑器',
        spellcheck: 'false',
      }),
      EditorView.domEventHandlers({
        paste(event, eventView) {
          const beforeText = eventView.state.doc.toString();
          const selection = eventView.state.selection.main;
          const beforeSelection = { from: selection.from, to: selection.to };
          const text = event.clipboardData?.getData('text/plain');
          if (typeof text === 'string' && onPaste?.(text)) {
            event.preventDefault();
            return true;
          }

          setTimeout(() => {
            const afterText = eventView.state.doc.toString();
            if (shouldRetryWholeDocumentPaste({ beforeText, beforeSelection, afterText })) {
              onPasteFallback?.(afterText);
            }
          }, 0);
          return false;
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const value = snapshot(update.view);
          cachedBytes = value.bytes;
          onUpdate?.(value);
        } else if (update.selectionSet) {
          onUpdate?.(metadata(update.view, cachedBytes));
        }
      }),
    ],
  });

  return {
    getText() {
      return view.state.doc.toString();
    },
    getSelection() {
      const selection = view.state.selection.main;
      return { from: selection.from, to: selection.to };
    },
    replaceDocument(text, selection) {
      const range = selection ?? { from: text.length, to: text.length };
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: EditorSelection.range(range.from, range.to),
        scrollIntoView: true,
      });
    },
    focus() {
      view.focus();
    },
    foldAll() {
      foldAllCode(view);
    },
    unfoldAll() {
      unfoldAllCode(view);
    },
    openSearch() {
      openSearchPanel(view);
    },
    getSnapshot() {
      const value = snapshot(view);
      cachedBytes = value.bytes;
      return value;
    },
    destroy() {
      view.destroy();
    },
  };
}
