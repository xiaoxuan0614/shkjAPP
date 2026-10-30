/** Display-only normalization. Never derives permissions or mutates business state. */
export function repairAttachment(file: Record<string, any>) {
  const name = String(file.fileName || file.fileNameSnapshot || '')
  const mime = String(file.mimeType || file.contentType || '').toLowerCase()
  const explicit = String(file.mediaType || '').toUpperCase()
  const mediaType = ['IMAGE', 'VIDEO'].includes(explicit) ? explicit
    : mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(name) ? 'IMAGE'
      : mime.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi)$/i.test(name) ? 'VIDEO' : 'UNKNOWN'
  return { ...file, fileId: file.fileId, mediaType }
}

export function repairEventContent(content: unknown) {
  // Remove only known workflow metadata segments; retain human reasons verbatim.
  return String(content || '').split(/[；;]/).filter(part =>
    !/^\s*(?:iteration|nodeKey|taskId|instanceId|assignmentStatus)\s*=/.test(part)
    && !/^\s*(?:COMPLETED|RUNNING|PENDING|APPROVED|REJECTED)\s*$/.test(part)
  ).join('；').trim()
}

export function repairLogContent(record: Record<string, any>, detail?: Record<string, any>) {
  return detail?.repairDescription ?? record.repairDescription ?? record.description ?? ''
}
