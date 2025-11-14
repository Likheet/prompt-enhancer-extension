try {
  importScripts('dist/service-worker.js');
} catch (error) {
  console.error('[APE] Failed to load background script:', error);
}
