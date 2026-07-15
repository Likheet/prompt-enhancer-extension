# Mozilla Source Build Instructions

## Requirements

- Windows 10/11, macOS, or Linux
- Node.js 18 or newer (Node.js 20 LTS recommended)
- npm 9 or newer, included with Node.js
- Internet access during dependency installation

## Reproduce the build

1. Extract this source archive.
2. Open a terminal in the extracted project directory.
3. Install the exact locked dependencies:

   ```bash
   npm ci
   ```

4. Generate the bundled extension files:

   ```bash
   npm run build
   ```

   This creates `dist/content.js` and `dist/service-worker.js` using the
   checked-in `build.js` esbuild script.

5. For the Firefox package, copy `manifest.json` to a staging directory and
   add the following Firefox-specific fields:

   ```json
   "browser_specific_settings": {
     "gecko": {
       "id": "prompt-enhancer@likheet",
       "strict_min_version": "109.0"
     }
   }
   ```

   Also add `"scripts": ["dist/service-worker.js"]` inside `background`.

6. Package the staging directory with `manifest.json` at its root. The
   Firefox release must use forward-slash ZIP paths.

The source files in this archive are the original readable source. The
generated files in `dist/` are build outputs and are not part of this source
archive.
