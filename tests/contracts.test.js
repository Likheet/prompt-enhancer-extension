const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(projectRoot, 'src');

function readJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return readJavaScriptFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.js')
      ? [{ path: entryPath, contents: fs.readFileSync(entryPath, 'utf8') }]
      : [];
  });
}

describe('extension integration contracts', () => {
  const sourceFiles = readJavaScriptFiles(sourceRoot);

  test('browserCompat call sites use methods provided by BrowserCompat', () => {
    const browserCompatSource = fs.readFileSync(
      path.join(sourceRoot, 'shared', 'browser-compat.js'),
      'utf8'
    );
    const providedMethods = new Set(
      [...browserCompatSource.matchAll(/^\s{2}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/gm)]
        .map((match) => match[1])
    );

    const unknownCalls = sourceFiles.flatMap((file) =>
      [...file.contents.matchAll(/browserCompat\.([A-Za-z_$][\w$]*)\s*\(/g)]
        .filter((match) => !providedMethods.has(match[1]))
        .map((match) => `${path.relative(projectRoot, file.path)}:${match[1]}`)
    );

    expect(unknownCalls).toEqual([]);
  });

  test('runtime messages use actions handled by the service worker', () => {
    const serviceWorkerPath = path.join(sourceRoot, 'background', 'service-worker.js');
    const serviceWorkerSource = fs.readFileSync(serviceWorkerPath, 'utf8');
    const handledActions = new Set(
      [...serviceWorkerSource.matchAll(/case\s+'([^']+)'\s*:/g)].map((match) => match[1])
    );

    const unknownActions = sourceFiles
      .filter((file) => file.path !== serviceWorkerPath)
      .flatMap((file) =>
        [...file.contents.matchAll(/action:\s*'([^']+)'/g)]
          .filter((match) => !handledActions.has(match[1]))
          .map((match) => `${path.relative(projectRoot, file.path)}:${match[1]}`)
      );

    expect(unknownActions).toEqual([]);
  });
});
