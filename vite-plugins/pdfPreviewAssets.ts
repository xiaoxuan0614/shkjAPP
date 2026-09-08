import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

/** PDF 中文映射、标准字体和解码资源保留原文件名；仅 H5 启用。 */
export function pdfPreviewAssets(): Plugin {
  const root = path.resolve(process.cwd(), 'node_modules/pdfjs-dist')
  const resources = new Map<string, string>()
  for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
    for (const file of fs.readdirSync(path.join(root, directory))) {
      const source = path.join(root, directory, file)
      if (fs.statSync(source).isFile()) resources.set(`${directory}/${file}`, source)
    }
  }
  return {
    name: 'contract-pdf-preview-assets',
    configureServer(server) {
      server.middlewares.use(`${server.config.base}pdfjs/`, (request, response, next) => {
        const source = resources.get((request.url || '').split('?')[0])
        if (!source) return next()
        response.setHeader(
          'Content-Type',
          source.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
        )
        fs.createReadStream(source)
          .on('error', () => {
            response.statusCode = 500
            response.end()
          })
          .pipe(response)
      })
    },
    generateBundle() {
      for (const [name, source] of resources) {
        this.emitFile({ type: 'asset', fileName: `pdfjs/${name}`, source: fs.readFileSync(source) })
      }
    },
  }
}
