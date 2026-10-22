<template>
  <SectionCard title="关联信息"><view class="info"><text>关联项目</text><text>{{ repair.project }}</text></view><view class="info"><text>维修产品</text><text>{{ repair.product }}</text></view><text class="hint">申请自动关联当前维修单。还料按原领料明细提交，剩余额度由后端核验。</text></SectionCard>
  <SectionCard :title="type === '领料' ? '领料明细' : '还料信息'">
    <view v-if="type === '领料'" class="pick-toolbar"><text>已选 {{ lines.length }} 种物料</text><button class="pick-add" @click="showPicker = true"><wd-icon name="add" /> 添加物料</button></view>
    <text v-if="!lines.length" class="hint">{{ type === '领料' ? '请先选择需要领用的物料。' : '暂无可申请还料的物料；已提交的数量需等待库管核对。' }}</text>
    <view v-for="line in (type === '领料' ? visibleLines : [])" :key="line.id" class="pick-line" :class="{ 'pick-line--invalid': invalidId === line.id }">
      <view class="request-material__heading"><text class="request-material__name">{{ material(line.id).name }}</text><button class="request-material__remove" @click="toggle(line.id)">移除</button></view>
      <text class="request-material__spec">{{ [material(line.id).brand, material(line.id).spec, material(line.id).unit].filter(Boolean).join(' · ') || '暂无规格' }}</text>
      <view class="pick-quantity"><text class="pick-stock">库存 {{ maximum(line.id) }} {{ material(line.id).unit }}</text><view class="pick-input"><text>领料数量<text class="required"> *</text></text><input v-model="line.qty" type="digit" :aria-label="`${material(line.id).name}领料数量`" :focus="invalidId === line.id" @input="invalidId = ''" /></view></view>
      <text v-if="invalidId === line.id" class="pick-error">请填写大于 0 的领料数量</text>
    </view>
    <view v-if="type === '领料' && lines.length > pageSize" class="pick-pagination"><button :disabled="page <= 1" @click="page--">上一页</button><text>第 {{ page }} / {{ pageCount }} 页</text><button :disabled="page >= pageCount" @click="page++">下一页</button></view>
    <view v-for="line in (type === '还料' ? lines : [])" :key="line.id" class="request-material">
      <view class="request-material__heading"><text class="request-material__name">{{ material(line.id).name }}</text><button class="request-material__remove" @click="toggle(line.id)">移除</button></view>
      <text class="request-material__spec">{{ [material(line.id).brand, material(line.id).spec].filter(Boolean).join(' · ') || '暂无规格' }}</text>
      <view class="request-material__summary"><view><text class="request-material__summary-label">{{ type === '领料' ? '库存数量' : '可申请还料' }}</text><text class="request-material__value">{{ type === '还料' ? '提交时核验' : maximum(line.id) }}</text><text class="request-material__unit">{{ material(line.id).unit }}</text></view><view><text class="request-material__summary-label">本次{{ type }}</text><text class="request-material__value">{{ line.qty || 0 }}</text><text class="request-material__unit">{{ material(line.id).unit }}</text></view></view>
      <view class="request-material__operation"><view class="request-material__operation-row"><text class="request-material__label">{{ type }}数量<text class="required"> *</text></text><view class="request-material__control"><button class="request-material__step" :aria-label="`减少${material(line.id).name}数量`" :disabled="Number(line.qty) <= 0" @click="step(line, -1)"><wd-icon name="minus" /></button><input v-model="line.qty" class="request-material__input" type="digit" :aria-label="`${material(line.id).name}${type}数量`" /><button class="request-material__step" :aria-label="`增加${material(line.id).name}数量`" @click="step(line, 1)"><wd-icon name="add" /></button></view></view></view>
      <view v-if="type === '还料'" class="request-material__reason"><text>还料说明</text><textarea v-model="line.reason" maxlength="1000" :aria-label="`${material(line.id).name}还料说明`" placeholder="填写本次还料说明" /></view>
    </view>
  </SectionCard>
  <SectionCard title="申请说明"><textarea v-model="remark" class="remark" maxlength="1000" aria-label="申请备注" placeholder="填写用途或补充说明（选填）" /><text class="hint">{{ type === '领料' ? '领料须运维主管审批，审批后由库管执行出库。' : '提交申请不会直接入库或结清物料；合格回库、报废或遗失由库管核对处置。' }}</text></SectionCard>
  <RepairMaterialPicker v-if="showPicker" :selected="lines.map(l => material(l.id))" @close="showPicker = false" @confirm="confirmMaterials" />
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import RepairMaterialPicker from './RepairMaterialPicker.vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import { type RepairCase, type MaterialLine, type RepairMaterial } from './repairWorkflow'
const props = defineProps<{ repair: RepairCase & {raw: Record<string,any>}; type: '领料' | '还料' }>()
const emit = defineEmits<{ submit: [lines: MaterialLine[], remark: string] }>()
interface DraftLine { id: string; qty: string; reason: string }
const sources = (props.repair.raw.materialLinks || []).filter((m: any) => m.linkType === 'PICK' && m.stockApplyItemId)
const lines = ref<DraftLine[]>(props.type === '还料' ? sources.map((m: any) => ({ id: m.stockApplyItemId, qty: '', reason: '' })) : [])
const remark = ref(''), showPicker = ref(false)
const pageSize = 5, page = ref(1), invalidId = ref('')
const pageCount = computed(() => Math.max(1, Math.ceil(lines.value.length / pageSize)))
const visibleLines = computed(() => lines.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch(pageCount, count => { page.value = Math.min(page.value, count) }, { flush:'sync' })
const catalog = ref<RepairMaterial[]>(props.type === '还料' ? sources.map((m: any) => ({id:m.stockApplyItemId,name:m.material?.materialName || m.material?.name || m.materialId,brand:m.material?.brand || '',spec:m.material?.spec || '',unit:m.material?.unitName || '',stock:0})) : [])
function confirmMaterials(materials: RepairMaterial[]) {
  catalog.value = materials.map(m => ({ ...m }))
  lines.value = materials.map(m => lines.value.find(l => l.id === m.id) || { id: m.id, qty: '1', reason: '' })
  showPicker.value = false
}
function material(id: string) { return catalog.value.find(m => m.id === id)! }
function maximum(id: string) { return props.type === '还料' ? Infinity : material(id).stock }
function toggle(id: string) { lines.value = lines.value.some(l => l.id === id) ? lines.value.filter(l => l.id !== id) : [...lines.value, { id, qty: '1', reason: '' }] }
function step(line: DraftLine, delta: number) { line.qty = String(Math.max(0, Math.min(props.type === '还料' ? maximum(line.id) : Infinity, Number(((Number(line.qty) || 0) + delta).toFixed(4))))) }
function submit() {
  if (props.type === '领料') {
    if (!lines.value.length) { uni.showToast({title:'请先选择领用物料',icon:'none'}); return }
    const index = lines.value.findIndex(l => !l.qty.trim() || !Number.isFinite(Number(l.qty)) || Number(l.qty) <= 0)
    if (index >= 0) {
      page.value = Math.floor(index / pageSize) + 1; invalidId.value = lines.value[index].id
      uni.showToast({title:`请检查第 ${page.value} 页领料数量`,icon:'none'}); return
    }
  }
  emit('submit', lines.value.map(l => ({ ...l, qty: l.qty.trim() ? Number(l.qty) : NaN, material: { ...material(l.id) } })), remark.value)
}
defineExpose({ submit })
</script>
<style scoped lang="scss">
@import '../materialRequest.scss';
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
