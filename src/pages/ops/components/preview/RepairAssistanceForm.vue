<template>
  <SectionCard title="协助人员">
    <text class="label">选择公司用户<text class="required"> *</text></text>
    <view class="search"><input v-model="keyword" placeholder="输入姓名搜索" confirm-type="search" @confirm="search" /><button size="mini" :disabled="loading" @click="search">查询</button></view>
    <view v-if="chosen.length" class="chosen"><text>已选 {{ chosen.length }} 人</text><button v-for="u in chosen" :key="u.id" size="mini" @click="toggle(u)">{{ u.name }} · 移除</button></view>
    <text v-if="loading" class="hint">正在加载公司用户…</text>
    <button v-else-if="failed" @click="load(page)">用户加载失败，点击重试</button>
    <template v-else>
      <label v-for="u in users" :key="u.id" class="user" @click="!excluded.includes(u.id) && toggle(u)">
        <checkbox :checked="chosen.some(p => p.id === u.id)" :disabled="excluded.includes(u.id)" color="#1769c2" /><text>{{ u.name }}<text v-if="u.account" class="hint">（{{ u.account }}）</text><text v-if="excluded.includes(u.id)" class="hint"> · 已参与或待审批</text></text>
      </label>
      <text v-if="!users.length" class="hint">未找到用户，请更换姓名查询。</text>
    </template>
    <view class="pages"><button size="mini" :disabled="loading || page <= 1" @click="load(page - 1)">上一页</button><text>第 {{ page }} 页</text><button size="mini" :disabled="loading || failed || !hasMore" @click="load(page + 1)">下一页</button></view>
  </SectionCard>
  <SectionCard title="申请原因">
    <label for="assist-reason" class="label">协助原因<text class="required"> *</text></label>
    <textarea id="assist-reason" v-model="reason" maxlength="1000" placeholder="请说明需要协助的工作和原因" />
    <text class="hint">提交后等待运维主管及所选人员角色主管审批，全部通过后才加入。本次仅保存 Mock 申请，不发送真实审批。</text>
  </SectionCard>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { http } from '@/utils/http'
import { unwrapRecords } from '@/service/shkj'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import type { AssistUser } from './repairWorkflow'
defineProps<{ excluded: string[] }>()
const emit = defineEmits<{ submit: [users: AssistUser[], reason: string] }>()
const keyword = ref(''), query = ref(''), reason = ref('')
const chosen = ref<AssistUser[]>([]), users = ref<(AssistUser & { account: string })[]>([])
const page = ref(1), hasMore = ref(false), loading = ref(false), failed = ref(false)
let request = 0
async function load(next = 1) {
  const id = ++request
  loading.value = true; failed.value = false; page.value = next
  try {
    const response: any = await http.get('/sys/user/list', { pageNo: next, pageSize: 10, ...(query.value ? { realname: `*${query.value}*` } : {}) })
    if (id !== request) return
    if (response?.success === false) throw new Error('用户查询失败')
    const rows = unwrapRecords(response), payload = response?.result ?? response
    users.value = rows.filter((r: any) => r.id != null).map((r: any) => ({ id: String(r.id), name: r.realname || r.username || '未命名用户', account: r.username || '' }))
    hasMore.value = payload?.total != null ? next * 10 < Number(payload.total) : rows.length === 10
  } catch { if (id === request) failed.value = true }
  finally { if (id === request) loading.value = false }
}
function search() { query.value = keyword.value.trim(); void load(1) }
function toggle(u: AssistUser) { chosen.value = chosen.value.some(p => p.id === u.id) ? chosen.value.filter(p => p.id !== u.id) : [...chosen.value, { id: u.id, name: u.name }] }
defineExpose({ submit: () => emit('submit', chosen.value, reason.value) })
onMounted(() => void load())
</script>
<style scoped>
.label { display: block; margin-bottom: 12px; font-size: 15px; color: #344054; }
.required { color: #b42318; }
.search, .pages { display: flex; align-items: center; gap: 10px; margin: 12px 0; }
.search input { flex: 1; min-width: 0; height: 44px; padding: 0 10px; border: 1px solid #b8c0cc; border-radius: 8px; }
button { margin: 0; min-height: 44px; line-height: 44px; }
.pages { justify-content: space-between; font-size: 14px; }
.chosen { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 12px 0; }
.user { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 8px 0; border-bottom: 1px solid #edf0f3; overflow-wrap: anywhere; }
.hint { color: #536176; font-size: 14px; line-height: 1.6; }
textarea { width: 100%; height: 110px; box-sizing: border-box; padding: 12px; border: 1px solid #b8c0cc; border-radius: 8px; margin-bottom: 12px; font-size: 16px; }
input:focus, textarea:focus, button:focus-visible { outline: 2px solid #1769c2; outline-offset: 2px; }
</style>
