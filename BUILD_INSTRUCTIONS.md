# Build Instructions for Firefox Add-on Reviewers

This document provides step-by-step instructions to reproduce the exact build of the AI Prompt Enhancer extension for Firefox from source code.

## Prerequisites

### Required Software

- **Operating System**: Windows, macOS, or Linux
- **Node.js**: Version 18.x or higher
  - Download from: https://nodejs.org/
  - Verify installation: `node --version`
- **npm**: Version 9.x or higher (comes with Node.js)
  - Verify installation: `npm --version`

### Installation Steps

1. Install Node.js from the official website
2. Verify both Node.js and npm are installed correctly:
   ```bash
   node --version
   npm --version
   ```

## Build Process

### Step 1: Extract Source Code

Extract the submitted source code archive to a directory of your choice.

### Step 2: Install Dependencies

Open a terminal in the extracted directory and run:

```bash
npm install
```

This will install the required build tool (esbuild) as specified in `package.json`.

### Step 3: Build the Extension

Run the build script:

```bash
npm run build
```

This executes `node build.js`, which:
- Bundles `src/background/service-worker.js` into `dist/service-worker.js`
- Bundles `src/content/main.js` into `dist/content.js`
- Uses esbuild with the following settings:
  - Format: IIFE (Immediately Invoked Function Expression)
  - Minification: Enabled
  - Source maps: None
  - Bundle: true (combines all imports)

### Step 4: Package for Firefox

#### On Windows (PowerShell):

```powershell
pwsh -File .\scripts\package-firefox.ps1
```

#### On macOS/Linux:

First, make the script executable:
```bash
chmod +x scripts/package-firefox.sh
```

Then run:
```bash
./scripts/package-firefox.sh
```

Alternatively, you can manually create the package:

```bash
# Temporarily swap manifests
cp manifest.json manifest.chrome.json.backup
cp manifest.firefox.json manifest.json

# Create the zip
zip -r prompt-enhancer-firefox.zip \
  manifest.json \
  dist/ \
  assets/ \
  src/ \
  firefox-background.js

# Restore original manifest
mv manifest.chrome.json.backup manifest.json
```

### Step 5: Verify the Build

The resulting `prompt-enhancer-firefox.zip` should contain:

- `manifest.json` (Firefox-specific manifest with gecko settings)
- `dist/service-worker.js` (bundled background script)
- `dist/content.js` (bundled content script)
- `assets/` (icons and CSS)
- `src/` (original source files)
- `firefox-background.js` (Firefox compatibility shim)

The archive should be approximately 3-4 MB in size.

## Build Script Details

### build.js

The build script (`build.js`) is a Node.js script that uses esbuild to:

1. **Bundle the service worker**: Combines all background scripts and their dependencies into a single file
2. **Bundle the content script**: Combines all content scripts and their dependencies into a single file
3. **Minify output**: Reduces file size while maintaining functionality

The bundler resolves all ES6 imports and creates standalone scripts that can run in the browser extension environment.

### package-firefox.ps1 (Windows)

This PowerShell script:

1. Backs up the Chrome manifest
2. Replaces it with the Firefox-specific manifest
3. Creates a ZIP archive with the required files
4. Restores the original Chrome manifest

### Why Bundling?

The extension uses ES6 modules with imports/exports. Firefox extensions require these to be bundled into standalone scripts because:

- Content scripts don't support native ES6 module imports in all contexts
- Background service workers need to be in a single file for MV3
- The bundler ensures all dependencies are included and properly scoped

## Third-Party Dependencies

### Build-time Dependencies (package.json)

- **esbuild**: Version ^0.24.2
  - Used for bundling and minification
  - Open source: https://github.com/evanw/esbuild
  - License: MIT

No runtime dependencies are included. The extension is self-contained.

## Verification

To verify the build matches the submitted extension:

1. Complete all build steps above
2. Extract both the submitted extension ZIP and your newly built `prompt-enhancer-firefox.zip`
3. Compare the `dist/` directory contents (they should be byte-for-byte identical)
4. The `manifest.json` in the final package should match `manifest.firefox.json` from source

## Troubleshooting

### Build fails with "esbuild not found"

Run `npm install` to install dependencies.

### Permission denied on scripts

On Unix-like systems, make scripts executable:
```bash
chmod +x scripts/*.sh
```

### Different file sizes in dist/

This can happen if:
- Different versions of esbuild are used (ensure exact version from package.json)
- Different Node.js versions produce slightly different output

The functionality will be identical even if byte sizes differ slightly.

## Contact

For build-related questions, please contact the extension developer through the AMO review process.

## License

This extension is distributed under the MIT License. See LICENSE file for details.
