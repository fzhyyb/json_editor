# Naked Escaped JSON Recognition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically recognize and restore naked escaped JSON such as `{\"mode\":\"A\"}` while preserving existing strict JSON behavior.

**Architecture:** Add one focused decoder in `json-unwrapper.js` that only accepts brace- or bracket-bounded text whose missing outer JSON string quotes can be restored and whose decoded value is a valid JSON container. Reuse it as a fallback in recursive parsing and the explicit unescape operation; formatting and minification continue to use the existing parser unchanged.

**Tech Stack:** JavaScript ES modules, Node.js `node:test`, CodeMirror controller adapters, esbuild.

---

### Task 1: Decode naked escaped containers safely

**Files:**
- Modify: `src/json-unwrapper.js`
- Test: `tests/json-unwrapper.test.js`

- [ ] **Step 1: Write failing decoder and recursive parsing tests**

Add tests that import `decodeNakedEscapedJsonText` and assert:

```js
const original = JSON.stringify({ mode: 'A', pass: true });
const naked = original.replaceAll('"', '\\"');
assert.equal(decodeNakedEscapedJsonText(naked), original);
assert.deepEqual(unwrapJsonText(naked).value, { mode: 'A', pass: true });
```

Also cover arrays, nested JSON strings, truncated candidates, ordinary prose, and a candidate containing unescaped quotes.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/json-unwrapper.test.js`

Expected: FAIL because `decodeNakedEscapedJsonText` is not exported and `unwrapJsonText` rejects the naked input.

- [ ] **Step 3: Implement the minimal decoder and recursive fallback**

Add an exported decoder that:

```js
export function decodeNakedEscapedJsonText(input) {
  const text = input.trim();
  const isBounded = (text.startsWith('{') && text.endsWith('}'))
    || (text.startsWith('[') && text.endsWith(']'));
  if (!isBounded) throw new TypeError('输入不是裸转义 JSON 对象或数组');

  const decoded = JSON.parse(`"${text}"`);
  const value = parseJsonValue(decoded);
  if (!isContainer(value)) throw new TypeError('裸转义内容必须还原为 JSON 对象或数组');
  return decoded;
}
```

In `unwrapJsonText`, retain strict parsing first. Only when it fails, decode the naked escaped text and parse the decoded result. Count the restored outer layer consistently with an ordinary top-level JSON string.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/json-unwrapper.test.js`

Expected: all JSON unwrapper tests pass.

### Task 2: Support explicit unescape and automatic paste entry

**Files:**
- Modify: `src/editor-operations.js`
- Test: `tests/editor-operations.test.js`
- Test: `tests/app.test.js`

- [ ] **Step 1: Write failing operation and controller tests**

Add tests asserting that `unescapeJson` returns ordinary JSON text for `{\"mode\":\"A\"}`, while the controller automatically formats the same payload after a whole-document paste and after `handleTextEntry`.

Also assert that a valid ordinary object still raises `去转义目标必须是 JSON 字符串`, and malformed naked escaped input leaves the controller document unchanged.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/editor-operations.test.js tests/app.test.js`

Expected: the new naked-unescape assertions fail while existing tests remain green.

- [ ] **Step 3: Add the unescape fallback**

Import `decodeNakedEscapedJsonText` into `editor-operations.js`. Keep `JSON.parse(text)` as the first path. If it throws, call the decoder; if strict parsing succeeds with a non-string, preserve the existing `TypeError` without invoking the fallback.

No controller production change should be required because automatic paste and uTools entry already call `unwrapJsonText`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/editor-operations.test.js tests/app.test.js`

Expected: all focused tests pass.

### Task 3: Verify, package, and publish

**Files:**
- Generated locally: `dist/app.js`, `release/utools-json-unwrapper/`, `outputs/utools-json-editor-local-latest.zip`

- [ ] **Step 1: Verify the user sample**

Run a Node script that loads `/Users/bytedance/.codex/attachments/4b22a5f8-d589-4bbf-be2b-fc3f38a7d366/pasted-text.txt`, calls both `decodeNakedEscapedJsonText` and `unwrapJsonText`, and asserts the result contains `approval_code`, `status`, and an object `extra`.

- [ ] **Step 2: Run the full suite**

Run: `npm test`

Expected: zero failures.

- [ ] **Step 3: Build and package**

Run: `npm run build:release`, update `outputs/utools-json-editor-local-latest.zip`, and verify it with `unzip -t`.

- [ ] **Step 4: Commit and push**

```bash
git add src/json-unwrapper.js src/editor-operations.js tests/json-unwrapper.test.js tests/editor-operations.test.js tests/app.test.js docs/superpowers/plans/2026-08-17-naked-escaped-json.md
git commit -m "feat: recognize naked escaped JSON"
git push
```

Expected: local `main`, `origin/main`, and the remote `main` ref resolve to the same commit.
