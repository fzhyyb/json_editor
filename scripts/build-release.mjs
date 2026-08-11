import {
  access,
  copyFile,
  mkdir,
  readFile,
  realpath,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const runtimeFiles = [
  'plugin.json',
  'index.html',
  'styles.css',
  'src/app.js',
  'src/json-unwrapper.js',
  'src/utools-adapter.js',
  'assets/logo.png',
];

function resolveManifestPath(outputDirectory, manifestPath, field) {
  if (typeof manifestPath !== 'string' || manifestPath.length === 0) {
    throw new Error(`plugin.json ${field} must be a non-empty path`);
  }

  const resolvedPath = path.resolve(outputDirectory, manifestPath);
  if (!resolvedPath.startsWith(`${outputDirectory}${path.sep}`)) {
    throw new Error(`plugin.json ${field} must stay inside the release directory`);
  }
  return resolvedPath;
}

function isSameOrAncestor(candidate, target) {
  return candidate === target || target.startsWith(`${candidate}${path.sep}`);
}

async function canonicalizeRequestedPath(requestedPath) {
  let existingAncestor = path.resolve(requestedPath);
  const missingSegments = [];

  while (true) {
    try {
      const canonicalAncestor = await realpath(existingAncestor);
      return path.join(canonicalAncestor, ...missingSegments);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(existingAncestor);
      if (parent === existingAncestor) throw error;
      missingSegments.unshift(path.basename(existingAncestor));
      existingAncestor = parent;
    }
  }
}

async function validateOutputPath(sourceRoot, outputRoot) {
  if (path.parse(outputRoot).root === outputRoot) {
    throw new Error('Release output directory must not be a filesystem root');
  }
  if (isSameOrAncestor(outputRoot, sourceRoot)) {
    throw new Error('Release output directory must not contain the source directory');
  }
  if (isSameOrAncestor(sourceRoot, outputRoot)) {
    const releaseRoot = await canonicalizeRequestedPath(
      path.join(sourceRoot, 'release'),
    );
    if (outputRoot === releaseRoot || !isSameOrAncestor(releaseRoot, outputRoot)) {
      throw new Error(
        'Release output inside the source must be a child of the release directory',
      );
    }
  }

  for (const relativePath of runtimeFiles) {
    const inputPath = await realpath(path.join(sourceRoot, relativePath));
    if (isSameOrAncestor(outputRoot, inputPath)) {
      throw new Error(`Release output directory must not contain runtime input ${relativePath}`);
    }
  }
}

export async function buildRelease({
  sourceDirectory = projectRoot,
  outputDirectory,
} = {}) {
  const sourceRoot = await realpath(path.resolve(sourceDirectory));
  const requestedOutput = outputDirectory
    ?? path.join(sourceRoot, 'release', 'utools-json-unwrapper');
  const outputRoot = await canonicalizeRequestedPath(requestedOutput);
  await validateOutputPath(sourceRoot, outputRoot);

  await rm(outputRoot, { recursive: true, force: true });

  for (const relativePath of runtimeFiles) {
    const destination = path.join(outputRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(sourceRoot, relativePath), destination);
  }

  const manifest = JSON.parse(
    await readFile(path.join(outputRoot, 'plugin.json'), 'utf8'),
  );
  await access(resolveManifestPath(outputRoot, manifest.main, 'main'));
  await access(resolveManifestPath(outputRoot, manifest.logo, 'logo'));

  return { outputDirectory: outputRoot, files: [...runtimeFiles] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildRelease();
  console.log(`Staged ${result.files.length} runtime files in ${result.outputDirectory}`);
}
