export class JsonInputError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'JsonInputError';
    this.code = code;
  }
}

function isContainer(value) {
  return typeof value === 'object' && value !== null;
}

function isCandidate(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const firstCharacter = value.trim()[0];
  return firstCharacter === '{' || firstCharacter === '[';
}

export function unwrapJsonText(input) {
  let root;

  try {
    root = JSON.parse(input);
  } catch {
    throw new JsonInputError('外层 JSON 格式无效', 'INVALID_OUTER_JSON');
  }

  if (!isContainer(root)) {
    throw new JsonInputError('外层 JSON 必须是对象或数组', 'OUTER_NOT_CONTAINER');
  }

  const value = Array.isArray(root) ? [...root] : { ...root };
  let expandedCount = 0;

  for (const [key, fieldValue] of Object.entries(value)) {
    if (!isCandidate(fieldValue)) {
      continue;
    }

    try {
      const parsedValue = JSON.parse(fieldValue);
      if (isContainer(parsedValue)) {
        value[key] = parsedValue;
        expandedCount += 1;
      }
    } catch {
      // Nested parse failures are intentionally ignored in the baseline parser.
    }
  }

  return {
    value,
    text: JSON.stringify(value, null, 2),
    expandedCount,
    warnings: [],
  };
}
