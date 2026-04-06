#!/usr/bin/env node
/**
 * Build script for Sanskrit Lens Chrome Extension.
 * Bundles:
 *   - content.js  → content.bundle.js   (IIFE, no ES module import needed)
 *   - sidepanel/  → sidepanel/bundle.js  (React JSX → browser bundle)
 *
 * background.js is left unbundled; it uses native ES-module imports
 * via `"type": "module"` in manifest.json.
 */

const esbuild = require('esbuild');
const isWatch = process.argv.includes('--watch');

const sharedOpts = {
  platform: 'browser',
  target: ['chrome114'],
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
};

async function main() {
  const contentCtx = await esbuild.context({
    ...sharedOpts,
    entryPoints: ['content.js'],
    outfile: 'content.bundle.js',
    format: 'iife',
  });

  const panelCtx = await esbuild.context({
    ...sharedOpts,
    entryPoints: ['sidepanel/App.jsx'],
    outfile: 'sidepanel/bundle.js',
    format: 'iife',
    jsx: 'automatic',
    globalName: undefined,
  });

  if (isWatch) {
    await contentCtx.watch();
    await panelCtx.watch();
    console.log('[Sanskrit Lens] Watching for changes…');
  } else {
    await contentCtx.rebuild();
    await panelCtx.rebuild();
    await contentCtx.dispose();
    await panelCtx.dispose();
    console.log('[Sanskrit Lens] Build complete.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
