# JSON Editor Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-pane JSON unwrapper with an offline CodeMirror 6 workbench that auto-parses pasted JSON and provides formatting, minification, escaping, unescaping, folding, search, validation, copying, and a friendlier interface.

**Architecture:** Keep JSON transforms in pure tested modules, wrap CodeMirror behind a small editor adapter, and inject that adapter into a workbench controller so uTools entry, paste, toolbar, status, and clipboard behavior are testable without a browser DOM. Bundle the browser composition entry and all CodeMirror dependencies into one local IIFE file with esbuild.

**Tech Stack:** JavaScript ES modules, CodeMirror 6, esbuild, Node.js built-in test runner, uTools plugin runtime.

---

### Task 1: Pure JSON editor operations

**Files:**
- Create: `src/editor-operations.js`
- Create: `tests/editor-operations.test.js`
- Modify: `src/json-unwrapper.js`
- Modify: `tests/json-unwrapper.test.js`

- [ ] **Step 1: Add failing tests for reusable parsing and transforms**

Test 2-space formatting without recursive expansion, minification without expansion, one-layer escaping, one-layer unescaping, unsupported `\&` compatibility, invalid input preservation through thrown errors, and primitives for format/minify.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run `node --test tests/editor-operations.test.js tests/json-unwrapper.test.js`. Expect import/export failures for the new operations.

- [ ] **Step 3: Export safe parsing/serialization primitives and implement operations**

Export `parseJsonValue(text)` and `serializeJsonValue(value, { pretty })` from `json-unwrapper.js`. Implement `formatJson`, `minifyJson`, `escapeJson`, `unescapeJson`, and `transformSelection(text, selection, operation)` in `editor-operations.js`. `transformSelection` uses the non-empty selection or the whole document and returns `{ text, selection }` for a single replacement transaction.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run the same focused command and expect all tests to pass.

### Task 2: Testable workbench controller

**Files:**
- Create: `src/workbench-controller.js`
- Replace: `tests/app.test.js`

- [ ] **Step 1: Add controller tests with a fake editor adapter**

Cover explicit recursive parse, uTools text entry auto-parse, empty/full-selection paste interception, partial paste pass-through, formatting, minification, selection-first escape/unescape, fold/search delegation, explicit copy, clear, operation errors preserving text, and status metadata updates.

- [ ] **Step 2: Run controller tests and confirm RED**

Run `node --test tests/app.test.js`. Expect the controller module import to fail.

- [ ] **Step 3: Implement `createWorkbenchController`**

Accept `{ editor, adapter, status, warnings }`. Register toolbar actions through named controller methods. Use one `replaceDocument` or `replaceSelection` adapter transaction per transform, call `unwrapJsonText` only for recursive parsing, and return `true` from `handlePaste(text)` only when the editor is empty or fully selected and the clipboard is successfully parsed.

- [ ] **Step 4: Run controller tests and confirm GREEN**

Run the same focused command and expect all tests to pass.

### Task 3: CodeMirror adapter and offline bundle

**Files:**
- Create: `src/editor-view.js`
- Replace: `src/app.js`
- Create: `scripts/build-app.mjs`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `scripts/build-release.mjs`
- Modify: `tests/release-build.test.js`

- [ ] **Step 1: Add failing release expectations**

Change the expected runtime set to `assets/logo.png`, `dist/app.js`, `index.html`, `plugin.json`, and `styles.css`. Assert the bundle exists, contains no remote URL dependency, and source modules are not copied separately.

- [ ] **Step 2: Install pinned editor/build dependencies**

Install `codemirror`, `@codemirror/lang-json`, `@codemirror/language`, `@codemirror/search`, `@codemirror/lint`, `@codemirror/view`, `@codemirror/state`, `@codemirror/commands`, and `esbuild`, recording exact resolved versions in `package-lock.json`.

- [ ] **Step 3: Implement the adapter and composition entry**

Create a CodeMirror view using `basicSetup`, `json()`, `linter(jsonParseLinter())`, top search, folding, line wrapping, themes, update listener, and paste handler. Expose the controller adapter methods for text, selection, transactions, focus, folding, search, cursor, and line count. Compose DOM controls and the uTools adapter in `app.js`.

- [ ] **Step 4: Implement browser bundling and release staging**

Build `src/app.js` to `dist/app.js` with esbuild using `bundle: true`, `format: 'iife'`, `platform: 'browser'`, `target: 'es2020'`, and minification. Make `npm run build:release` run the app build first. Stage only the five runtime files.

- [ ] **Step 5: Run build and release tests**

Run `npm run build:app` and `node --test tests/release-build.test.js`. Expect a local bundle and exact five-file release fixtures.

### Task 4: Friendly single-editor UI

**Files:**
- Replace: `index.html`
- Replace: `styles.css`
- Modify: `tests/ui-structure.test.js`
- Modify: `tests/plugin-manifest.test.js`

- [ ] **Step 1: Add failing structure tests**

Assert a single `#editor` mount, JSON validity badge, status metadata, all ten toolbar actions, accessible labels, no textarea, no `maxlength`, and a local `dist/app.js` script.

- [ ] **Step 2: Run structure tests and confirm RED**

Run `node --test tests/ui-structure.test.js tests/plugin-manifest.test.js`. Expect failures against the old two-pane HTML.

- [ ] **Step 3: Implement the approved workbench markup and styles**

Build the confirmed header, grouped toolbar, editor surface, warning region, feedback status, and bottom metadata bar. Style CodeMirror for full-height editing, light/dark themes, visible focus, responsive wrapping, search panel, diagnostics, and folding controls.

- [ ] **Step 4: Run structure tests and confirm GREEN**

Run the same focused command and expect all tests to pass.

### Task 5: Documentation, real samples, and final release

**Files:**
- Modify: `README.md`
- Modify: `docs/privacy.md`
- Modify: `docs/marketplace.md`
- Regenerate: `release/utools-json-unwrapper/**`
- Create: `outputs/utools-json-editor-local-latest.zip`

- [ ] **Step 1: Update documentation**

Document automatic full-document paste parsing, live validation, toolbar semantics, shortcuts, CodeMirror local bundling, explicit copying, practical unlimited input length, and the 100-level recursive safety limit.

- [ ] **Step 2: Run real-sample regression**

Run all three user attachments through the production recursive parser and verify expansion counts 18, 23, and 2 with zero warnings.

- [ ] **Step 3: Run full automated verification**

Run all current project tests explicitly, syntax-check source/build scripts, run `git diff --check`, build twice, and verify deterministic bundle/release hashes and exact runtime contents.

- [ ] **Step 4: Run local browser smoke tests**

Open the locally served release and verify automatic paste parsing, editing/validation, format, minify, escape/unescape, fold/unfold, search, copy fallback, clear, responsive layout, and zero console errors.

- [ ] **Step 5: Package the local deliverable**

Create `outputs/utools-json-editor-local-latest.zip`, list its contents, compute SHA-256, and provide the clickable output path.
