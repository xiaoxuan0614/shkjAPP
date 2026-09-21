import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// uni 配置插件会回写源码目录；打包完成后恢复，避免运行中的 dev 混入 /h5/。
const generatedSnapshots = ['src/pages.json', 'src/manifest.json'].map(name => {
  const file = path.join(root, name)
  return { file, content: readFileSync(file) }
})
// 测试仅指部署目标，仍使用 production 编译，不启用开发服务器或 Mock。
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js'), 'build', '-p', 'h5'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    VITE_SERVER_BASEURL: 'https://oa-test.shouhuikeji.com/shouhuiApi',
    VITE_UPLOAD_BASEURL: 'https://oa-test.shouhuikeji.com/shouhuiApi',
    VITE_APP_PUBLIC_BASE: '/h5/',
    VITE_APP_PROXY: 'false',
    VITE_DELETE_CONSOLE: 'true',
    VITE_SHOW_SOURCEMAP: 'false',
    UNI_OUTPUT_DIR: path.join(root, 'dist/build/h5-test'),
  },
})
for (const { file, content } of generatedSnapshots) writeFileSync(file, content)
if (result.error) console.error(result.error.message)
process.exit(result.status ?? 1)
