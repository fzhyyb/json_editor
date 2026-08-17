import {
  decodeNakedEscapedJsonText,
  parseJsonValue,
  serializeJsonValue,
} from './json-unwrapper.js';

export function formatJson(text) {
  return serializeJsonValue(parseJsonValue(text));
}

export function minifyJson(text) {
  return serializeJsonValue(parseJsonValue(text), { pretty: false });
}

export function escapeJson(text) {
  return JSON.stringify(text);
}

export function unescapeJson(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (strictError) {
    try {
      return decodeNakedEscapedJsonText(text);
    } catch {
      throw strictError;
    }
  }
  if (typeof value !== 'string') {
    throw new TypeError('去转义目标必须是 JSON 字符串');
  }
  return value;
}

export function transformSelection(text, selection, operation) {
  const hasSelection = selection.from !== selection.to;
  const from = hasSelection ? selection.from : 0;
  const to = hasSelection ? selection.to : text.length;
  const replacement = operation(text.slice(from, to));

  return {
    text: `${text.slice(0, from)}${replacement}${text.slice(to)}`,
    selection: { from, to: from + replacement.length },
  };
}
