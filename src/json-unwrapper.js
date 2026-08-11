export class JsonInputError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = 'JsonInputError';
    this.code = code;
  }
}

function isContainer(value) {
  return value !== null && typeof value === 'object';
}

function isJsonContainerCandidate(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const firstCharacter = value.trimStart()[0];
  return firstCharacter === '{' || firstCharacter === '[';
}

function childPath(parent, key, isArray) {
  if (isArray) {
    return `${parent}[${key}]`;
  }

  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`;
}

function stringifyJson(value, prettyDepth) {
  const chunks = [];
  const tasks = [{ type: 'value', value, depth: 0 }];

  while (tasks.length > 0) {
    const task = tasks.pop();

    if (task.type === 'container') {
      if (task.index >= task.length) {
        if (task.pretty) {
          chunks.push(`\n${'  '.repeat(task.depth)}`);
        }
        chunks.push(task.isArray ? ']' : '}');
        continue;
      }

      if (task.index > 0) {
        chunks.push(',');
      }
      if (task.pretty) {
        chunks.push(`\n${'  '.repeat(task.depth + 1)}`);
      }

      const key = task.isArray ? task.index : task.keys[task.index];
      if (!task.isArray) {
        chunks.push(JSON.stringify(key), task.pretty ? ': ' : ':');
      }

      const childValue = task.value[key];
      task.index += 1;
      tasks.push(task, { type: 'value', value: childValue, depth: task.depth + 1 });
      continue;
    }

    if (!isContainer(task.value)) {
      chunks.push(JSON.stringify(task.value));
      continue;
    }

    const isArray = Array.isArray(task.value);
    const keys = isArray ? null : Object.keys(task.value);
    const length = isArray ? task.value.length : keys.length;
    chunks.push(isArray ? '[' : '{');

    if (length > 0) {
      tasks.push({
        type: 'container',
        value: task.value,
        depth: task.depth,
        isArray,
        keys,
        length,
        index: 0,
        pretty: task.depth < prettyDepth,
      });
    } else {
      chunks.push(isArray ? ']' : '}');
    }
  }

  return chunks.join('');
}

export function unwrapJsonText(input, { maxDepth = 100 } = {}) {
  if (!Number.isInteger(maxDepth) || maxDepth < 0) {
    throw new TypeError('maxDepth 必须是非负整数');
  }

  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch (error) {
    throw new JsonInputError(
      'INVALID_OUTER_JSON',
      `外层 JSON 解析失败：${error.message}`,
      error,
    );
  }

  let expandedCount = 0;
  for (let depth = 0; typeof parsed === 'string' && isJsonContainerCandidate(parsed); depth += 1) {
    if (depth >= maxDepth) {
      throw new JsonInputError(
        'OUTER_DEPTH_LIMIT',
        `外层字符串解析超过最大深度 ${maxDepth}`,
      );
    }

    try {
      parsed = JSON.parse(parsed);
      expandedCount += 1;
    } catch (error) {
      throw new JsonInputError(
        'INVALID_OUTER_JSON',
        `外层 JSON 字符串解析失败：${error.message}`,
        error,
      );
    }
  }

  if (!isContainer(parsed)) {
    throw new JsonInputError('OUTER_NOT_CONTAINER', '输入必须是 JSON 对象或数组');
  }

  const warnings = [];

  function visit(value, path, depth) {
    const isCandidate = isJsonContainerCandidate(value);
    if (depth >= maxDepth && (isContainer(value) || isCandidate)) {
      warnings.push({
        code: 'DEPTH_LIMIT',
        path,
        message: `已达到最大递归深度 ${maxDepth}`,
      });
      return value;
    }

    if (isCandidate) {
      let nested;
      try {
        nested = JSON.parse(value);
      } catch {
        warnings.push({
          code: 'INVALID_NESTED_JSON',
          path,
          message: '疑似 JSON 的字符串无法解析',
        });
        return value;
      }

      if (isContainer(nested)) {
        expandedCount += 1;
        return visit(nested, path, depth);
      }
      return value;
    }

    if (!isContainer(value)) {
      return value;
    }

    const isArray = Array.isArray(value);
    const output = isArray ? [] : {};
    for (const key of Object.keys(value)) {
      const childValue = visit(value[key], childPath(path, key, isArray), depth + 1);
      Object.defineProperty(output, key, {
        value: childValue,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return output;
  }

  const value = visit(parsed, '$', 0);
  return {
    value,
    text: stringifyJson(value, maxDepth),
    expandedCount,
    warnings,
  };
}
