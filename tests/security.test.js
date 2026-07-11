const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

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

describe('production source security', () => {
  const sourceFiles = readJavaScriptFiles(path.join(projectRoot, 'src'));

  test('does not contain embedded Google API keys', () => {
    const exposedFiles = sourceFiles
      .filter((file) => /AIza[0-9A-Za-z_-]{20,}/.test(file.contents))
      .map((file) => path.relative(projectRoot, file.path));

    expect(exposedFiles).toEqual([]);
  });

  test('does not include a hardcoded API-key fallback', () => {
    const fallbackFiles = sourceFiles
      .filter((file) => file.contents.includes('HARDCODED_API_KEY'))
      .map((file) => path.relative(projectRoot, file.path));

    expect(fallbackFiles).toEqual([]);
  });

  test('does not place API keys in request URLs', () => {
    const queryStringKeyFiles = sourceFiles
      .filter((file) => file.contents.includes('?key=${apiKey}'))
      .map((file) => path.relative(projectRoot, file.path));

    expect(queryStringKeyFiles).toEqual([]);
  });

  test('does not copy newly entered API keys into general settings', () => {
    const optionsSource = fs.readFileSync(
      path.join(projectRoot, 'src', 'options', 'options.js'),
      'utf8'
    );

    expect(optionsSource).not.toContain('this.settings.geminiKey = apiKey');
    expect(optionsSource).not.toContain('this.settings.geminiApiKey = apiKey');
  });
});
