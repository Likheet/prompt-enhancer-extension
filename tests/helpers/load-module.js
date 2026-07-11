const path = require('path');
const vm = require('vm');
const { buildSync } = require('esbuild');

function loadBundledModule(relativeEntryPoint, injectedGlobals = {}) {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const entryPoint = path.join(projectRoot, relativeEntryPoint);
  const result = buildSync({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    write: false,
    logLevel: 'silent'
  });

  const loadedModule = { exports: {} };
  const sandbox = Object.assign(Object.create(globalThis), injectedGlobals, {
    module: loadedModule,
    exports: loadedModule.exports,
    require,
    __dirname: path.dirname(entryPoint),
    __filename: entryPoint
  });

  vm.runInNewContext(result.outputFiles[0].text, sandbox, { filename: entryPoint });
  return loadedModule.exports;
}

module.exports = { loadBundledModule };
