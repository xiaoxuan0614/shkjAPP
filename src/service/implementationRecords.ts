import { http } from '@/utils/http'
import { contractFileRequest } from '@/utils/contractFile'

export const implementationRecordsApi = {
  list: (periodId: string, processId: string, pageNo: number) =>
    http.get('/project/implementLog/list', { periodId, ...(processId ? { processId } : {}), pageNo, pageSize: 10 }),
  detail: (id: string) => http.get('/project/implementLog/queryById', { id }),
}

export const mediaPaths = (value: unknown): string[] => (Array.isArray(value) ? value : String(value || '').split(','))
  .map((item) => String(item).trim()).filter(Boolean)
export const isRecordVideo = (path: string) => /\.(mp4|mov|m4v|3gp|webm|avi)(?:[?#].*)?$/i.test(path)
export const recordMediaUrl = (path: string) => {
  if (/^(blob:|data:|wxfile:|file:)/i.test(path)) return path
  const normalized = path.replace(/\\/g, '/').replace(/^\/?(?:shouhuiApi\/)?sys\/common\/static\//i, '')
  try { return contractFileRequest(normalized).url } catch { return '' }
}
