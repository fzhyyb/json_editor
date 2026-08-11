# JSON Compatibility and Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse the supplied non-standard JSON samples, separate parsing from copying, and remove the practical uTools text-entry length ceiling.

**Architecture:** Add one strict-first tolerant parsing helper inside the pure JSON module and reuse it at every existing `JSON.parse` boundary. Keep the UI controller responsible for parsing and copying as separate user actions. Preserve the uTools text matcher by setting its optional maximum to JavaScript's maximum safe integer instead of omitting it, because omission restores uTools' 10,000-character default.

**Tech Stack:** Browser JavaScript ES modules, Node.js built-in test runner, uTools `plugin.json`.

---

### Task 1: Tolerant JSON escape parsing

**Files:**
- Modify: `tests/json-unwrapper.test.js`
- Modify: `src/json-unwrapper.js`

- [ ] **Step 1: Write failing parser tests**

Add tests asserting that `unwrapJsonText('{"url":"a\\&b"}')` returns `{ url: 'a&b' }`, a nested stringified object containing `\&` is expanded, valid JSON escapes remain unchanged, and structural errors still throw `INVALID_OUTER_JSON`.

- [ ] **Step 2: Verify the new tests fail**

Run `node --test tests/json-unwrapper.test.js`; expect the `\&` cases to fail with `INVALID_OUTER_JSON` or `INVALID_NESTED_JSON`.

- [ ] **Step 3: Implement strict-first parsing**

Add a scanner that tracks whether it is inside a quoted JSON string. Preserve `\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r`, `\t`, and valid `\uXXXX`; remove only the backslash from unsupported `\X`. Add `parseJson(text)` that first calls `JSON.parse(text)`, repairs only after failure, and retries only when at least one repair occurred. Replace the three direct parsing boundaries in `unwrapJsonText` with this helper.

- [ ] **Step 4: Verify parser tests pass**

Run `node --test tests/json-unwrapper.test.js`; expect all parser tests to pass.

### Task 2: Separate parse and copy, expand matcher length

**Files:**
- Modify: `tests/app.test.js`
- Modify: `tests/ui-structure.test.js`
- Modify: `tests/plugin-manifest.test.js`
- Modify: `src/app.js`
- Modify: `index.html`
- Modify: `plugin.json`

- [ ] **Step 1: Write failing UI and manifest tests**

Assert that clicking `run-button` with a successful clipboard adapter does not invoke `copyText`, reports only the parse result, and enables `copy-button`. Assert that clicking `copy-button` invokes `copyText` exactly once. Assert the primary button text is `解析`, no textarea `maxlength` exists, and the manifest command uses `maxLength: 9007199254740991`.

- [ ] **Step 2: Verify the new tests fail**

Run `node --test tests/app.test.js tests/ui-structure.test.js tests/plugin-manifest.test.js`; expect failures for auto-copy, button text, and old `100000` limit.

- [ ] **Step 3: Implement separate controls**

Remove `safeCopyText(unwrapped.text)` from `processSource`. Set parse success status to `已展开 N 个字段` or `未发现可展开的嵌套 JSON 字符串`, with the existing warning suffix and status kind based only on warnings. Change the primary button label to `解析`. Keep `copyResult` and its shortcut unchanged. Set the manifest maximum to `9007199254740991`.

- [ ] **Step 4: Verify UI and manifest tests pass**

Run `node --test tests/app.test.js tests/ui-structure.test.js tests/plugin-manifest.test.js`; expect all tests to pass.

### Task 3: Documentation, sample regression, and release

**Files:**
- Modify: `README.md`
- Modify: `docs/privacy.md`
- Modify: `docs/marketplace.md`
- Modify: `docs/superpowers/specs/2026-08-11-tolerant-json-escape-repair-design.md`
- Regenerate: `release/utools-json-unwrapper/**`

- [ ] **Step 1: Update user-facing documentation**

Replace automatic-copy wording with explicit parse then copy behavior. Document strict JSON with compatibility for unsupported single-character escapes inside strings, practical unlimited text input, and unchanged 100-level recursion safety limit.

- [ ] **Step 2: Run the supplied sample regressions**

Invoke `unwrapJsonText` on all three supplied files. Assert zero warnings and verify `content/form`, `ActionDefinitionsJSON/LegacyJSON/NodesJSON`, and `form_card/nodes_json` are objects or arrays as expected.

- [ ] **Step 3: Run the full verification suite**

Run `npm test`, syntax-check runtime JavaScript, and run `git diff --check`; expect zero failures or syntax errors.

- [ ] **Step 4: Rebuild and verify the local release**

Run `npm run build:release`. Confirm the release contains exactly seven runtime files and that its `plugin.json`, `index.html`, and JavaScript match the verified source behavior.
