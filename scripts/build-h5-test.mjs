import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
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
    VITE_USE_MOCK: 'false',
    VITE_DELETE_CONSOLE: 'true',
    VITE_SHOW_SOURCEMAP: 'false',
    UNI_OUTPUT_DIR: path.join(root, 'dist/build/h5-test'),
  },
})
if (result.error) console.error(result.error.message)
process.exit(result.status ?? 1)
