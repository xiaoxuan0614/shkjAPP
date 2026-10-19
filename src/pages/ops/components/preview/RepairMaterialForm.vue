<template>
  <SectionCard title="关联信息"><view class="info"><text>关联项目</text><text>{{ repair.project }}</text></view><view class="info"><text>维修产品</text><text>{{ repair.product }}</text></view><text class="hint">自动关联当前维修单。领料物料查询真实目录；申请提交、还料记录仍为 Mock，不产生真实业务单据。</text></SectionCard>
  <SectionCard :title="type === '领料' ? '领料明细' : '还料信息'">
    <button v-if="type === '领料'" class="add-material" @click="showPicker = true"><wd-icon name="add" /> 选择物料（可多选）</button>
    <text v-if="!lines.length" class="hint">{{ type === '领料' ? '请先选择需要领用的物料。' : '暂无可申请还料的物料；已提交的数量需等待库管核对。' }}</text>
    <view v-for="line in lines" :key="line.id" class="request-material">
      <view class="request-material__heading"><text class="request-material__name">{{ material(line.id).name }}</text><button v-if="type === '领料'" class="request-material__remove" @click="toggle(line.id)">移除</button></view>
      <text class="request-material__spec">{{ [material(line.id).brand, material(line.id).spec].filter(Boolean).join(' · ') || '暂无规格' }}</text>
      <view class="request-material__summary"><view><text class="request-material__summary-label">{{ type === '领料' ? '库存数量' : '可申请还料' }}</text><text class="request-material__value">{{ maximum(line.id) }}</text><text class="request-material__unit">{{ material(line.id).unit }}</text></view><view><text class="request-material__summary-label">本次{{ type }}</text><text class="request-material__value">{{ line.qty || 0 }}</text><text class="request-material__unit">{{ material(line.id).unit }}</text></view></view>
      <view class="request-material__operation"><view class="request-material__operation-row"><text class="request-material__label">{{ type }}数量<text class="required"> *</text></text><view class="request-material__control"><button class="request-material__step" :aria-label="`减少${material(line.id).name}数量`" :disabled="Number(line.qty) <= 0" @click="step(line, -1)"><wd-icon name="minus" /></button><input v-model="line.qty" class="request-material__input" type="digit" :aria-label="`${material(line.id).name}${type}数量`" /><button class="request-material__step" :aria-label="`增加${material(line.id).name}数量`" :disabled="type === '还料' && Number(line.qty) >= maximum(line.id)" @click="step(line, 1)"><wd-icon name="add" /></button><button v-if="type === '还料'" class="request-material__fill" @click="line.qty = String(maximum(line.id))">全部</button></view></view></view>
      <view v-if="type === '还料' && Number(line.qty) !== maximum(line.id)" class="request-material__reason"><text>差异原因<text class="required"> *</text></text><textarea v-model="line.reason" maxlength="1000" :aria-label="`${material(line.id).name}差异原因`" placeholder="与应还数量不一致，请填写原因（含填 0）" /></view>
    </view>
  </SectionCard>
  <SectionCard title="申请说明"><textarea v-model="remark" class="remark" maxlength="1000" aria-label="申请备注" placeholder="填写用途或补充说明（选填）" /><text class="hint">{{ type === '领料' ? '领料须运维主管审批，审批后由库管执行出库。' : '提交申请不会直接入库或结清物料；合格回库、报废或遗失由库管核对处置。' }}</text></SectionCard>
  <RepairMaterialPicker v-if="showPicker" :selected="lines.map(l => material(l.id))" @close="showPicker = false" @confirm="confirmMaterials" />
</template>
<script setup lang="ts">
import { ref } from 'vue'
import RepairMaterialPicker from './RepairMaterialPicker.vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import { repairMaterials, returnAvailable, type RepairCase, type MaterialLine, type RepairMaterial } from './repairWorkflow'
const props = defineProps<{ repair: RepairCase; type: '领料' | '还料' }>()
const emit = defineEmits<{ submit: [lines: MaterialLine[], remark: string] }>()
interface DraftLine { id: string; qty: string; reason: string }
const lines = ref<DraftLine[]>(props.type === '还料' ? repairMaterials.filter(m => returnAvailable(props.repair, m.id) > 0).map(m => ({ id: m.id, qty: String(returnAvailable(props.repair, m.id)), reason: '' })) : [])
const remark = ref(''), showPicker = ref(false)
const catalog = ref<RepairMaterial[]>(props.type === '还料' ? repairMaterials : [])
function confirmMaterials(materials: RepairMaterial[]) {
  catalog.value = materials.map(m => ({ ...m }))
  lines.value = materials.map(m => lines.value.find(l => l.id === m.id) || { id: m.id, qty: '1', reason: '' })
  showPicker.value = false
}
function material(id: string) { return catalog.value.find(m => m.id === id)! }
function maximum(id: string) { return props.type === '还料' ? returnAvailable(props.repair, id) : material(id).stock }
function toggle(id: string) { lines.value = lines.value.some(l => l.id === id) ? lines.value.filter(l => l.id !== id) : [...lines.value, { id, qty: '1', reason: '' }] }
function step(line: DraftLine, delta: number) { line.qty = String(Math.max(0, Math.min(props.type === '还料' ? maximum(line.id) : Infinity, Number(((Number(line.qty) || 0) + delta).toFixed(4))))) }
defineExpose({ submit: () => emit('submit', lines.value.map(l => ({ ...l, qty: l.qty.trim() ? Number(l.qty) : NaN, ...(props.type === '领料' ? { material: { ...material(l.id) } } : {}) })), remark.value) })
</script>
<style scoped lang="scss">
@import '../materialRequest.scss';
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
