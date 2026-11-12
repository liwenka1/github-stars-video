const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ts = require('typescript')

// Load application TypeScript without adding a runtime dependency or writing build output.
function loadTs(relativePath, { globals = {}, mocks = {} } = {}) {
  const root = path.resolve(__dirname, '../..')
  const cache = new Map()
  const context = vm.createContext({
    console, setTimeout, clearTimeout, URL, AbortController, Blob, Response, Request, Headers,
    Promise, Error, DOMException, Buffer, TextEncoder, TextDecoder, ReadableStream,
    ...globals,
  })

  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const nativeRequire = createRequire(filename)
    const localRequire = (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier]
      if (specifier.startsWith('@/') || specifier.startsWith('.')) {
        const base = specifier.startsWith('@/')
          ? path.resolve(root, 'src', specifier.slice(2))
          : path.resolve(path.dirname(filename), specifier)
        const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]
          .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
        if (resolved && /\.tsx?$/.test(resolved)) return load(resolved)
      }
      return nativeRequire(specifier)
    }
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName: filename,
    })
    const run = vm.runInContext(
      `(function (exports, require, module, __filename, __dirname) {\n${outputText}\n})`,
      context,
      { filename },
    )
    run(module.exports, localRequire, module, filename, path.dirname(filename))
    return module.exports
  }

  return load(path.resolve(root, relativePath))
}

module.exports = { loadTs }
