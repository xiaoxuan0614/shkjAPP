<route lang="json5">
{
  style: {
    navigationBarTitleText: '还料申请',
  },
}
</route>
<template>
  <PageLayout :navbarShow="false">
    <scroll-view class="page" :scroll-y="true">
      <SectionCard title="关联信息">
        <view class="form-row">
          <text class="label">关联项目</text>
          <button class="project-trigger" :disabled="submitting || submitted" @click="openProjects">{{ selectedProject ? formatProjectName(selectedProject) : '输入项目名称查询' }} <wd-icon name="arrow-down" size="14px" /></button>
        </view>
        <view class="form-row">
          <text class="label">备注</text>
          <textarea v-model="remark" class="return-remark" :disabled="submitting || submitted" placeholder="选填" placeholder-style="color:#767676" />
        </view>
      </SectionCard>

      <SectionCard title="还料信息">
        <view v-if="!items.length" class="empty-tip">{{ materialsLoading ? '正在加载可还料物料…' : materialsError ? '物料加载失败，请重试' : selectedProject ? '暂无可还料物料' : '选择项目后查看可还料物料' }}<button v-if="materialsError" @click="loadMaterials">重新加载</button></view>
        <view v-for="m in visibleItems" :key="m.materialId" class="request-material">
          <view class="request-material__heading"><text class="request-material__name">{{ m.name }}</text><text class="request-material__code">{{ m.materialCode || '暂无编码' }}</text></view>
          <text class="request-material__spec">规格：{{ m.spec || '暂无规格' }}</text>
          <view class="request-material__summary">
            <view><text class="request-material__summary-label">应还数量</text><text class="request-material__value">{{ m.shouldReturnQty }}</text><text class="request-material__unit">{{ m.unitName }}</text></view>
            <view><text class="request-material__summary-label">本次还料</text><text class="request-material__value">{{ m.returnQty === '' ? '—' : m.returnQty }}</text><text class="request-material__unit">{{ m.unitName }}</text></view>
          </view>
          <view class="request-material__operation">
            <view class="request-material__operation-row">
                <text class="request-material__label">本次还料</text>
                <view class="request-material__control">
                  <button class="request-material__step" :disabled="submitting || submitted || Number(m.returnQty) <= 0" :aria-label="`减少${m.name}还料数量`" @click="stepReturnQty(m, -1)"><wd-icon name="minus-circle" size="18px" /></button>
                  <input v-model="m.returnQty" class="request-material__input" type="digit" inputmode="decimal" :disabled="submitting || submitted" :aria-label="`${m.name}本次还料数量`" placeholder="数量" placeholder-style="color:#767676" />
                  <button class="request-material__step" :disabled="submitting || submitted || Number(m.returnQty) >= m.shouldReturnQty" :aria-label="`增加${m.name}还料数量`" @click="stepReturnQty(m, 1)"><wd-icon name="add-circle" size="18px" /></button>
                  <button class="request-material__fill" :disabled="submitting || submitted" :aria-label="`全部归还${m.name}`" @click="m.returnQty = String(m.shouldReturnQty)">全部</button>
                </view>
            </view>
            <text class="request-material__hint">本次最多可还 {{ m.shouldReturnQty }} {{ m.unitName }}</text>
            <view v-if="needsDifferenceReason(m)" class="request-material__reason">
              <text class="request-material__label">差异原因（必填）</text>
              <textarea v-model="m.differenceReason" :disabled="submitting || submitted" :aria-label="`${m.name}还料差异原因`" placeholder="说明本次还料数量与系统应还数量不一致的原因" placeholder-style="color:#767676" />
            </view>
          </view>
        </view>
        <view v-if="items.length" class="return-pagination">
          <button :disabled="materialPage <= 1" @click="materialPage--">上一页</button><text>{{ materialPage }} / {{ materialPages }} · 共 {{ items.length }} 项</text><button :disabled="materialPage >= materialPages" @click="materialPage++">下一页</button>
        </view>
        <view v-if="items.length" class="tip">默认按系统应还数量填写。与应还数量不一致（包括填 0）须填写差异原因；至少一项还料数量须大于 0。合格回库、报废或遗失由库管核对处置，提交申请不会直接入库。</view>
      </SectionCard>

      <view class="submit-wrap">
        <template v-if="submitted"><text class="success-text">还料申请已提交{{ returnNo ? `，单号：${returnNo}` : '' }}。{{ submissionMessage }}</text><wd-button @click="back">返回</wd-button></template>
        <wd-button v-else size="large" type="primary" :loading="submitting" :disabled="materialsLoading || materialsError || !items.length" @click="submit">提交还料申请</wd-button>
      </view>
    </scroll-view>
    <wd-popup v-model="showProjects" position="bottom" :root-portal="true" :safe-area-inset-bottom="true">
      <view class="project-picker">
        <view class="project-picker__head"><text>选择参与项目</text><button @click="showProjects = false">关闭</button></view>
        <input v-model="projectKeyword" class="project-picker__input" placeholder="输入主项目或分期项目名称" placeholder-style="color:#767676" confirm-type="search" />
        <scroll-view scroll-y class="project-picker__list">
          <text v-if="projectsLoading" class="empty-tip">正在加载参与项目…</text>
          <button v-else-if="projectsError" @click="loadProjects">项目加载失败，点击重试</button>
          <template v-else>
            <button v-for="project in filteredProjects" :key="project.periodId" class="project-picker__row" @click="selectProject(project)">
              <text>{{ project.projectName || '主项目名称未返回' }}</text><text>{{ project.periodName || '分期名称未返回' }}</text>
            </button>
            <text v-if="!filteredProjects.length" class="empty-tip">{{ projectKeyword.trim() ? '没有匹配的参与项目' : '暂无已确认参与的项目' }}</text>
          </template>
        </scroll-view>
      </view>
    </wd-popup>
  </PageLayout>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from 'wot-design-uni'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import { projectApi, stockApi, unwrapRecords, formatProjectName } from '@/service/shkj'

const toast = useToast()
const remark = ref(''), submitted = ref(false)
const items = ref<any[]>([])
const materialPage = ref(1)
const materialPages = computed(() => Math.max(1, Math.ceil(items.value.length / 10)))
const visibleItems = computed(() => items.value.slice((materialPage.value - 1) * 10, materialPage.value * 10))
const needsDifferenceReason = (item: any) => item.returnQty !== null && item.returnQty !== undefined && String(item.returnQty).trim() !== '' && Number.isFinite(Number(item.returnQty)) && Number(item.returnQty) >= 0 && Math.abs(Number(item.returnQty) - Number(item.shouldReturnQty)) > 1e-8
const submitting = ref(false)
const stepReturnQty = (item: any, delta: number) => {
  const current = Number(item.returnQty)
  item.returnQty = String(Math.min(Number(item.shouldReturnQty), Math.max(0, Number(((Number.isFinite(current) ? current : 0) + delta).toFixed(4)))))
}
const returnNo = ref('')
const submissionMessage = ref('请在申请记录中查看审批和入库进度。')
const selectedProject = ref<any>(null), projects = ref<any[]>([]), projectKeyword = ref('')
const showProjects = ref(false), projectsLoading = ref(false), projectsError = ref(false)
const materialsLoading = ref(false), materialsError = ref(false)
let materialRequest = 0
const filteredProjects = computed(() => {
  const keyword = projectKeyword.value.trim().toLowerCase()
  return projects.value.filter(project => !keyword || [project.projectName, project.periodName].some(name => String(name || '').toLowerCase().includes(keyword)))
})
const loadProjects = async () => {
  if (projectsLoading.value) return
  projectsLoading.value = true; projectsError.value = false
  try {
    // 不传状态或用户 ID：后端返回当前成员已确认参与的全部项目分期。
    const response = await projectApi.participatedProjects()
    const unique = new Map<string, any>()
    unwrapRecords(response).forEach(project => { if (project.periodId) unique.set(String(project.periodId), project) })
    projects.value = [...unique.values()]
  } catch { projects.value = []; projectsError.value = true }
  finally { projectsLoading.value = false }
}
const openProjects = () => {
  if (submitting.value || submitted.value) return
  projectKeyword.value = ''; showProjects.value = true
  void loadProjects()
}
const selectProject = (project: any) => {
  if (submitting.value || submitted.value) return
  showProjects.value = false
  if (String(selectedProject.value?.periodId || '') === String(project.periodId) && !materialsError.value) return
  selectedProject.value = project
  void loadMaterials()
}
onLoad(async (query) => {
  await loadProjects()
  const requestedId = String(query?.periodId || '')
  if (!requestedId) return
  const project = projects.value.find(item => String(item.periodId) === requestedId)
  if (project) selectProject(project)
})

const loadMaterials = async () => {
  if (submitting.value || submitted.value) return
  const current = ++materialRequest
  const periodId = String(selectedProject.value?.periodId || '')
  items.value = []; materialPage.value = 1; materialsError.value = false; materialsLoading.value = false
  if (!periodId) return
  materialsLoading.value = true
  try {
    const all = new Map<string, any>()
    const pageSize = 100
    for (let pageNo = 1; ; pageNo++) {
      const response: any = await projectApi.materialAccounts(periodId, { pageNo, pageSize })
      if (current !== materialRequest || periodId !== String(selectedProject.value?.periodId)) return
      const result = response?.result
      if (!Array.isArray(result?.records) || !Number.isFinite(Number(result.total))) throw new Error('总账响应异常')
      for (const row of result.records) {
        const qty = Number(row.remainingReturnQty)
        if (row.materialId && Number.isFinite(qty) && qty > 0) all.set(String(row.materialId), {
          materialId: String(row.materialId), name: row.materialName || '未命名物料', materialCode: row.materialCode || '',
          spec: [row.brand, row.model].filter(Boolean).join(' / '), unitName: row.baseUnitName || '',
          shouldReturnQty: qty, returnQty: String(qty), differenceReason: '',
        })
      }
      if (pageNo * pageSize >= Number(result.total)) break
      if (!result.records.length) throw new Error('总账分页数据不完整')
    }
    items.value = [...all.values()]
  } catch (e) {
    if (current === materialRequest) materialsError.value = true
  } finally { if (current === materialRequest) materialsLoading.value = false }
}

const submit = async () => {
  if (submitting.value || submitted.value || materialsLoading.value || materialsError.value) return
  const periodId = String(selectedProject.value?.periodId || '')
  if (!periodId) return toast.warning('请选择关联项目')
  if (!items.value.length) return toast.warning('无可还料物料')
  const invalid = items.value.find(item => String(item.returnQty).trim() === '' || !Number.isFinite(Number(item.returnQty)) || Number(item.returnQty) < 0 || Number(item.returnQty) > item.shouldReturnQty)
  if (invalid) {
    materialPage.value = Math.floor(items.value.indexOf(invalid) / 10) + 1
    return toast.warning(`${invalid.name}还料数量须在 0 至 ${invalid.shouldReturnQty} 之间`)
  }
  const selected = items.value
  const missingUnit = selected.find(item => !item.unitName)
  if (missingUnit) return toast.warning(`${missingUnit.name}缺少基准单位，请核实`)
  const missingReason = selected.find(item => needsDifferenceReason(item) && !item.differenceReason.trim())
  if (missingReason) {
    materialPage.value = Math.floor(items.value.indexOf(missingReason) / 10) + 1
    return toast.warning(`${missingReason.name}请填写差异原因`)
  }
  if (!selected.some(item => Number(item.returnQty) > 0)) return toast.warning('请至少填写一条大于 0 的还料数量')
  const payload = {
    applyType: 'IN', usageType: 'PROJECT', periodId,
    ...(remark.value.trim() ? { remark: remark.value.trim() } : {}),
    itemList: selected.map(item => ({
      materialId: item.materialId, unitName: item.unitName, unitQty: Number(item.returnQty),
      ...(needsDifferenceReason(item) ? { remark: item.differenceReason.trim() } : {}),
    })),
  }
  submitting.value = true
  try {
    const confirmed = await new Promise<boolean>(resolve => uni.showModal({
      title: '提交还料申请', content: `确认提交“${formatProjectName(selectedProject.value)}”的 ${selected.length} 项还料？`,
      success: result => resolve(Boolean(result.confirm)), fail: () => resolve(false),
    }))
    if (!confirmed) return
    const res: any = await stockApi.addApply(payload)
    returnNo.value = String(res?.result?.applyNo || '')
    submissionMessage.value = String(res?.result?.status) === '1' ? '申请已通过，等待库管办理入库。' : String(res?.result?.status) === '2' ? '等待审批，通过后由库管办理入库。' : '请在申请记录中查看审批和入库进度。'
    submitted.value = true
    toast.success('还料申请已提交')
  } catch (e) {
    toast.error('提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

const back = () => getCurrentPages().length > 1 ? uni.navigateBack() : uni.redirectTo({ url: '/pages/ops/project' })
</script>

<style lang="scss" scoped>
@import './components/materialRequest.scss';
.return-remark { flex: 1; min-width: 0; height: 64px; font-size: 14px; line-height: 1.6; }
.return-pagination { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 16px; font-size: 12px; color: #536176; }
.return-pagination button { margin: 0; padding: 0 12px; min-height: 44px; line-height: 44px; font-size: 13px; }
.success-text { display: block; margin-bottom: 16px; color: #253247; font-size: 14px; line-height: 1.7; }
.project-trigger { flex: 1; min-width: 0; margin: 0; padding: 8px 0; min-height: 44px; background: transparent; text-align: left; font-size: 14px; line-height: 1.6; color: #536176; overflow-wrap: anywhere; }
.project-trigger::after, .project-picker__row::after { border: 0; }
.project-picker { display: flex; flex-direction: column; height: 70vh; padding: 16px; box-sizing: border-box; background: #fff; }
.project-picker__head { display: flex; align-items: center; justify-content: space-between; font-size: 18px; color: #253247; }
.project-picker__head button { margin: 0; min-height: 44px; font-size: 14px; background: transparent; }
.project-picker__input { flex: none; height: 44px; padding: 0 12px; margin: 12px 0; background: #f4f6f8; border-radius: 8px; font-size: 16px; }
.project-picker__list { flex: 1; min-height: 0; height: 0; }
.project-picker__row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 14px 0; margin: 0; min-height: 48px; background: #fff; border-bottom: 1px solid #edf0f4; border-radius: 0; text-align: left; line-height: 1.6; }
.project-picker__row text:first-child { flex: 1; min-width: 0; color: #253247; font-size: 16px; overflow-wrap: anywhere; }
.project-picker__row text:last-child { max-width: 42%; color: #536176; font-size: 14px; text-align: right; overflow-wrap: anywhere; }
.project-picker .empty-tip { display: block; color: #536176; }
.page {
  min-height: 0;
}

.form-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  .label {
    width: 84px;
    font-size: 14px;
    color: #333;
    flex: none;
  }

  .search-box {
    flex: 1;
    display: flex;
    align-items: center;
  }

  .search-input {
    flex: 1;
    font-size: 14px;
    color: #333;
  }

  .search-btn {
    color: #2f86ff;
    font-size: 13px;
    padding: 4px 0 4px 12px;
  }

  .static-val,
  .picker-value {
    flex: 1;
    font-size: 14px;
    color: #666;
  }
}

.empty-tip {
  color: #999;
  font-size: 13px;
  text-align: center;
  padding: 30px 0;
}

.item-head {
  display: flex;
  font-size: 12px;
  color: #999;
  padding-bottom: 8px;

  text {
    flex: 1;
    text-align: center;

    &:first-child {
      flex: 3;
      text-align: left;
    }
  }
}

.material {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-top: 1px solid #f5f5f5;

  &__info {
    flex: 3;
  }

  &__name {
    font-size: 14px;
    color: #333;
  }

  &__spec {
    font-size: 12px;
    color: #999;
    margin-top: 2px;
  }

  &__num {
    flex: 1;
    text-align: center;
    font-size: 14px;
    color: #333;

    &--key {
      color: #f56c6c;
      font-weight: 700;
    }
  }
}

.tip {
  font-size: 12px;
  color: #536176;
  line-height: 1.7;
  margin-top: 10px;
  background: #f7f8fa;
  padding: 8px 10px;
  border-radius: 6px;
}

.submit-wrap {
  padding: 20px 16px 40px;
}

.done-box {
  text-align: center;
  padding: 8px 0;

  .done-icon {
    font-size: 40px;
  }

  .done-no {
    font-size: 15px;
    font-weight: 600;
    margin-top: 10px;
  }

  .done-desc {
    font-size: 13px;
    color: #999;
    margin-top: 6px;
  }
}
</style>
