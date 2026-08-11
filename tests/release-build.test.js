import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildRelease } from '../scripts/build-release.mjs';

const expectedFiles = [
  'assets/logo.png',
  'index.html',
  'plugin.json',
  'src/app.js',
  'src/json-unwrapper.js',
  'src/utools-adapter.js',
  'styles.css',
];

async function listFiles(directory, relativeDirectory = '') {
  const entries = await readdir(path.join(directory, relativeDirectory), {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(directory, relativePath));
    } else {
      files.push(relativePath.split(path.sep).join('/'));
    }
  }

  return files.sort();
}

const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'json-unwrapper-release-'));
after(() => rm(temporaryRoot, { recursive: true, force: true }));

test('buildRelease replaces its output with the exact runtime file set', async () => {
  const outputDirectory = path.join(temporaryRoot, 'nested', 'utools-json-unwrapper');
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, 'stale.txt'), 'remove me');

  await buildRelease({ outputDirectory });

  assert.deepEqual(await listFiles(outputDirectory), expectedFiles);

  const manifest = JSON.parse(
    await readFile(path.join(outputDirectory, 'plugin.json'), 'utf8'),
  );
  assert.ok((await listFiles(outputDirectory)).includes(manifest.main));
  assert.ok((await listFiles(outputDirectory)).includes(manifest.logo));
});
