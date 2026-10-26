export const PREVIEW_MAX_BYTES = 20 * 1024 * 1024

/** 流式限制内存；失败时立即停止读取，不等待整份大文件下载。 */
export async function readPreviewBuffer(response: Response): Promise<ArrayBuffer> {
  if (Number(response.headers.get('content-length')) > PREVIEW_MAX_BYTES) {
    await response.body?.cancel()
    throw new Error('文件超过 20 MB，请精简或拆分后查看')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('当前浏览器不支持安全文件读取，请升级浏览器后重试')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > PREVIEW_MAX_BYTES) throw new Error('文件超过 20 MB，请精简或拆分后查看')
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally { reader.releaseLock() }
  if (!size) throw new Error('文件内容为空，请重新上传有效文件')
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  return result.buffer
}

export function checkPreviewSignature(buffer: ArrayBuffer, extension: string) {
  const bytes = new Uint8Array(buffer)
  if (['docx', 'xlsx'].includes(extension) && !(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new Error('文件实际格式与后缀不一致或已加密，请用 Word/WPS/Excel 另存为无密码的标准文件；不能只改后缀')
  }
  if (extension === 'pdf' && !new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-')) {
    throw new Error('文件内容不是有效 PDF，请重新导出 PDF 后上传')
  }
}
