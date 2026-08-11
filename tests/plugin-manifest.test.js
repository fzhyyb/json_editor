import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(projectRoot, 'plugin.json'), 'utf8'));

test('manifest references the plugin entry point, logo, and feature assets', () => {
  assert.equal(manifest.main, 'index.html');
  assert.equal(manifest.logo, 'assets/logo.png');
  assert.ok(Array.isArray(manifest.features));
  assert.ok(manifest.features.some(({ code }) => code === 'json-unwrapper'));
  assert.equal(existsSync(path.join(projectRoot, manifest.main)), true);
  assert.equal(existsSync(path.join(projectRoot, manifest.logo)), true);
});

test('copied-text command matches JSON container starts but rejects unrelated text', () => {
  const feature = manifest.features.find(({ code }) => code === 'json-unwrapper');
  const command = feature.cmds.find((item) => typeof item === 'object');

  assert.deepEqual(
    {
      type: command.type,
      label: command.label,
      minLength: command.minLength,
      maxLength: command.maxLength,
    },
    {
      type: 'regex',
      label: '递归解构 JSON',
      minLength: 2,
      maxLength: 100000,
    },
  );

  assert.match(command.match, /^\/.*\/[dgimsuvy]*$/s);
  const closingSlash = command.match.lastIndexOf('/');
  assert.ok(closingSlash > 0);
  const source = command.match.slice(1, closingSlash);
  const flags = command.match.slice(closingSlash + 1);
  const matcher = new RegExp(source, flags);
  const directObject = JSON.stringify({ value: 1 });
  const directArray = JSON.stringify([1, 2]);
  const oneLayerStringifiedObject = JSON.stringify(directObject);
  const twoLayerStringifiedObject = JSON.stringify(oneLayerStringifiedObject);

  for (const input of [
    directObject,
    `  ${directArray}`,
    oneLayerStringifiedObject,
    twoLayerStringifiedObject,
  ]) {
    assert.equal(matcher.test(input), true, `expected a match for ${input}`);
  }

  assert.equal(matcher.test('ordinary prose'), false);
  assert.equal(matcher.test('https://example.com/data.json'), false);
});
