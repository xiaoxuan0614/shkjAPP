<template>
  <div class="preview-content">
    <div v-if="loading" class="preview-state" aria-live="polite">{{ loadingText }}</div>
    <div v-else-if="errorMessage" class="preview-state" role="alert">
      <span>{{ errorMessage }}</span>
      <button @click="load">重新加载</button>
    </div>
    <template v-else>
      <div v-if="kind === 'pdf'" class="preview-toolbar">
        <button :disabled="pageNo <= 1 || rendering" @click="turnPage(-1)">上一页</button>
        <span>{{ pageNo }} / {{ pageCount }}</span>
        <button :disabled="pageNo >= pageCount || rendering" @click="turnPage(1)">下一页</button>
        <button :disabled="rendering" @click="toggleZoom">
          {{ zoom === 1 ? '放大' : '适宽' }}
        </button>
      </div>
      <div v-if="kind === 'xlsx'" class="preview-sheets">
        <button
          v-for="(sheet, index) in sheets"
          :key="sheet.name"
          :class="{ selected: sheetIndex === index }"
          @click="sheetIndex = index"
        >
          {{ sheet.name }}
        </button>
      </div>
      <div class="preview-scroll">
        <iframe v-if="kind === 'docx'" class="preview-word" :srcdoc="wordHtml" sandbox="" :title="file.name" />
        <div v-else-if="kind === 'doc'" class="preview-state">
          <span>此文件为旧版 Word（.doc），请下载后使用 Word / WPS 打开，或另存为 .docx 后上传预览。</span>
          <a :href="imageUrl" :download="file.name">下载 Word 文件</a>
        </div>
        <div v-if="kind === 'pdf'" ref="pdfHost" class="preview-pdf" :aria-busy="rendering" />
        <img v-else-if="kind === 'image'" :src="imageUrl" :alt="file.name" @error="renderError" />
        <template v-else-if="kind === 'xlsx'">
          <p v-if="activeSheet?.limited" class="preview-note">当前预览前 500 行、前 50 列。</p>
          <p v-if="!activeSheet?.rows.length" class="preview-note">当前工作表为空</p>
          <table v-else class="preview-table" :aria-label="activeSheet?.name">
            <tbody>
              <tr v-for="(row, index) in activeSheet?.rows" :key="index">
                <td
                  v-for="cell in row"
                  :key="cell.column"
                  :rowspan="cell.rowspan"
                  :colspan="cell.colspan"
                  :style="cell.style"
                >
                  {{ cell.text }}
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { contractFileRequest, fileExtension, type ContractFile } from '@/utils/contractFile'
import { readPreviewBuffer, checkPreviewSignature } from '@/utils/filePreviewRead'

const props = defineProps<{ file: ContractFile }>()
type SheetCell = {
  column: number
  text: string
  rowspan: number
  colspan: number
  style: Record<string, string>
}
type Sheet = { name: string; rows: SheetCell[][]; limited: boolean }
const loading = ref(true)
const loadingText = ref('正在读取文件内容…')
const errorMessage = ref('')
const rendering = ref(false)
const pdfHost = ref<any>()
const imageUrl = ref('')
const wordHtml = ref('')
const pageNo = ref(1)
const pageCount = ref(0)
const zoom = ref(1)
const sheets = ref<Sheet[]>([])
const sheetIndex = ref(0)
const activeSheet = computed(() => sheets.value[sheetIndex.value])
const extension = computed(() => fileExtension(props.file))
const kind = computed(() => ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(extension.value) ? 'image' : extension.value)
let controller: AbortController | undefined
let pdfTask: any
let pdf: any
let renderTask: any
let sequence = 0

const dispose = () => {
  controller?.abort()
  renderTask?.cancel()
  void pdfTask?.destroy()?.catch(() => {})
  pdfTask = undefined
  pdf = undefined
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = ''
  wordHtml.value = ''
}
const renderError = () => {
  errorMessage.value = '文件内容无法解析，请确认文件完整后重试'
}
const drawPage = async () => {
  if (!pdf || rendering.value) return
  rendering.value = true
  const current = sequence
  try {
    await nextTick()
    const host: HTMLElement = pdfHost.value?.$el || pdfHost.value
    if (!host) return
    const page = await pdf.getPage(pageNo.value)
    if (current !== sequence) return
    const original = page.getViewport({ scale: 1 })
    const width = Math.max(240, host.parentElement!.clientWidth - 24)
    const viewport = page.getViewport({ scale: (width / original.width) * zoom.value })
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width * ratio)
    canvas.height = Math.floor(viewport.height * ratio)
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`
    canvas.setAttribute('aria-label', `${props.file.name}，第 ${pageNo.value} 页`)
    host.replaceChildren(canvas)
    renderTask = page.render({ canvas, viewport, transform: [ratio, 0, 0, ratio, 0, 0] })
    await renderTask.promise
  } catch (error: any) {
    if (current === sequence && error?.name !== 'RenderingCancelledException') renderError()
  } finally {
    if (current === sequence) rendering.value = false
  }
}
const turnPage = async (step: number) => {
  if (rendering.value) return
  pageNo.value = Math.max(1, Math.min(pageCount.value, pageNo.value + step))
  await drawPage()
}
const toggleZoom = async () => {
  if (rendering.value) return
  zoom.value = zoom.value === 1 ? 1.8 : 1
  await drawPage()
}

const parseWorkbook = async (buffer: ArrayBuffer) => {
  const { default: ExcelJS } = await import('exceljs')
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(buffer)
  const color = (value: any) =>
    /^[a-f\d]{8}$/i.test(value?.argb || '') ? `#${value.argb.slice(2)}` : ''
  return book.worksheets
    .filter((sheet) => sheet.state === 'visible')
    .map((sheet) => {
      const rows: SheetCell[][] = []
      const rowEnd = Math.min(sheet.rowCount, 500)
      const colEnd = Math.min(sheet.columnCount, 50)
      const merges = ((sheet.model as any).merges || []).map((address: string) => {
        const [start, end] = address.split(':').map((part) => sheet.getCell(part))
        return {
          top: Number(start.row),
          left: Number(start.col),
          bottom: Number((end || start).row),
          right: Number((end || start).col),
        }
      })
      for (let r = 1; r <= rowEnd; r++) {
        const cells: SheetCell[] = []
        for (let c = 1; c <= colEnd; c++) {
          const cell = sheet.getCell(r, c)
          if (cell.isMerged && cell.master.address !== cell.address) continue
          const merge = merges.find((m) => m.top === r && m.left === c)
          let text = cell.text
          if (cell.value instanceof Date) text = cell.value.toISOString().slice(0, 10)
          if (cell.type === ExcelJS.ValueType.Formula && cell.result == null)
            text = '未保存计算结果'
          const numeric =
            typeof cell.value === 'number'
              ? cell.value
              : typeof cell.result === 'number'
                ? cell.result
                : null
          if (numeric != null && /%/.test(cell.numFmt || ''))
            text = `${Number((numeric * 100).toFixed(2))}%`
          const fill: any = cell.fill
          cells.push({
            column: c,
            text,
            rowspan: merge ? Math.min(merge.bottom, rowEnd) - r + 1 : 1,
            colspan: merge ? Math.min(merge.right, colEnd) - c + 1 : 1,
            style: {
              fontWeight: cell.font?.bold ? '600' : '400',
              color: color(cell.font?.color) || '#27364a',
              backgroundColor: color(fill?.fgColor) || '#fff',
              textAlign: ['left', 'center', 'right'].includes(cell.alignment?.horizontal)
                ? cell.alignment.horizontal
                : 'left',
            },
          })
        }
        rows.push(cells)
      }
      return { name: sheet.name, rows, limited: sheet.rowCount > 500 || sheet.columnCount > 50 }
    })
}

const load = async () => {
  const current = ++sequence
  dispose()
  loading.value = true
  loadingText.value = '正在读取文件内容…'
  rendering.value = false
  errorMessage.value = ''
  sheets.value = []
  sheetIndex.value = 0
  pageNo.value = 1
  zoom.value = 1
  const request = new AbortController()
  controller = request
  const timer = setTimeout(() => request.abort(), 30000)
  try {
    if (kind.value === 'xls') throw new Error('旧版 XLS 暂不支持网页预览，请另存为 XLSX，或在微信小程序中使用原生预览')
    if (!['image', 'pdf', 'xlsx', 'docx', 'doc'].includes(kind.value))
      throw new Error('网页预览支持 DOCX、PDF、XLSX 和图片，请转换为支持的格式')
    const { url, header, trusted } = contractFileRequest(props.file.path)
    const response = await fetch(url, {
      headers: header,
      credentials: trusted ? 'same-origin' : 'omit',
      redirect: 'error',
      signal: request.signal,
    })
    if (!response.ok) throw new Error(`附件读取失败（${response.status}），请重试或检查文件权限`)
    const buffer = await readPreviewBuffer(response)
    clearTimeout(timer)
    if (current !== sequence) return
    checkPreviewSignature(buffer, extension.value)
    loadingText.value = '正在解析文件，请稍候…'
    if (kind.value === 'pdf') {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
      if (current !== sequence) return
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      const resourceBase = new URL(`${import.meta.env.BASE_URL}pdfjs/`, window.location.origin).href
      pdfTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        isEvalSupported: false,
        cMapUrl: `${resourceBase}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${resourceBase}standard_fonts/`,
        wasmUrl: `${resourceBase}wasm/`,
      })
      const task = pdfTask
      task.onPassword = () => {
        if (current === sequence) errorMessage.value = '此 PDF 需要密码，请上传无密码版本后预览'
        void task.destroy()?.catch(() => {})
      }
      const document = await task.promise
      if (current !== sequence) return
      pdf = document
      pageCount.value = pdf.numPages
    } else if (kind.value === 'docx') {
      const { renderAsync } = await import('docx-preview')
      if (current !== sequence) return
      const host = document.createElement('div')
      await renderAsync(buffer, host, undefined, {
        ignoreWidth: true, ignoreHeight: true, breakPages: false,
        useBase64URL: true, renderAltChunks: false,
      })
      if (current !== sequence) return
      // 文件内容放入无脚本、无外部请求权限的沙箱，文档样式不影响审批页面。
      wordHtml.value = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline';"><style>body{margin:0;color:#27364a;background:white} .docx-wrapper{padding:12px!important;background:white!important}section.docx{padding:12px!important;box-shadow:none!important;max-width:100%;box-sizing:border-box}img{max-width:100%;height:auto}table{max-width:100%}p{overflow-wrap:anywhere}</style></head><body>${host.innerHTML}</body></html>`
    } else if (kind.value === 'doc') {
      imageUrl.value = URL.createObjectURL(new Blob([buffer], { type: 'application/msword' }))
    } else if (kind.value === 'xlsx') {
      const parsed = await parseWorkbook(buffer)
      if (current !== sequence) return
      sheets.value = parsed
      if (!parsed.length) throw new Error('文件中没有可见的工作表')
    } else {
      imageUrl.value = URL.createObjectURL(
        new Blob([buffer], { type: `image/${extension.value === 'jpg' ? 'jpeg' : extension.value}` }),
      )
    }
  } catch (error: any) {
    if (current === sequence && !errorMessage.value)
      errorMessage.value =
        error?.name === 'AbortError'
          ? '文件读取超时，请检查网络后重试'
          : error?.message || '预览失败，请检查文件后重试'
  } finally {
    clearTimeout(timer)
    if (current === sequence) {
      loading.value = false
      if (kind.value === 'pdf' && !errorMessage.value) await drawPage()
    }
  }
}
watch(() => [props.file.path, props.file.name], load, { immediate: true })
onBeforeUnmount(() => {
  sequence++
  dispose()
})
</script>

<style scoped>
.preview-word { display: block; width: 100%; height: 100%; min-height: 60vh; border: 0; background: #fff; }
.preview-content {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  color: #27364a;
  background: #f4f6f8;
}
.preview-state {
  display: flex;
  flex: 1;
  padding: 24px;
  gap: 16px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  font-size: 16px;
  line-height: 1.6;
  text-align: center;
}
.preview-toolbar,
.preview-sheets {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  flex: none;
  overflow-x: auto;
  background: #fff;
  border-bottom: 1px solid #edf0f3;
}
.preview-toolbar span {
  white-space: nowrap;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.preview-content button {
  min-height: 44px;
  padding: 8px 12px;
  margin: 0;
  border: 1px solid #ccd5df;
  border-radius: 8px;
  background: #fff;
  color: #176ac7;
  font-size: 14px;
  line-height: 1.4;
  flex: none;
  cursor: pointer;
}
.preview-content button::after {
  border: none;
}
.preview-content button:disabled {
  color: #68788a;
  background: #f4f6f8;
  cursor: default;
}
.preview-content button:focus-visible {
  outline: 2px solid #176ac7;
  outline-offset: 2px;
}
.preview-sheets .selected {
  color: #fff;
  background: #176ac7;
  border-color: #176ac7;
}
.preview-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
}
.preview-scroll img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: auto;
}
.preview-table {
  border-collapse: collapse;
  background: #fff;
  font-size: 14px;
  line-height: 1.5;
}
.preview-table td {
  min-width: 90px;
  max-width: 360px;
  padding: 8px;
  border: 1px solid #ccd5df;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.preview-note {
  margin: 0 0 12px;
  color: #68788a;
  font-size: 14px;
}
</style>
