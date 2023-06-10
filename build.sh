#!/usr/bin/env bash
pnpm exec tsc &&
pnpm exec esbuild --bundle src/web/app.tsx --inject:src/web/inject.ts --outdir=dist --sourcemap &&
pnpm exec esbuild --bundle src/web/worker.ts --outdir=dist --sourcemap &&
pnpm exec sass src/app.scss dist/app.css && cp node_modules/core-js-bundle/minified.js dist/core.js &&
pnpm exec babel --presets @babel/preset-env dist/app.js  -o dist/legacy.js --source-maps
