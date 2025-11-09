const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Ensure dist directory exists
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Build content script
esbuild.build({
  entryPoints: ['src/content/main.js'],
  bundle: true,
  outfile: 'dist/content.js',
  format: 'iife',
  platform: 'browser',
  target: 'chrome96',
  logLevel: 'info'
}).then(() => {
  console.log('✅ Content script bundled successfully');
}).catch((err) => {
  console.error('❌ Content script build failed:', err);
  process.exit(1);
});

// Build background service worker
esbuild.build({
  entryPoints: ['src/background/service-worker.js'],
  bundle: true,
  outfile: 'dist/service-worker.js',
  format: 'iife',
  platform: 'browser',
  target: 'chrome96',
  logLevel: 'info'
}).then(() => {
  console.log('✅ Service worker bundled successfully');
}).catch((err) => {
  console.error('❌ Service worker build failed:', err);
  process.exit(1);
});
