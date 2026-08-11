import { access, copyFile, mkdir, readFile, rm } from 'node:fs/promises';
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

export async function buildRelease({
  sourceDirectory = projectRoot,
  outputDirectory = path.join(projectRoot, 'release', 'utools-json-unwrapper'),
} = {}) {
  const sourceRoot = path.resolve(sourceDirectory);
  const outputRoot = path.resolve(outputDirectory);

  if (sourceRoot === outputRoot) {
    throw new Error('Release output directory must differ from the source directory');
  }

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
