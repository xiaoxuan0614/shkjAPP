<template>
  <wd-popup
    v-model="visible"
    position="bottom"
    :root-portal="true"
    :safe-area-inset-bottom="true"
    :z-index="2300"
    custom-style="border-radius:16px 16px 0 0;"
  >
    <view class="manager-picker">
      <view class="manager-picker__head">
        <text class="manager-picker__title">选择项目经理</text>
        <button class="manager-picker__close" aria-label="关闭项目经理选择" @click="close">
          <wd-icon name="close" size="18px" />
        </button>
      </view>

      <view class="manager-picker__search">
        <wd-search
          v-model="keyword"
          hide-cancel
          placeholder="输入姓名搜索"
          @search="search"
          @clear="search"
        />
      </view>
      <view v-if="selectedName" class="manager-picker__selected">
        <text>当前已选</text>
        <text>{{ selectedName }}</text>
      </view>

      <scroll-view class="manager-picker__list" scroll-y @scrolltolower="loadMore">
        <view v-if="loading && !rows.length" class="manager-picker__state">正在加载人员…</view>
        <view v-else-if="loadFailed && !rows.length" class="manager-picker__state">
          <text>人员列表加载失败</text>
          <wd-button size="small" plain @click="load(true)">重新加载</wd-button>
        </view>
        <view v-else-if="!rows.length" class="manager-picker__state">暂无匹配人员</view>
        <template v-else>
          <button
            v-for="item in rows"
            :key="item.id"
            class="manager-picker__item"
            :class="{ 'manager-picker__item--selected': selectedId === item.id }"
            @click="select(item)"
          >
            <view class="manager-picker__person">
              <text class="manager-picker__name">{{ item.name }}</text>
              <text v-if="item.username" class="manager-picker__account">
                账号 {{ item.username }}
              </text>
            </view>
            <view class="manager-picker__radio">
              <wd-icon v-if="selectedId === item.id" name="check" size="15px" />
            </view>
          </button>
          <button
            v-if="loadFailed"
            class="manager-picker__more manager-picker__more--retry"
            @click="loadMore"
          >
            加载失败，点击重试
          </button>
          <view v-else class="manager-picker__more">
            {{ loading ? '正在加载…' : hasMore ? '上拉加载更多' : '已加载全部' }}
          </view>
        </template>
      </scroll-view>

      <view class="manager-picker__actions">
        <view><wd-button block plain @click="close">取消</wd-button></view>
        <view>
          <wd-button block type="primary" :disabled="!selectedId || !selectedName" @click="confirm">
            确定
          </wd-button>
        </view>
      </view>
    </view>
  </wd-popup>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useToast } from 'wot-design-uni'
import { contractApprovalApi, type ContractManagerOption } from '@/service/contractApproval'

const emit = defineEmits<{ select: [manager: ContractManagerOption] }>()
const toast = useToast()
const visible = ref(false)
const keyword = ref('')
const rows = ref<ContractManagerOption[]>([])
const selectedId = ref('')
const selectedName = ref('')
const loading = ref(false)
const loadFailed = ref(false)
const pageNo = ref(0)
const total = ref<number | null>(null)
const reachedEnd = ref(false)
const pageSize = 20
let loadSequence = 0

const hasMore = computed(() => {
  if (total.value != null) return pageNo.value * pageSize < total.value
  return !reachedEnd.value
})

const normalize = (row: Record<string, any>): ContractManagerOption | null => {
  const id = String(row.id || row.userId || '').trim()
  const name = String(
    row.realname || row.realName || row.nickname || row.username || row.name || '',
  ).trim()
  if (!id || !name) return null
  return {
    id,
    name,
    username: String(row.username || '').trim() || undefined,
  }
}

const load = async (reset = false) => {
  if (!reset && (loading.value || !hasMore.value)) return
  const sequence = ++loadSequence
  const targetPage = reset ? 1 : pageNo.value + 1
  loading.value = true
  loadFailed.value = false
  if (reset) {
    rows.value = []
    pageNo.value = 0
    total.value = null
    reachedEnd.value = false
  }
  try {
    const response: any = await contractApprovalApi.users({
      pageNo: targetPage,
      pageSize,
      column: 'createTime',
      order: 'desc',
      ...(keyword.value.trim() ? { realname: `*${keyword.value.trim()}*` } : {}),
    })
    if (sequence !== loadSequence) return
    const result = response?.result ?? response?.data ?? {}
    const source = Array.isArray(result) ? result : result.records ?? []
    const nextRows = source.map(normalize).filter(Boolean) as ContractManagerOption[]
    const merged = reset ? nextRows : [...rows.value, ...nextRows]
    rows.value = Array.from(new Map(merged.map((item) => [item.id, item])).values())
    pageNo.value = targetPage
    const resultTotal = result?.total == null ? Number.NaN : Number(result.total)
    total.value = Number.isFinite(resultTotal) ? resultTotal : null
    reachedEnd.value = nextRows.length < pageSize
  } catch {
    if (sequence === loadSequence) loadFailed.value = true
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

const search = () => load(true)
const loadMore = () => load(false)
const select = (manager: ContractManagerOption) => {
  selectedId.value = manager.id
  selectedName.value = manager.name
}
const confirm = () => {
  if (!selectedId.value) return toast.warning('请选择项目经理')
  const current = rows.value.find((item) => item.id === selectedId.value)
  const name = current?.name || selectedName.value
  if (!name) return toast.warning('请重新选择项目经理')
  emit('select', current || { id: selectedId.value, name })
  close()
}
const open = (manager?: Partial<ContractManagerOption>) => {
  loadSequence++
  visible.value = true
  keyword.value = ''
  rows.value = []
  selectedId.value = String(manager?.id || '').trim()
  selectedName.value = String(manager?.name || '').trim()
  loading.value = false
  loadFailed.value = false
  pageNo.value = 0
  total.value = null
  reachedEnd.value = false
  load(true)
}
const close = () => {
  visible.value = false
  loadSequence++
  loading.value = false
}

defineExpose({ open, close })
</script>

<style lang="scss" scoped>
.manager-picker {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  max-width: 560px;
  height: 72vh;
  max-height: calc(100vh - 48px - env(safe-area-inset-bottom));
  max-height: calc(100dvh - 48px - env(safe-area-inset-bottom));
  margin: 0 auto;
  background: #fff;
  flex-direction: column;
}
.manager-picker__head {
  display: flex;
  padding: 12px 16px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #edf0f3;
  flex: none;
}
.manager-picker__title {
  color: #27364a;
  font-size: 18px;
  font-weight: 650;
}
.manager-picker__close {
  display: flex;
  width: 44px;
  height: 44px;
  padding: 0;
  margin: 0;
  color: #596574;
  background: transparent;
  align-items: center;
  justify-content: center;
}
button::after {
  border: none;
}
.manager-picker__search {
  padding: 8px 12px;
  background: #f6f8fa;
  flex: none;
}
.manager-picker__selected {
  display: flex;
  gap: 12px;
  padding: 8px 16px;
  color: #68788a;
  background: #edf5ff;
  font-size: 13px;
  line-height: 1.5;
  flex: none;
}
.manager-picker__selected text:last-child {
  min-width: 0;
  color: #176ac7;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.manager-picker__list {
  min-height: 0;
  height: 0;
  flex: 1;
}
.manager-picker__item {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  min-height: 64px;
  padding: 10px 16px;
  margin: 0;
  color: #27364a;
  background: #fff;
  border-bottom: 1px solid #edf0f3;
  border-radius: 0;
  align-items: center;
  justify-content: space-between;
  text-align: left;
}
.manager-picker__item--selected {
  background: #edf5ff;
}
.manager-picker__person {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}
.manager-picker__name {
  font-size: 16px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.manager-picker__account {
  color: #68788a;
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.manager-picker__radio {
  display: flex;
  width: 22px;
  height: 22px;
  margin-left: 16px;
  color: #fff;
  background: #fff;
  border: 1px solid #b8c4d0;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  flex: none;
}
.manager-picker__item--selected .manager-picker__radio {
  background: #176ac7;
  border-color: #176ac7;
}
.manager-picker__state {
  display: flex;
  gap: 16px;
  padding: 52px 16px;
  color: #68788a;
  font-size: 14px;
  align-items: center;
  flex-direction: column;
}
.manager-picker__more {
  display: block;
  box-sizing: border-box;
  width: 100%;
  padding: 14px 16px 24px;
  margin: 0;
  color: #8793a1;
  background: transparent;
  font-size: 12px;
  text-align: center;
}
.manager-picker__more--retry {
  min-height: 48px;
  color: #176ac7;
}
.manager-picker__actions {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border-top: 1px solid #edf0f3;
  flex: none;
}
.manager-picker__actions > view {
  min-width: 0;
  flex: 1;
}
</style>
