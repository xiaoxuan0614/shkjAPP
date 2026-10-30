<template>
  <view class="repair-quote-items">
    <view class="actions"><button :disabled="disabled || busy || modelValue.length >= 200" @click="open('material')">＋ 选择物料</button><button :disabled="disabled || busy || modelValue.length >= 200" @click="open('fee')">＋ 选择服务费用</button></view>
    <text class="hint">点击明细行可修改数量和报价，金额单位：元。</text>
    <text v-if="busy" class="hint">正在读取最新价格…</text>
    <text v-if="error" class="error">{{ error }}</text>
    <text v-if="!modelValue.length" class="empty">请选择本次维修所需的物料或服务费用</text>
    <view v-if="modelValue.length" class="detail-table">
      <view class="table-grid table-head"><text>名称</text><text>数量</text><text>单价</text><text>金额</text></view>
      <button v-for="(row, offset) in visible" :key="start + offset" class="table-grid table-row" :disabled="disabled || busy" :aria-label="`编辑${row.name}`" @click="edit(start + offset)">
        <view class="table-name"><text class="name">{{ row.name }}</text><text class="kind">{{ row.kind === 'material' ? '物料' : row.kind === 'fee' ? '服务费用' : '历史报价项' }}</text></view>
        <text>{{ row.qty }}</text><text>{{ money(row.price) }}</text><text>{{ quotationLineTotal(row.qty, row.price).replace('¥', '') }}</text>
      </button>
    </view>
    <view v-if="modelValue.length > 5" class="pager"><button :disabled="page === 1" @click="page--">上一页</button><text>{{ page }} / {{ pages }} 页 · {{ modelValue.length }} 项</text><button :disabled="page >= pages" @click="page++">下一页</button></view>
    <QuotationPicker v-model="show" :kind="kind" :excluded="excluded" :z-index="12000" @select="select" />
    <wd-popup :model-value="editing" position="bottom" :close-on-click-modal="false" :z-index="12100" custom-style="border-radius:16px 16px 0 0;overflow:hidden;" @update:model-value="cancel">
      <view v-if="draft" class="editor">
        <view class="editor-head"><text>填写报价明细</text><button @click="cancel">取消</button></view>
        <scroll-view scroll-y class="editor-body">
          <text class="editor-name">{{ draft.name }}</text>
          <text class="hint">默认单价＝成本价 ×（1＋指导比例÷100），可调整本次报价。</text>
          <view class="fields"><label>数量<text class="required"> *</text><input v-model="draft.qty" type="digit" placeholder="请输入数量" /></label><label>报价单价（元）<text class="required"> *</text><input :value="draft.price" type="digit" inputmode="decimal" placeholder="最多两位小数，可填 0" @input="draft.price = String($event.detail.value)" /></label></view>
          <view class="subtotal"><text>本项金额</text><text>{{ quotationLineTotal(draft.qty, draft.price) }}</text></view>
          <text v-if="editError" class="error">{{ editError }}</text>
        </scroll-view>
        <view class="editor-actions"><button v-if="editIndex >= 0" class="danger" :disabled="disabled" @click="removeCurrent">删除本项</button><button class="confirm" :disabled="disabled" @click="confirm">{{ editIndex < 0 ? '确认添加' : '保存修改' }}</button></view>
      </view>
    </wd-popup>
  </view>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import QuotationPicker from './QuotationPicker.vue'
import { http } from '@/utils/http'
import { quotationLineTotal, unwrapQuotation } from '@/service/quotationApproval'
import { decimalInput, guidancePrice } from '@/service/quotationEditor'
import { useUserStore } from '@/store/user'
type Line = { name: string; qty: number; price: number; kind?: 'material' | 'fee'; sourceId?: string; unit?: string }
const props = defineProps<{ modelValue: Line[]; disabled?: boolean }>()
const emit = defineEmits(['update:modelValue', 'busy'])
const user = useUserStore()
const show = ref(false), kind = ref<'material' | 'fee'>('material'), busy = ref(false), error = ref(''), page = ref(1)
const editing = ref(false), draft = ref<any>(null), editIndex = ref(-1), editError = ref('')
let original: Line | undefined
let alive = true
const pages = computed(() => Math.max(1, Math.ceil(props.modelValue.length / 5)))
const start = computed(() => (page.value - 1) * 5)
const visible = computed(() => props.modelValue.slice(start.value, start.value + 5))
const excluded = computed(() => props.modelValue.filter(row => row.kind === kind.value).map(row => row.sourceId || ''))
watch(pages, value => { page.value = Math.min(page.value, value) })
function open(value: 'material' | 'fee') { kind.value = value; show.value = true; error.value = '' }
const money = (value: unknown) => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(2)
function edit(index: number) {
  if (props.disabled || busy.value || !props.modelValue[index]) return
  original = props.modelValue[index]; editIndex.value = index; draft.value = { ...original, price: String(original.price) }; editError.value = ''; editing.value = true; emit('busy', true)
}
function cancel() { editing.value = false; draft.value = null; original = undefined; editError.value = ''; emit('busy', false) }
function removeCurrent() {
  if (props.disabled || editIndex.value < 0) return
  if (props.modelValue[editIndex.value] !== original) { editError.value = '明细已更新，请取消后重新打开'; return }
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== editIndex.value)); cancel()
}
function confirm() {
  if (props.disabled || !draft.value) return
  try {
    const row = { ...draft.value, qty: decimalInput(draft.value.qty, '数量', 3, true), price: decimalInput(draft.value.price, '报价单价') }
    if (editIndex.value >= 0) {
      if (props.modelValue[editIndex.value] !== original) throw new Error('明细已更新，请取消后重新打开')
      emit('update:modelValue', props.modelValue.map((item, i) => i === editIndex.value ? row : item))
    } else {
      if (props.modelValue.length >= 200) throw new Error('报价明细最多 200 项')
      if (props.modelValue.some(item => item.kind === row.kind && item.sourceId === row.sourceId)) throw new Error('该项目已添加，请取消后在表格中修改')
      const nextPage = Math.ceil((props.modelValue.length + 1) / 5)
      emit('update:modelValue', [...props.modelValue, row]); page.value = nextPage
    }
    cancel()
  } catch (e: any) { editError.value = e.message || '请检查填写内容' }
}
async function select(source: any) {
  if (busy.value || props.disabled || props.modelValue.length >= 200) return
  const selectedKind = kind.value, token = user.userInfo.token
  if (props.modelValue.some(row => row.kind === selectedKind && row.sourceId === String(source.id))) return
  show.value = false; busy.value = true; emit('busy', true); error.value = ''
  try {
    const item = unwrapQuotation(await http.get(selectedKind === 'material' ? '/stock/material/queryById' : '/project/serviceFee/queryById', { id: source.id }))
    if (!alive || token !== user.userInfo.token) return
    if (!item?.id || String(item.id) !== String(source.id)) throw new Error('目录详情返回异常，请重新选择')
    const base = selectedKind === 'material' ? item.unitList?.find((unit: any) => unit.isBaseUnit === true || String(unit.isBaseUnit) === '1') : undefined
    if (selectedKind === 'material' && !base?.unitName) throw new Error('物料缺少基准单位，请先维护物料资料')
    const unit = selectedKind === 'material' ? base.unitName : item.unit || '项'
    const label = selectedKind === 'material' ? [item.materialName, item.brand, item.model].filter(Boolean).join(' · ') : item.name
    if (!label) throw new Error('目录缺少名称，请先维护资料')
    const name = `${label}（${unit}）`
    if (name.length > 500) throw new Error('报价名称超过 500 字，请先调整目录名称')
    const price = item.costPrice == null || item.costPrice === '' ? '' : guidancePrice(item.costPrice, item.guideMarkupRate ?? 0)
    draft.value = { name, qty: 1, price: String(price), kind: selectedKind, sourceId: String(item.id), unit }
    editIndex.value = -1; original = undefined; editError.value = ''; editing.value = true
  } catch (e: any) { if (alive) error.value = e.message || '读取价格失败，请重新选择' }
  finally { if (alive) { busy.value = false; emit('busy', editing.value) } }
}
onBeforeUnmount(() => { alive = false; emit('busy', false) })
</script>
<style scoped>
.detail-table{margin-top:12px;border:1px solid #e3e8ef;border-radius:8px;overflow:hidden}.table-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,.65fr) minmax(0,.9fr) minmax(0,1fr);gap:8px;align-items:center;padding:12px 8px;font-size:12px;line-height:1.5;text-align:right;font-variant-numeric:tabular-nums}.table-grid>text{min-width:0;overflow-wrap:anywhere}.table-head{background:#f2f6fc;color:#475467}.table-head>text:first-child{text-align:left}.table-row{width:100%;border-radius:0;background:#fff;color:#344054;border-top:1px solid #eaecf0;min-height:64px}.table-row:active{background:#f0f6ff}.table-name{text-align:left;min-width:0}.table-name .name{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:#176ac7;font-size:13px}.kind{display:block;font-size:11px;color:#667085;margin-top:4px}.editor{max-width:736px;margin:auto;background:#fff;padding-bottom:env(safe-area-inset-bottom)}.editor-head{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid #eaecf0;font-size:17px;font-weight:600}.editor-head button{background:transparent}.editor-body{max-height:55vh;box-sizing:border-box;padding:16px}.editor-name{display:block;font-size:15px;font-weight:600;line-height:1.6;overflow-wrap:anywhere}.subtotal{display:flex;justify-content:space-between;margin-top:20px;font-size:15px;font-variant-numeric:tabular-nums}.editor-actions{display:flex;gap:12px;padding:12px 16px;border-top:1px solid #eaecf0}.editor-actions .confirm{flex:1;background:#176ac7;color:#fff}.editor-actions .danger{background:#fff1f0;color:#b42318}.required{color:#b42318}button:focus-visible,input:focus-visible{outline:2px solid #176ac7;outline-offset:-2px}
.actions,.head,.fields,.pager{display:flex;gap:12px;align-items:center}.actions button,.fields label{flex:1;min-width:0}button{margin:0;padding:0 10px;min-height:44px;line-height:44px;background:#edf5ff;color:#176ac7;font-size:14px}button::after{border:0}.hint,.empty,.error{display:block;font-size:12px;line-height:1.6;margin-top:8px;color:#667085}.empty{padding:20px 0;text-align:center}.error{color:#b42318}.line{padding:16px 0;border-bottom:1px solid #eaecf0}.head{justify-content:space-between;align-items:flex-start}.head>view{flex:1;min-width:0}.name{font-size:14px;font-weight:600;overflow-wrap:anywhere}.head button{background:transparent;color:#b42318;flex-shrink:0}.fields{margin-top:12px}.fields label{font-size:13px;color:#475467}.fields input{box-sizing:border-box;width:100%;height:44px;border:1px solid #dce3ed;border-radius:6px;margin-top:6px;padding:0 10px;font-size:16px;background:#f8fafc}.pager{justify-content:space-between;margin-top:12px;font-size:12px}button[disabled]{opacity:.45}
</style>
