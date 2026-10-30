<template>
  <SectionCard title="关联信息"><view class="info"><text>关联项目</text><text>{{ repair.project }}</text></view><view class="info"><text>维修产品</text><text>{{ repair.product }}</text></view><view v-if="type === '还料'" class="return-remark-row"><text class="return-label">备注</text><textarea v-model="remark" class="remark" maxlength="1000" aria-label="还料备注" placeholder="选填" /></view></SectionCard>
  <SectionCard v-if="type === '领料'" title="使用安排">
    <view class="use-date-row"><text>使用时间<text class="required"> *</text></text><picker mode="date" :value="useDate" @change="useDate = $event.detail.value"><view class="use-date-value">{{ useDate || '请选择使用时间' }}<wd-icon name="arrow-right" size="14px" /></view></picker></view>
  </SectionCard>
  <SectionCard :title="type === '领料' ? '领料明细' : '还料信息'">
    <view v-if="type === '领料'" class="pick-toolbar"><text>已选 {{ lines.length }} 种物料</text><button class="pick-add" :disabled="returnLoading || !!returnError" @click="showPicker = true"><wd-icon name="add" /> 添加物料</button></view>
    <text v-if="returnLoading" class="hint">正在加载本维修单全部可还物料…</text>
    <view v-else-if="returnError"><text class="hint">{{ returnError }}</text><button class="pick-add" @click="loadReturnMaterials">重新加载</button></view>
    <text v-else-if="!lines.length" class="hint">{{ type === '领料' ? '请先选择需要领用的物料。' : '本维修单暂无本人可还物料。' }}</text>
    <view v-for="line in (type === '领料' ? visibleLines : [])" :key="line.id" class="pick-line" :class="{ 'pick-line--invalid': invalidId === line.id }">
      <view class="request-material__heading"><text class="request-material__name">{{ material(line.id).name }}</text><button class="request-material__remove" @click="toggle(line.id)">移除</button></view>
      <text class="request-material__spec">{{ [material(line.id).brand, material(line.id).spec, material(line.id).unit].filter(Boolean).join(' · ') || '暂无规格' }}</text>
      <view class="pick-quantity"><text class="pick-stock">库存 {{ maximum(line.id) }} {{ material(line.id).unit }}</text><view class="pick-input"><text>领料数量<text class="required"> *</text></text><input v-model="line.qty" type="digit" :aria-label="`${material(line.id).name}领料数量`" :focus="invalidId === line.id" @input="invalidId = ''" /></view></view>
      <text v-if="invalidId === line.id" class="pick-error">请填写大于 0 的领料数量</text>
    </view>
    <view v-if="type === '领料' && lines.length > pageSize" class="pick-pagination"><button :disabled="page <= 1" @click="page--">上一页</button><text>第 {{ page }} / {{ pageCount }} 页</text><button :disabled="page >= pageCount" @click="page++">下一页</button></view>
    <view v-for="line in (type === '还料' ? visibleLines : [])" :key="line.id" class="request-material request-material--compact">
      <view class="request-material__identity"><view class="request-material__heading"><text class="request-material__name">{{ material(line.id).name }}</text></view><text class="request-material__spec">{{ [material(line.id).brand, material(line.id).spec].filter(Boolean).join(' · ') || '品牌型号未提供' }}</text></view>
      <view class="request-material__operation"><view class="request-material__operation-row"><text class="request-material__label">数量（{{ material(line.id).unit || '单位未提供' }}）</text><view class="request-material__control"><button class="request-material__step" :aria-label="`减少${material(line.id).name}还料数量`" :disabled="Number(line.qty) <= 0" @click="step(line, -1)"><wd-icon name="minus-circle" size="18px" /></button><input v-model="line.qty" class="request-material__input" type="digit" inputmode="decimal" :aria-label="`${material(line.id).name}本次还料数量`" placeholder="数量" /><button class="request-material__step" :aria-label="`增加${material(line.id).name}还料数量`" :disabled="Number(line.qty) >= maximum(line.id)" @click="step(line, 1)"><wd-icon name="add-circle" size="18px" /></button></view></view></view>
      <view class="request-material__operation-footer"><text class="request-material__hint">可还 {{ maximum(line.id) }} {{ material(line.id).unit }}</text><button class="request-material__fill" :aria-label="`全部归还${material(line.id).name}`" @click="fillReturn(line)">全部归还</button></view>
      <view v-if="needsDifferenceReason(line)" class="request-material__reason"><text class="request-material__label">差异原因（必填）</text><textarea v-model="line.reason" maxlength="1000" :aria-label="`${material(line.id).name}还料差异原因`" placeholder="说明本次还料数量与可还数量不一致的原因" /></view>
    </view>
    <view v-if="type === '还料' && lines.length" class="pick-pagination"><button :disabled="page <= 1" @click="page--">上一页</button><text>{{ page }} / {{ pageCount }} · 共 {{ lines.length }} 项</text><button :disabled="page >= pageCount" @click="page++">下一页</button></view>
    <text v-if="type === '还料' && lines.length" class="hint">默认带出本人全部可还物料。不归还的物料可填 0；数量与可还数量不一致时须填写差异原因。提交后由库管核对入库。</text>
  </SectionCard>
  <SectionCard v-if="type === '领料'" title="申请说明"><textarea v-model="remark" class="remark" maxlength="1000" aria-label="申请备注" placeholder="填写用途或补充说明（选填）" /><text class="hint">领料须运维主管审批，审批后由库管执行出库。</text></SectionCard>
  <RepairMaterialPicker v-if="showPicker" :selected="lines.map(l => material(l.id))" :return-mode="type === '还料'" :order-id="repair.id" :handler-user-id="actorId" @close="showPicker = false" @confirm="confirmMaterials" />
</template>
<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { repairOrderApi } from '@/service/repairOrder'
import dayjs from 'dayjs'
import RepairMaterialPicker from './RepairMaterialPicker.vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import { type RepairCase, type MaterialLine, type RepairMaterial } from './repairView'
const props = defineProps<{ repair: RepairCase & {raw: Record<string,any>}; type: '领料' | '还料'; actorId: string }>()
const emit = defineEmits<{ submit: [lines: MaterialLine[], remark: string, useDate?: string] }>()
const useDate = ref(dayjs().format('YYYY-MM-DD'))
interface DraftLine { id: string; qty: string; reason: string }
const lines = ref<DraftLine[]>([])
const remark = ref(''), showPicker = ref(false)
const pageSize = computed(() => props.type === '还料' ? 10 : 5), page = ref(1), invalidId = ref('')
const pageCount = computed(() => Math.max(1, Math.ceil(lines.value.length / pageSize.value)))
const visibleLines = computed(() => lines.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
watch(pageCount, count => { page.value = Math.min(page.value, count) }, { flush:'sync' })
const catalog = ref<RepairMaterial[]>([])
const returnLoading = ref(false), returnError = ref('')
let returnRequest = 0
async function loadReturnMaterials() {
  const current = ++returnRequest
  if (props.type !== '还料') return
  lines.value = []; catalog.value = []; page.value = 1
  returnLoading.value = true; returnError.value = ''; showPicker.value = false
  try {
    if (!props.repair.id || !props.actorId) throw new Error('缺少维修单或领料人信息，请重新打开详情')
    const materials: RepairMaterial[] = [], seen = new Set<string>()
    let received = 0
    for (let pageNo = 1; ; pageNo++) {
      const result = await repairOrderApi.materialAccounts(props.repair.id, props.actorId, pageNo, 10)
      if (current !== returnRequest) return
      if (!Array.isArray(result?.records) || result.total == null || !Number.isFinite(Number(result.total)) || Number(result.total) < 0 || (result.orderId && result.orderId !== props.repair.id) || (result.handlerUserId && result.handlerUserId !== props.actorId)) throw new Error('维修物料总账响应不完整或范围不匹配')
      for (const row of result.records) {
        const key = JSON.stringify([String(row.materialId || ''), String(row.baseUnitId || '')])
        if (seen.has(key)) throw new Error('物料分页重复，请重新加载')
        seen.add(key)
        const qty = Number(row.availableReturnQty)
        if (!row.materialId || row.availableReturnQty == null || !Number.isFinite(qty) || qty <= 0) continue
        materials.push({id:key,materialId:String(row.materialId),baseUnitId:row.baseUnitId,name:row.materialName || '未命名物料',code:row.materialCode || '',brand:row.brand_dictText || row.brand || '',spec:row.model || '',unit:row.baseUnitName || '',stock:0,availableReturnQty:qty})
      }
      received += result.records.length
      if (received >= Number(result.total)) break
      if (!result.records.length || pageNo >= 1000) throw new Error('物料分页不完整，请重新加载')
    }
    confirmMaterials(materials)
  } catch (e:any) { if (current === returnRequest) returnError.value = e.message || '可还物料加载失败，请重试' }
  finally { if (current === returnRequest) returnLoading.value = false }
}
onMounted(() => { if (props.type === '还料') void loadReturnMaterials() })
watch(() => [props.repair.id, props.actorId, props.type], () => {
  ++returnRequest; lines.value = []; catalog.value = []; returnLoading.value = false; returnError.value = ''
  if (props.type === '还料') void loadReturnMaterials()
})
onBeforeUnmount(() => { ++returnRequest })
function confirmMaterials(materials: RepairMaterial[]) {
  catalog.value = materials.map(m => ({ ...m }))
  lines.value = materials.map(m => lines.value.find(l => l.id === m.id) || { id: m.id, qty: props.type === '还料' ? String(m.availableReturnQty) : '1', reason: '' })
  showPicker.value = false
}
function material(id: string) { return catalog.value.find(m => m.id === id)! }
function maximum(id: string) { return props.type === '还料' ? material(id).availableReturnQty ?? 0 : material(id).stock }
function fillReturn(line: DraftLine) { line.qty = String(maximum(line.id)) }
function needsDifferenceReason(line: DraftLine) { return line.qty.trim() !== '' && Number.isFinite(Number(line.qty)) && Number(line.qty) >= 0 && Number(line.qty) !== maximum(line.id) }
function toggle(id: string) { lines.value = lines.value.some(l => l.id === id) ? lines.value.filter(l => l.id !== id) : [...lines.value, { id, qty: '1', reason: '' }] }
function step(line: DraftLine, delta: number) { line.qty = String(Math.max(0, Math.min(props.type === '还料' ? maximum(line.id) : Infinity, Number(((Number(line.qty) || 0) + delta).toFixed(4))))) }
function submit() {
  if (returnLoading.value || returnError.value) { uni.showToast({title:'请等待可还物料完整加载后再提交',icon:'none'}); return }
  if (props.type === '领料') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(useDate.value) || !dayjs(useDate.value).isValid() || dayjs(useDate.value).format('YYYY-MM-DD') !== useDate.value) { uni.showToast({title:'请选择有效的使用时间',icon:'none'}); return }
    if (!lines.value.length) { uni.showToast({title:'请先选择领用物料',icon:'none'}); return }
    const index = lines.value.findIndex(l => !l.qty.trim() || !Number.isFinite(Number(l.qty)) || Number(l.qty) <= 0)
    if (index >= 0) {
      page.value = Math.floor(index / pageSize.value) + 1; invalidId.value = lines.value[index].id
      uni.showToast({title:`请检查第 ${page.value} 页领料数量`,icon:'none'}); return
    }
  }
  if (props.type === '还料') {
    if (!lines.value.length || !lines.value.some(l => Number(l.qty) > 0)) { uni.showToast({title:'请至少填写一项大于 0 的还料数量',icon:'none'}); return }
    const invalid = lines.value.find(l => !l.qty.trim() || !/^\d+(\.\d{1,4})?$/.test(l.qty) || Number(l.qty) > maximum(l.id) || !material(l.id).unit || (Number(l.qty) !== maximum(l.id) && !l.reason.trim()))
    if (invalid) { page.value = Math.floor(lines.value.indexOf(invalid) / pageSize.value) + 1; uni.showToast({title:`请检查第 ${page.value} 页还料数量、单位及差异原因`,icon:'none'}); return }
  }
  emit('submit', lines.value.map(l => ({ id: l.id, reason: l.reason, qty: l.qty.trim() ? Number(l.qty) : NaN, material: { ...material(l.id) } })), remark.value, props.type === '领料' ? useDate.value : undefined)
}
defineExpose({ submit })
</script>
<style scoped lang="scss">
@import '../materialRequest.scss';
.return-remark-row { display:flex; align-items:flex-start; gap:16px; padding:8px 0; }.return-label { flex:none; width:64px; font-size:15px; color:#344054; padding-top:10px; }.return-remark-row .remark { flex:1; min-width:0; height:72px; font-size:14px; }
.use-date-row { display:flex; align-items:center; justify-content:space-between; gap:12px; font-size:15px; color:#344054; }
.use-date-row > text { flex-shrink:0; }
.use-date-row picker { flex:1; min-width:0; }
.use-date-value { display:flex; align-items:center; justify-content:flex-end; gap:8px; min-height:44px; }
.pick-toolbar, .pick-quantity, .pick-input, .pick-pagination { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.pick-toolbar { color:#536176; font-size:14px; padding-bottom:8px; }
.pick-add { margin:0; padding:0 12px; min-height:44px; line-height:44px; background:#f0f6ff; color:#1769c2; font-size:14px; border-radius:8px; }
.pick-add::after { border:0; }
.pick-line { padding:12px 0; border-top:1px solid #edf0f3; }
.pick-quantity { flex-wrap:wrap; margin-top:8px; font-size:14px; }
.pick-stock { min-width:0; color:#536176; overflow-wrap:anywhere; }
.pick-input { margin-left:auto; gap:8px; color:#344054; }
.pick-input input { width:76px; height:44px; box-sizing:border-box; padding:0 8px; border:1px solid #b8c0cc; border-radius:8px; text-align:center; font-size:16px; color:#1d2939; }
.pick-input input:focus { outline:2px solid #1769c2; outline-offset:2px; }
.pick-line--invalid input { border-color:#b42318; }
.pick-error { display:block; margin-top:8px; color:#b42318; font-size:14px; }
.pick-pagination { border-top:1px solid #edf0f3; padding-top:12px; font-size:14px; color:#536176; }
.pick-pagination button { margin:0; padding:0 12px; min-height:44px; line-height:44px; font-size:14px; }
.info { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; font-size: 15px; }
.info > text:last-child { text-align: right; overflow-wrap: anywhere; }
.hint { display: block; color: #536176; font-size: 14px; line-height: 1.6; margin-top: 12px; }
.add-material { margin: 0 0 12px; min-height: 44px; border: 1px dashed #a6c8ff; color: #1769c2; background: #f5f9ff; font-size: 16px; }
.label { display: block; margin-bottom: 12px; }
.required { color: #b42318; }
.option { display: flex; align-items: center; gap: 8px; min-height: 48px; border-bottom: 1px solid #edf0f3; font-size: 15px; }
.remark { width: 100%; height: 100px; box-sizing: border-box; padding: 12px; border: 1px solid #b8c0cc; border-radius: 8px; font-size: 16px; }
.remark:focus { outline: 2px solid #1769c2; outline-offset: 2px; }
</style>
