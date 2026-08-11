import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildRelease } from '../scripts/build-release.mjs';

const builderPath = fileURLToPath(new URL('../scripts/build-release.mjs', import.meta.url));
const expectedFiles = [
  'assets/logo.png',
  'index.html',
  'plugin.json',
  'src/app.js',
  'src/json-unwrapper.js',
  'src/utools-adapter.js',
  'styles.css',
];
const protectedFixtureFiles = [
  'docs/sentinel.txt',
  'scripts/sentinel.txt',
  'tests/sentinel.txt',
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

async function createFixture(t) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'json-unwrapper-release-'));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));

  const sourceDirectory = path.join(temporaryRoot, 'project');
  const sourceBytes = new Map();
  for (const relativePath of expectedFiles) {
    const bytes = Buffer.from(relativePath === 'plugin.json'
      ? JSON.stringify({ main: 'index.html', logo: 'assets/logo.png' })
      : `fixture:${relativePath}`);
    sourceBytes.set(relativePath, bytes);
    const sourcePath = path.join(sourceDirectory, relativePath);
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, bytes);
  }
  for (const relativePath of protectedFixtureFiles) {
    const bytes = Buffer.from(`fixture:${relativePath}`);
    sourceBytes.set(relativePath, bytes);
    const sourcePath = path.join(sourceDirectory, relativePath);
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, bytes);
  }
  await writeFile(path.join(sourceDirectory, 'sentinel.txt'), 'source-is-intact');

  return { temporaryRoot, sourceDirectory, sourceBytes };
}

async function assertSourceIsIntact(fixture) {
  assert.equal(
    await readFile(path.join(fixture.sourceDirectory, 'sentinel.txt'), 'utf8'),
    'source-is-intact',
  );
  for (const [relativePath, expectedBytes] of fixture.sourceBytes) {
    assert.deepEqual(
      await readFile(path.join(fixture.sourceDirectory, relativePath)),
      expectedBytes,
    );
  }
}

async function assertUnsafeOutputIsRejected(
  fixture,
  outputDirectory,
  sourceDirectory = fixture.sourceDirectory,
) {
  await assert.rejects(
    buildRelease({ sourceDirectory, outputDirectory }),
  );
  await assertSourceIsIntact(fixture);
}

async function assertReleaseFiles(sourceDirectory, outputDirectory) {
  assert.deepEqual(await listFiles(outputDirectory), expectedFiles);
  for (const relativePath of expectedFiles) {
    assert.deepEqual(
      await readFile(path.join(outputDirectory, relativePath)),
      await readFile(path.join(sourceDirectory, relativePath)),
    );
  }

  const manifest = JSON.parse(
    await readFile(path.join(outputDirectory, 'plugin.json'), 'utf8'),
  );
  assert.ok(expectedFiles.includes(manifest.main));
  assert.ok(expectedFiles.includes(manifest.logo));
}

test('buildRelease replaces a safe external output with exact runtime files', async (t) => {
  const fixture = await createFixture(t);
  const outputDirectory = path.join(fixture.temporaryRoot, 'external', 'release');
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, 'stale.txt'), 'remove me');

  await buildRelease({ sourceDirectory: fixture.sourceDirectory, outputDirectory });

  await assertReleaseFiles(fixture.sourceDirectory, outputDirectory);
});

test('buildRelease allows its safe default output inside a fake project', async (t) => {
  const fixture = await createFixture(t);
  const fixtureBuilderPath = path.join(fixture.sourceDirectory, 'scripts', 'build-release.mjs');
  await mkdir(path.dirname(fixtureBuilderPath), { recursive: true });
  await copyFile(builderPath, fixtureBuilderPath);
  const fixtureBuilder = await import(
    `${pathToFileURL(fixtureBuilderPath).href}?fixture=${Date.now()}`
  );

  const result = await fixtureBuilder.buildRelease();

  await assertReleaseFiles(fixture.sourceDirectory, result.outputDirectory);
});

test('buildRelease allows a named app strictly inside source release directory', async (t) => {
  const fixture = await createFixture(t);
  const outputDirectory = path.join(fixture.sourceDirectory, 'release', 'app');
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, 'stale.txt'), 'remove me');

  await buildRelease({ sourceDirectory: fixture.sourceDirectory, outputDirectory });

  await assertReleaseFiles(fixture.sourceDirectory, outputDirectory);
});

test('buildRelease rejects output equal to its source before deletion', async (t) => {
  const fixture = await createFixture(t);
  await assertUnsafeOutputIsRejected(fixture, fixture.sourceDirectory);
});

test('buildRelease rejects an ancestor of its source before deletion', async (t) => {
  const fixture = await createFixture(t);
  await assertUnsafeOutputIsRejected(fixture, fixture.temporaryRoot);
});

for (const child of ['scripts', 'docs', 'tests', 'src', 'assets']) {
  test(`buildRelease rejects source/${child} before deletion`, async (t) => {
    const fixture = await createFixture(t);
    await assertUnsafeOutputIsRejected(
      fixture,
      path.join(fixture.sourceDirectory, child),
    );
  });

  test(`buildRelease rejects a symlink alias to source/${child}`, async (t) => {
    const fixture = await createFixture(t);
    const outputAlias = path.join(fixture.temporaryRoot, `${child}-alias`);
    await symlink(path.join(fixture.sourceDirectory, child), outputAlias, 'dir');

    await assertUnsafeOutputIsRejected(fixture, outputAlias);
  });
}

test('buildRelease rejects an arbitrary new source child before creation', async (t) => {
  const fixture = await createFixture(t);
  await assertUnsafeOutputIsRejected(
    fixture,
    path.join(fixture.sourceDirectory, 'new-output'),
  );
});

test('buildRelease rejects an aliased arbitrary new source child', async (t) => {
  const fixture = await createFixture(t);
  const sourceAlias = path.join(fixture.temporaryRoot, 'project-alias');
  await symlink(fixture.sourceDirectory, sourceAlias, 'dir');

  await assertUnsafeOutputIsRejected(
    fixture,
    path.join(sourceAlias, 'new-output'),
    sourceAlias,
  );
});

test('buildRelease rejects source/release itself before deletion', async (t) => {
  const fixture = await createFixture(t);
  const releaseDirectory = path.join(fixture.sourceDirectory, 'release');
  await mkdir(releaseDirectory);
  await writeFile(path.join(releaseDirectory, 'sentinel.txt'), 'release-is-intact');

  await assertUnsafeOutputIsRejected(fixture, releaseDirectory);
  assert.equal(
    await readFile(path.join(releaseDirectory, 'sentinel.txt'), 'utf8'),
    'release-is-intact',
  );
});

test('buildRelease rejects filesystem roots before deletion', async (t) => {
  const fixture = await createFixture(t);
  await assertUnsafeOutputIsRejected(
    fixture,
    path.parse(fixture.sourceDirectory).root,
  );
});
