import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const outputFile = path.join(projectRoot, 'dist', 'app.js');

export async function buildApp() {
  await mkdir(path.dirname(outputFile), { recursive: true });
  await build({
    entryPoints: [path.join(projectRoot, 'src', 'app.js')],
    outfile: outputFile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    legalComments: 'none',
    sourcemap: false,
  });
  return outputFile;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Built ${await buildApp()}`);
}
