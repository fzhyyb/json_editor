# uTools Recursive JSON Unwrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-dependency uTools plugin that recursively converts stringified JSON objects and arrays into real nested values, shows a side-by-side comparison, copies successful output, and is ready for marketplace submission.

**Architecture:** Keep parsing in a pure ESM module, isolate uTools globals behind a small adapter, and let a DOM controller coordinate input, rendering, warnings, and shortcuts. The plugin is static HTML/CSS/JavaScript with no build step; Node's built-in test runner verifies all non-visual behavior.

**Tech Stack:** HTML5, CSS, JavaScript ES modules, Node.js `node:test`, uTools `plugin.json`, `utools.onPluginEnter`, `utools.copyText`.

---

## File map

- Create `package.json`: ESM mode and repeatable test command.
- Create `plugin.json`: uTools entry, searchable commands, and arbitrary-text matching command.
- Create `index.html`: accessible two-pane application shell.
- Create `styles.css`: responsive two-pane layout and light/dark themes.
- Create `src/json-unwrapper.js`: parsing, recursive expansion, diagnostics, and formatting.
- Create `src/utools-adapter.js`: uTools entry and clipboard boundary with browser fallback.
- Create `src/app.js`: DOM state, actions, warnings, automatic processing, and shortcuts.
- Create `tests/json-unwrapper.test.js`: parser behavior and edge cases.
- Create `tests/utools-adapter.test.js`: adapter behavior with stubbed uTools APIs.
- Create `assets/logo.svg`: editable source artwork.
- Create `assets/logo.png`: 256×256 marketplace/plugin icon rendered from the SVG.
- Create `README.md`: local development, uTools attachment, testing, and usage.
- Create `docs/marketplace.md`: title, summary, release copy, screenshots, and submission checklist.
- Create `docs/privacy.md`: local-only privacy statement.

### Task 1: Establish the testable parser contract

**Files:**
- Create: `package.json`
- Create: `tests/json-unwrapper.test.js`
- Create: `src/json-unwrapper.js`

- [ ] **Step 1: Add the Node test configuration**

Create `package.json`:

```json
{
  "name": "utools-json-unwrapper",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 2: Write failing tests for valid input and one-level expansion**

Create `tests/json-unwrapper.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { JsonInputError, unwrapJsonText } from '../src/json-unwrapper.js'

test('formats a regular JSON object without changing values', () => {
  const result = unwrapJsonText('{"name":"小明","active":true}')

  assert.deepEqual(result.value, { name: '小明', active: true })
  assert.equal(result.text, '{\n  "name": "小明",\n  "active": true\n}')
  assert.equal(result.expandedCount, 0)
  assert.deepEqual(result.warnings, [])
})

test('expands a stringified object field', () => {
  const input = JSON.stringify({ data: JSON.stringify({ id: 7 }) })
  const result = unwrapJsonText(input)

  assert.deepEqual(result.value, { data: { id: 7 } })
  assert.equal(result.expandedCount, 1)
})

test('rejects malformed outer JSON', () => {
  assert.throws(
    () => unwrapJsonText('{"broken":}'),
    (error) => error instanceof JsonInputError && error.code === 'INVALID_OUTER_JSON'
  )
})
```

- [ ] **Step 3: Run the parser tests and verify the expected failure**

Run: `npm test -- tests/json-unwrapper.test.js`

Expected: FAIL because `src/json-unwrapper.js` does not exist.

- [ ] **Step 4: Implement the minimal parser and public error type**

Create `src/json-unwrapper.js`:

```js
export class JsonInputError extends Error {
  constructor(code, message, cause) {
    super(message, { cause })
    this.name = 'JsonInputError'
    this.code = code
  }
}

function isContainer(value) {
  return value !== null && typeof value === 'object'
}

function isJsonContainerCandidate(value) {
  if (typeof value !== 'string') return false
  const firstCharacter = value.trimStart()[0]
  return firstCharacter === '{' || firstCharacter === '['
}

export function unwrapJsonText(input) {
  let parsed
  try {
    parsed = JSON.parse(input)
  } catch (error) {
    throw new JsonInputError('INVALID_OUTER_JSON', `外层 JSON 解析失败：${error.message}`, error)
  }

  if (!isContainer(parsed)) {
    throw new JsonInputError('OUTER_NOT_CONTAINER', '输入必须是 JSON 对象或数组')
  }

  let expandedCount = 0
  const value = Array.isArray(parsed) ? [...parsed] : { ...parsed }

  for (const key of Object.keys(value)) {
    const candidate = value[key]
    if (!isJsonContainerCandidate(candidate)) continue
    try {
      const nested = JSON.parse(candidate)
      if (isContainer(nested)) {
        value[key] = nested
        expandedCount += 1
      }
    } catch {
      // Detailed warnings are introduced in Task 2.
    }
  }

  return {
    value,
    text: JSON.stringify(value, null, 2),
    expandedCount,
    warnings: []
  }
}
```

- [ ] **Step 5: Run tests and verify the baseline passes**

Run: `npm test -- tests/json-unwrapper.test.js`

Expected: 3 tests pass, 0 fail.

- [ ] **Step 6: Commit the parser baseline**

```bash
git add package.json src/json-unwrapper.js tests/json-unwrapper.test.js
git commit -m "feat: add JSON unwrap parser baseline"
```

### Task 2: Complete recursive expansion and diagnostics

**Files:**
- Modify: `tests/json-unwrapper.test.js`
- Modify: `src/json-unwrapper.js`

- [ ] **Step 1: Add failing recursive, preservation, warning, and limit tests**

Append to `tests/json-unwrapper.test.js`:

```js
test('recursively expands objects and arrays at every level', () => {
  const input = JSON.stringify({
    data: JSON.stringify({
      profile: JSON.stringify({ name: '小明' }),
      items: JSON.stringify([JSON.stringify({ id: 1 }), 2])
    })
  })
  const result = unwrapJsonText(input)

  assert.deepEqual(result.value, {
    data: { profile: { name: '小明' }, items: [{ id: 1 }, 2] }
  })
  assert.equal(result.expandedCount, 4)
})

test('unwraps a top-level JSON string until it reaches a container', () => {
  const encoded = JSON.stringify(JSON.stringify({ payload: JSON.stringify([]) }))
  const result = unwrapJsonText(encoded)

  assert.deepEqual(result.value, { payload: [] })
  assert.equal(result.expandedCount, 2)
})

test('does not convert JSON primitive strings', () => {
  const result = unwrapJsonText('{"number":"123","bool":"true","nil":"null"}')
  assert.deepEqual(result.value, { number: '123', bool: 'true', nil: 'null' })
})

test('keeps malformed nested JSON and reports its path', () => {
  const result = unwrapJsonText('{"data":{"payload":"{broken}"}}')

  assert.equal(result.value.data.payload, '{broken}')
  assert.deepEqual(result.warnings, [
    { code: 'INVALID_NESTED_JSON', path: '$.data.payload', message: '疑似 JSON 的字符串无法解析' }
  ])
})

test('handles empty containers, Unicode, and escaped text', () => {
  const nested = JSON.stringify({ emptyObject: {}, emptyArray: [], text: '中文😀\\n' })
  const result = unwrapJsonText(JSON.stringify({ nested }))

  assert.deepEqual(result.value, {
    nested: { emptyObject: {}, emptyArray: [], text: '中文😀\\n' }
  })
})

test('stops at the configured depth and reports the path', () => {
  const input = JSON.stringify({ a: { b: JSON.stringify({ c: 1 }) } })
  const result = unwrapJsonText(input, { maxDepth: 1 })

  assert.equal(result.value.a.b, JSON.stringify({ c: 1 }))
  assert.deepEqual(result.warnings, [
    { code: 'DEPTH_LIMIT', path: '$.a', message: '已达到最大递归深度 1' }
  ])
})

test('rejects a valid JSON primitive at the top level', () => {
  assert.throws(
    () => unwrapJsonText('"123"'),
    (error) => error instanceof JsonInputError && error.code === 'OUTER_NOT_CONTAINER'
  )
})
```

- [ ] **Step 2: Run tests and verify recursive cases fail**

Run: `npm test -- tests/json-unwrapper.test.js`

Expected: the new recursion, top-level string, warning, and depth tests fail.

- [ ] **Step 3: Replace the baseline traversal with the complete implementation**

Replace `src/json-unwrapper.js` with:

```js
export class JsonInputError extends Error {
  constructor(code, message, cause) {
    super(message, { cause })
    this.name = 'JsonInputError'
    this.code = code
  }
}

function isContainer(value) {
  return value !== null && typeof value === 'object'
}

function isJsonContainerCandidate(value) {
  if (typeof value !== 'string') return false
  const firstCharacter = value.trimStart()[0]
  return firstCharacter === '{' || firstCharacter === '['
}

function childPath(parent, key, isArray) {
  return isArray ? `${parent}[${key}]` : `${parent}.${key}`
}

export function unwrapJsonText(input, { maxDepth = 100 } = {}) {
  if (!Number.isInteger(maxDepth) || maxDepth < 0) {
    throw new TypeError('maxDepth 必须是非负整数')
  }

  let parsed
  try {
    parsed = JSON.parse(input)
  } catch (error) {
    throw new JsonInputError('INVALID_OUTER_JSON', `外层 JSON 解析失败：${error.message}`, error)
  }

  let expandedCount = 0
  for (let depth = 0; typeof parsed === 'string' && isJsonContainerCandidate(parsed); depth += 1) {
    if (depth >= maxDepth) {
      throw new JsonInputError('OUTER_DEPTH_LIMIT', `外层字符串解析超过最大深度 ${maxDepth}`)
    }
    try {
      parsed = JSON.parse(parsed)
      expandedCount += 1
    } catch (error) {
      throw new JsonInputError('INVALID_OUTER_JSON', `外层 JSON 字符串解析失败：${error.message}`, error)
    }
  }

  if (!isContainer(parsed)) {
    throw new JsonInputError('OUTER_NOT_CONTAINER', '输入必须是 JSON 对象或数组')
  }

  const warnings = []

  function visit(value, path, depth) {
    if (typeof value === 'string' && isJsonContainerCandidate(value)) {
      let nested
      try {
        nested = JSON.parse(value)
      } catch {
        warnings.push({
          code: 'INVALID_NESTED_JSON',
          path,
          message: '疑似 JSON 的字符串无法解析'
        })
        return value
      }

      if (isContainer(nested)) {
        expandedCount += 1
        return visit(nested, path, depth)
      }
      return value
    }

    if (!isContainer(value)) return value

    if (depth >= maxDepth) {
      warnings.push({
        code: 'DEPTH_LIMIT',
        path,
        message: `已达到最大递归深度 ${maxDepth}`
      })
      return value
    }

    const isArray = Array.isArray(value)
    const output = isArray ? [] : {}
    for (const key of Object.keys(value)) {
      output[key] = visit(value[key], childPath(path, key, isArray), depth + 1)
    }
    return output
  }

  const value = visit(parsed, '$', 0)
  return {
    value,
    text: JSON.stringify(value, null, 2),
    expandedCount,
    warnings
  }
}
```

- [ ] **Step 4: Run the full parser suite**

Run: `npm test -- tests/json-unwrapper.test.js`

Expected: 10 tests pass, 0 fail.

- [ ] **Step 5: Commit recursive parsing**

```bash
git add src/json-unwrapper.js tests/json-unwrapper.test.js
git commit -m "feat: recursively unwrap nested JSON strings"
```

### Task 3: Isolate the uTools integration boundary

**Files:**
- Create: `tests/utools-adapter.test.js`
- Create: `src/utools-adapter.js`

- [ ] **Step 1: Write failing adapter tests**

Create `tests/utools-adapter.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createUtoolsAdapter } from '../src/utools-adapter.js'

test('passes text payloads from onPluginEnter to the application', () => {
  let enterCallback
  const api = {
    onPluginEnter(callback) { enterCallback = callback },
    copyText() { return true }
  }
  const received = []
  const adapter = createUtoolsAdapter(api)
  adapter.onTextEnter((text) => received.push(text))

  enterCallback({ type: 'over', payload: '{"a":1}' })
  enterCallback({ type: 'img', payload: 'ignored' })

  assert.deepEqual(received, ['{"a":1}'])
})

test('reports clipboard success and failure', () => {
  assert.equal(createUtoolsAdapter({ copyText: () => true }).copyText('ok'), true)
  assert.equal(createUtoolsAdapter({ copyText: () => false }).copyText('no'), false)
  assert.equal(createUtoolsAdapter(undefined).copyText('browser'), false)
})
```

- [ ] **Step 2: Run adapter tests and verify they fail**

Run: `npm test -- tests/utools-adapter.test.js`

Expected: FAIL because `src/utools-adapter.js` does not exist.

- [ ] **Step 3: Implement the adapter**

Create `src/utools-adapter.js`:

```js
export function createUtoolsAdapter(api = globalThis.utools) {
  return {
    onTextEnter(callback) {
      if (!api?.onPluginEnter) return
      api.onPluginEnter(({ type, payload }) => {
        if ((type === 'over' || type === 'regex' || type === 'text') && typeof payload === 'string') {
          callback(payload)
        }
      })
    },

    copyText(text) {
      if (!api?.copyText) return false
      return api.copyText(text) === true
    }
  }
}
```

- [ ] **Step 4: Run the complete automated suite**

Run: `npm test`

Expected: 12 tests pass, 0 fail.

- [ ] **Step 5: Commit the adapter**

```bash
git add src/utools-adapter.js tests/utools-adapter.test.js
git commit -m "feat: add uTools integration adapter"
```

### Task 4: Build the side-by-side application shell

**Files:**
- Create: `index.html`
- Create: `styles.css`

- [ ] **Step 1: Create the accessible HTML structure**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>JSON 解构</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <main class="app-shell">
    <header class="toolbar">
      <div><h1>JSON 解构</h1><p id="status" role="status">粘贴 JSON 后开始处理</p></div>
      <div class="actions">
        <button id="clear-button" class="secondary" type="button">清空</button>
        <button id="copy-button" class="secondary" type="button" disabled>复制结果</button>
        <button id="run-button" type="button">解构并复制</button>
      </div>
    </header>
    <section class="workspace">
      <article class="pane">
        <label for="source">原始 JSON</label>
        <textarea id="source" spellcheck="false" placeholder='粘贴包含转义字段的 JSON，例如 {"data":"{\"id\":1}"}'></textarea>
      </article>
      <article class="pane">
        <div class="pane-label">解构结果</div>
        <pre id="result" tabindex="0" aria-label="解构结果"></pre>
      </article>
    </section>
    <aside id="warning-panel" class="warning-panel" hidden>
      <strong>以下路径未能完全展开</strong>
      <ul id="warnings"></ul>
    </aside>
  </main>
  <script type="module" src="./src/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Add responsive, theme-aware styling**

Create `styles.css`:

```css
:root {
  color-scheme: light dark;
  --background: #f4f6fa;
  --surface: #ffffff;
  --border: #d9deea;
  --text: #172033;
  --muted: #667085;
  --primary: #5b5bd6;
  --primary-hover: #4747bd;
  --success: #14804a;
  --warning: #a15c00;
  --warning-bg: #fff7e6;
  --error: #c4320a;
  --focus: #7f7ff0;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #11141b;
    --surface: #1b202b;
    --border: #343b4a;
    --text: #f1f4f9;
    --muted: #a9b1c1;
    --primary: #8585ef;
    --primary-hover: #9b9bf4;
    --success: #57c78b;
    --warning: #f4b860;
    --warning-bg: #302617;
    --error: #ff8a65;
    --focus: #a5a5ff;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-width: 360px;
  background: var(--background);
  color: var(--text);
  font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button, textarea { font: inherit; }

button {
  border: 0;
  border-radius: 8px;
  padding: 9px 14px;
  color: white;
  background: var(--primary);
  cursor: pointer;
}

button:hover { background: var(--primary-hover); }
button.secondary { color: var(--text); background: transparent; border: 1px solid var(--border); }
button:disabled { cursor: not-allowed; opacity: .45; }
button:focus-visible, textarea:focus-visible, pre:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }

.app-shell { min-height: 100vh; padding: 18px; }
.toolbar { min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.toolbar h1 { margin: 0; font-size: 20px; }
#status { margin: 3px 0 0; color: var(--muted); }
#status[data-kind="success"] { color: var(--success); }
#status[data-kind="warning"] { color: var(--warning); }
#status[data-kind="error"] { color: var(--error); }
.actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }

.workspace { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
.pane { min-width: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.pane label, .pane-label { display: block; padding: 10px 14px; border-bottom: 1px solid var(--border); color: var(--muted); font-weight: 650; }
textarea, pre {
  display: block;
  width: 100%;
  min-height: 360px;
  margin: 0;
  padding: 14px;
  overflow: auto;
  border: 0;
  background: transparent;
  color: var(--text);
  white-space: pre;
  tab-size: 2;
  font: 13px/1.65 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
textarea { resize: vertical; outline: 0; }
.warning-panel { margin-top: 14px; padding: 12px 14px; border: 1px solid var(--warning); border-radius: 10px; background: var(--warning-bg); color: var(--warning); }
.warning-panel ul { margin: 6px 0 0; padding-left: 22px; }

@media (max-width: 720px) {
  .app-shell { padding: 12px; }
  .toolbar { align-items: flex-start; flex-direction: column; padding-bottom: 14px; }
  .actions { justify-content: flex-start; }
  .workspace { grid-template-columns: 1fr; }
  textarea, pre { min-height: 260px; }
}
```

- [ ] **Step 3: Inspect the static page in a regular browser**

Run: `python3 -m http.server 4173`

Open: `http://localhost:4173`

Expected: two equal panes at desktop width, stacked panes below 720 px, legible light and dark themes, and no horizontal page overflow.

- [ ] **Step 4: Commit the application shell**

```bash
git add index.html styles.css
git commit -m "feat: add responsive JSON comparison interface"
```

### Task 5: Connect parsing, rendering, copying, and shortcuts

**Files:**
- Create: `src/app.js`
- Modify: `index.html`

- [ ] **Step 1: Implement the DOM controller**

Create `src/app.js`:

```js
import { JsonInputError, unwrapJsonText } from './json-unwrapper.js'
import { createUtoolsAdapter } from './utools-adapter.js'

const adapter = createUtoolsAdapter()
const source = document.querySelector('#source')
const result = document.querySelector('#result')
const status = document.querySelector('#status')
const runButton = document.querySelector('#run-button')
const copyButton = document.querySelector('#copy-button')
const clearButton = document.querySelector('#clear-button')
const warningPanel = document.querySelector('#warning-panel')
const warnings = document.querySelector('#warnings')

function setStatus(message, kind = 'neutral') {
  status.textContent = message
  status.dataset.kind = kind
}

function renderWarnings(items) {
  warnings.replaceChildren(...items.map((item) => {
    const entry = document.createElement('li')
    entry.textContent = `${item.path}：${item.message}`
    return entry
  }))
  warningPanel.hidden = items.length === 0
}

function copyResult() {
  if (!result.textContent) return false
  const copied = adapter.copyText(result.textContent)
  setStatus(copied ? '已复制结果' : '无法自动复制，请手动复制结果', copied ? 'success' : 'warning')
  return copied
}

function processSource() {
  if (!source.value.trim()) {
    setStatus('请先粘贴 JSON', 'error')
    source.focus()
    return
  }

  try {
    const unwrapped = unwrapJsonText(source.value)
    result.textContent = unwrapped.text
    copyButton.disabled = false
    renderWarnings(unwrapped.warnings)
    const copied = adapter.copyText(unwrapped.text)
    const detail = unwrapped.expandedCount === 0
      ? '未发现可展开的嵌套 JSON 字符串'
      : `已展开 ${unwrapped.expandedCount} 个字段`
    setStatus(`${detail}${copied ? '，已复制' : '，请手动复制'}`, copied ? 'success' : 'warning')
  } catch (error) {
    renderWarnings([])
    const message = error instanceof JsonInputError ? error.message : '处理失败，请检查输入'
    setStatus(message, 'error')
  }
}

runButton.addEventListener('click', processSource)
copyButton.addEventListener('click', copyResult)
clearButton.addEventListener('click', () => {
  source.value = ''
  result.textContent = ''
  copyButton.disabled = true
  renderWarnings([])
  setStatus('已清空，等待输入')
  source.focus()
})

document.addEventListener('keydown', (event) => {
  const command = event.metaKey || event.ctrlKey
  if (command && event.key === 'Enter') {
    event.preventDefault()
    processSource()
  }
  if (command && event.shiftKey && event.key.toLowerCase() === 'c') {
    event.preventDefault()
    copyResult()
  }
})

adapter.onTextEnter((payload) => {
  source.value = payload
  processSource()
})

source.focus()
```

- [ ] **Step 2: Verify browser fallback behavior**

Open the local page, paste `{"data":"{\"id\":1}"}`, and click “解构并复制”.

Expected: the right pane shows a nested `data` object, status says automatic copying is unavailable, manual result selection remains possible, clear resets both panes, and both shortcuts work.

- [ ] **Step 3: Run all automated tests**

Run: `npm test`

Expected: 12 tests pass, 0 fail.

- [ ] **Step 4: Commit the working UI**

```bash
git add src/app.js
git commit -m "feat: connect JSON processing interface"
```

### Task 6: Add uTools metadata and publication assets

**Files:**
- Create: `plugin.json`
- Create: `assets/logo.svg`
- Create: `assets/logo.png`
- Create: `README.md`
- Create: `docs/marketplace.md`
- Create: `docs/privacy.md`

- [ ] **Step 1: Add the uTools manifest**

Create `plugin.json`:

```json
{
  "logo": "assets/logo.png",
  "main": "index.html",
  "pluginSetting": {
    "height": 620
  },
  "features": [
    {
      "code": "json-unwrapper",
      "explain": "递归展开被转义的 JSON 对象和数组",
      "cmds": [
        "JSON 解构",
        "递归解析 JSON",
        {
          "type": "over",
          "label": "递归解构 JSON",
          "minLength": 2,
          "maxLength": 100000
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Create and render the icon**

Create `assets/logo.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="52" fill="#5B5BD6"/>
  <path d="M94 52H78c-14 0-22 8-22 22v28c0 13-6 21-18 25 12 4 18 12 18 25v30c0 14 8 22 22 22h16" fill="none" stroke="#FFF" stroke-width="15" stroke-linecap="round"/>
  <path d="M162 52h16c14 0 22 8 22 22v28c0 13 6 21 18 25-12 4-18 12-18 25v30c0 14-8 22-22 22h-16" fill="none" stroke="#FFF" stroke-width="15" stroke-linecap="round"/>
  <path d="M106 88h44M106 128h44M106 168h44" stroke="#B8F5D0" stroke-width="9" stroke-linecap="round"/>
  <circle cx="96" cy="88" r="7" fill="#B8F5D0"/>
  <circle cx="96" cy="128" r="7" fill="#B8F5D0"/>
  <circle cx="96" cy="168" r="7" fill="#B8F5D0"/>
</svg>
```

Render and verify on macOS:

```bash
sips -s format png assets/logo.svg --out assets/logo.png
sips -z 256 256 assets/logo.png
sips -g pixelWidth -g pixelHeight -g format assets/logo.png
```

Expected: width `256`, height `256`, format `png`. If `sips` cannot read SVG, use the bundled workspace image runtime to render the same SVG without changing the artwork.

- [ ] **Step 3: Write user and developer documentation**

Create `README.md`:

```markdown
# JSON 解构 for uTools

一键递归展开 JSON 中被字符串化、转义的对象和数组。全部处理在本地完成。

## 功能

- 递归展开对象、数组和多层 JSON 字符串。
- 左右对照原始输入和格式化结果。
- 从 uTools 匹配文本直接处理，成功后自动复制。
- 保留无法解析的嵌套字符串并显示字段路径。
- 支持深浅主题和窄窗口布局。

## 使用方法

1. 在任意应用复制 JSON，呼出 uTools，选择“递归解构 JSON”；或搜索“JSON 解构”打开插件后粘贴内容。
2. 点击“解构并复制”。
3. 在右侧核对结果；成功结果会自动写入剪贴板。

快捷键：`Command/Ctrl+Enter` 执行，`Command/Ctrl+Shift+C` 复制结果。

插件仅接受严格 JSON，不支持注释、单引号、尾逗号或未加引号的键。字符串 `"123"`、`"true"` 和 `"null"` 不会被转换。

## 本地预览

```bash
python3 -m http.server 4173
```

访问 `http://localhost:4173`。普通浏览器无法调用 uTools 剪贴板 API，因此会提示手动复制。

## 运行测试

```bash
npm test
```

## 接入 uTools

1. 打开 uTools 开发者工具并新建插件应用。
2. 在应用开发页选择本项目根目录的 `plugin.json`。
3. 点击“接入开发”，再点击“打开”。

## 打包 UPXS

完成冒烟测试后，在 uTools 开发者工具点击“打包”，填写版本 `1.0.0` 并选择保存位置。UPXS 适合本地验收和内部测试。

## 发布到应用市场

在开发者工具点击“发布”，确认版本目录，填写 `docs/marketplace.md` 中准备的应用介绍、版本说明和截图，然后提交审核。审核通过后插件才会出现在应用市场。
```

Create `docs/privacy.md` with this statement:

```markdown
# 隐私说明

JSON 解构的全部处理均在用户设备本地完成。插件不会上传、存储、记录或分享用户输入，不会发起网络请求，也不包含分析统计或用户追踪功能。处理成功后，结果仅按用户触发的功能写入系统剪贴板。
```

Create `docs/marketplace.md` with:

```markdown
# uTools 应用市场素材

## 应用名称
JSON 解构

## 一句话简介
一键递归展开多层转义的 JSON 对象和数组。

## 首版说明
支持复制文本直接唤起、左右对照、自动复制、嵌套错误路径提示以及深浅主题。

## 截图清单
1. 多层 JSON 解构前后对照。
2. 复制文本后自动处理并复制成功。
3. 嵌套字段解析失败时的路径提示。

## 提交检查
- [ ] `npm test` 全部通过。
- [ ] macOS 冒烟测试通过。
- [ ] Windows 冒烟测试通过或在说明中标注未验证。
- [ ] Logo、简介、版本说明、用户手册和截图齐全。
- [ ] 发布目录仅包含运行所需文件。
- [ ] 版本号符合 semver。
```

- [ ] **Step 4: Validate the manifest and asset paths**

Run:

```bash
node -e "const p=JSON.parse(require('fs').readFileSync('plugin.json')); if(!p.main||!p.logo||!p.features?.length) process.exit(1); console.log('plugin.json valid')"
test -f index.html && test -f assets/logo.png
```

Expected: `plugin.json valid` and exit code 0.

- [ ] **Step 5: Commit release metadata**

```bash
git add plugin.json assets README.md docs/marketplace.md docs/privacy.md
git commit -m "docs: prepare uTools marketplace release"
```

### Task 7: Perform final verification and prepare the release handoff

**Files:**
- Modify: `README.md` only if verification reveals inaccurate instructions.
- Modify: `docs/marketplace.md` to record verified platforms and screenshot completion.

- [ ] **Step 1: Run the complete test suite from a clean command**

Run: `npm test`

Expected: 12 tests pass, 0 fail, with no skipped tests.

- [ ] **Step 2: Validate JSON and required files**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('plugin.json')); JSON.parse(require('fs').readFileSync('package.json')); console.log('JSON files valid')"
for file in index.html styles.css src/app.js src/json-unwrapper.js src/utools-adapter.js assets/logo.png; do test -s "$file" || exit 1; done
```

Expected: `JSON files valid` and exit code 0.

- [ ] **Step 3: Attach the plugin in uTools Developer Tools**

Select the repository's `plugin.json`, click “接入开发”, and open the plugin.

Expected: the plugin opens without console errors, renders the side-by-side layout, and follows the system color scheme.

- [ ] **Step 4: Execute the uTools smoke-test matrix**

Verify all of these manually:

1. Open via “JSON 解构”, paste valid input, run, and confirm automatic clipboard output.
2. Copy valid JSON in another application, invoke the matched “递归解构 JSON” command, and confirm automatic processing.
3. Submit malformed outer JSON and confirm the clipboard remains unchanged.
4. Submit malformed nested JSON and confirm other fields expand while its path is listed.
5. Test `Command/Ctrl+Enter`, `Command/Ctrl+Shift+C`, clear, narrow layout, and dark mode.

Expected: every item passes on each available target platform.

- [ ] **Step 5: Generate the offline package and screenshots**

In uTools Developer Tools, click “打包”, enter version `1.0.0`, and save the UPXS file outside the source directory. Capture the three screenshots listed in `docs/marketplace.md` without showing sensitive JSON.

Expected: the UPXS installs locally after the uTools security confirmation and reproduces the smoke-test results.

- [ ] **Step 6: Record verification and commit any documentation updates**

Update `docs/marketplace.md` checkboxes only for steps actually verified, then run:

```bash
git add README.md docs/marketplace.md
git commit -m "chore: record uTools release verification"
```

If no documentation changed, skip this commit and record the verification evidence in the task handoff.

- [ ] **Step 7: Submit to the application marketplace**

While logged into the owner's uTools developer account, click “发布”, select the verified source folder, enter version `1.0.0`, add the prepared description and screenshots, and click “提交审核”.

Expected: uTools shows the submitted version in “发布历史”. Marketplace availability occurs only after official approval.
