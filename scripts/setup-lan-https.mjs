import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const certificateDir = path.join(projectRoot, '.cert')
const certificatePath = path.join(certificateDir, 'lan.pem')
const privateKeyPath = path.join(certificateDir, 'lan-key.pem')
const sharedRootCaPath = path.join(certificateDir, 'rootCA.pem')

const privateIpv4 = Object.values(networkInterfaces())
  .flat()
  .filter((item) => item && item.family === 'IPv4' && !item.internal)
  .map((item) => item.address)
  .find(
    (address) =>
      address.startsWith('10.') ||
      address.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(address),
  )

if (!privateIpv4) {
  throw new Error('未找到局域网 IPv4 地址，请连接局域网后重试。')
}

let caRoot
try {
  caRoot = execFileSync('mkcert', ['-CAROOT'], { encoding: 'utf8' }).trim()
} catch {
  throw new Error('未安装 mkcert。macOS 请先执行 brew install mkcert 和 mkcert -install。')
}

mkdirSync(certificateDir, { recursive: true })
execFileSync(
  'mkcert',
  [
    '-cert-file',
    certificatePath,
    '-key-file',
    privateKeyPath,
    'localhost',
    '127.0.0.1',
    '::1',
    privateIpv4,
  ],
  { stdio: 'inherit' },
)
copyFileSync(path.join(caRoot, 'rootCA.pem'), sharedRootCaPath)

console.log('\n局域网 HTTPS 证书已生成。')
console.log(`访问地址：https://${privateIpv4}:9000`)
console.log(`其他设备需先信任：${sharedRootCaPath}`)
console.log('只能分发 rootCA.pem；不要分发 lan-key.pem 或 mkcert 根证书私钥。')
