<template>
  <wd-popup :model-value="true" position="bottom" :close-on-click-modal="false" custom-style="border-radius:16px 16px 0 0;">
    <view class="invite">
      <view class="invite__head">
        <text class="invite__title">增加参与人员</text>
        <button class="invite__close" :disabled="submitting" @click="emit('close')">取消</button>
      </view>
      <scroll-view scroll-y class="invite__body">
        <text class="invite__project">{{ projectName }}</text>
        <text class="invite__label">参与人员（必选）</text>
        <view class="invite__search">
          <input v-model="keyword" placeholder="输入人员姓名" confirm-type="search" :disabled="submitting" @confirm="searchUsers" />
          <button size="mini" :disabled="submitting || loading" @click="searchUsers">搜索</button>
        </view>
        <text v-if="selected" class="invite__hint">已选：{{ selected.label }}</text>
        <text v-if="loading" class="invite__hint">正在加载人员…</text>
        <button v-else-if="userError" @click="loadUsers(page)">人员加载失败，点击重试</button>
        <radio-group v-else @change="selectUser">
          <label v-for="user in users" :key="user.id" class="invite__option">
            <radio :value="user.id" :checked="selected?.id === user.id" :disabled="submitting" color="#176ac7" />
            <text>{{ user.label }}</text>
          </label>
          <text v-if="!users.length" class="invite__hint">未找到人员，请更换姓名搜索</text>
        </radio-group>
        <view class="invite__pages">
          <button size="mini" :disabled="loading || submitting || page <= 1" @click="loadUsers(page - 1)">上一页</button>
          <text>第 {{ page }} 页</text>
          <button size="mini" :disabled="loading || submitting || !hasMore" @click="loadUsers(page + 1)">下一页</button>
        </view>
        <text class="invite__label">项目角色（必选，可多选）</text>
        <text v-if="rolesLoading" class="invite__hint">正在加载角色…</text>
        <button v-else-if="roleError" @click="loadRoles">角色加载失败，点击重试</button>
        <checkbox-group v-else @change="selectRoles">
          <label v-for="role in roles" :key="role.value" class="invite__option">
            <checkbox :value="role.value" :checked="selectedRoles.includes(role.value)" :disabled="submitting" color="#176ac7" />
            <text>{{ role.label }}</text>
          </label>
          <text v-if="!roles.length" class="invite__hint">暂无可邀请的项目角色，请联系管理员检查字典</text>
        </checkbox-group>
        <text v-if="error" class="invite__error">{{ error }}</text>
      </scroll-view>
      <view class="invite__footer">
        <button type="primary" :loading="submitting" :disabled="submitting || !selected || !selectedRoles.length || roleError" @click="submit">
          {{ submitting ? '正在提交…' : '提交邀请' }}
        </button>
      </view>
    </view>
  </wd-popup>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { http } from '@/utils/http'
import { projectApi, unwrapRecords } from '@/service/shkj'
import { useUserStore } from '@/store/user'
import { readProjectMembership } from '@/service/projectMembership'

const props = defineProps<{ periodId: string; projectName: string }>()
const user = useUserStore()
const emit = defineEmits<{ close: []; invited: [] }>()
const keyword = ref('')
const query = ref('')
const page = ref(1)
const hasMore = ref(false)
const loading = ref(false)
const userError = ref(false)
const rolesLoading = ref(false)
const roleError = ref(false)
const submitting = ref(false)
const error = ref('')
const users = ref<{ id: string; label: string }[]>([])
const selected = ref<{ id: string; label: string }>()
const roles = ref<{ value: string; label: string }[]>([])
const selectedRoles = ref<string[]>([])
// 与 PC 项目详情一致：系统管理的角色不能从成员邀请入口添加。
const protectedRoles = new Set(['0', '1', '2'])
let request = 0
const loadUsers = async (nextPage = 1) => {
  const current = ++request
  loading.value = true
  userError.value = false
  page.value = nextPage
  try {
    const response: any = await http.get('/sys/user/list', {
      pageNo: nextPage, pageSize: 10, ...(query.value ? { realname: `*${query.value}*` } : {}),
    })
    if (current !== request) return
    const payload = response?.result ?? response
    const rows = unwrapRecords(response)
    users.value = rows.filter((row: any) => row.id != null).map((row: any) => ({
      id: String(row.id), label: row.realname || row.username || '未命名人员',
    }))
    hasMore.value = payload?.total != null ? nextPage * 10 < Number(payload.total) : rows.length === 10
  } catch {
    if (current === request) userError.value = true
  } finally {
    if (current === request) loading.value = false
  }
}
const searchUsers = () => { query.value = keyword.value.trim(); void loadUsers(1) }
const selectUser = (event: any) => {
  if (!submitting.value) selected.value = users.value.find((user) => user.id === event.detail.value)
}
const selectRoles = (event: any) => {
  if (!submitting.value) selectedRoles.value = event.detail.value
}
const loadRoles = async () => {
  rolesLoading.value = true
  roleError.value = false
  try {
    roles.value = unwrapRecords(await http.get('/sys/dict/getDictItems/member_role'))
      .filter((row: any) => row.value != null && !protectedRoles.has(String(row.value)))
      .map((row: any) => ({ value: String(row.value), label: row.text || row.label || String(row.value) }))
  } catch { roleError.value = true } finally { rolesLoading.value = false }
}
const submit = async () => {
  if (submitting.value) return
  error.value = ''
  if (!props.periodId || !selected.value || !selectedRoles.value.length) {
    error.value = '请选择参与人员和项目角色'; return
  }
  if (selectedRoles.value.some((role) => !roles.value.some((item) => item.value === role))) {
    error.value = '角色已失效，请重新选择'; return
  }
  submitting.value = true
  try {
    const userId = String(user.userInfo.userid || (user.userInfo as any).id || '')
    const access = await readProjectMembership(props.periodId, userId)
    if (!access.manager) { error.value = '仅本分期项目负责人可邀请参与人员'; return }
    const members = unwrapRecords(await projectApi.members(props.periodId))
    const existing = new Set(members.filter((row: any) => String(row.userId) === selected.value!.id)
      .flatMap((row: any) => String(row.memberRole || '').split(',').map((role) => role.trim())))
    const newRoles = selectedRoles.value.filter((role) => !existing.has(role))
    if (!newRoles.length) { error.value = '该人员已有所选角色，请选择其他角色'; return }
    await projectApi.inviteMembers(props.periodId, [{ userId: selected.value.id, memberRole: newRoles.join(',') }])
    emit('invited')
  } catch (reason: any) {
    error.value = reason?.message || '邀请发送失败，请重试'
  } finally { submitting.value = false }
}
onMounted(() => { void loadUsers(); void loadRoles() })
</script>

<style scoped>
.invite { display: flex; flex-direction: column; height: 85vh; background: #fff; color: #253247; }
.invite__head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #e3e8ee; }
.invite__title { font-size: 18px; font-weight: 600; }
.invite__close { margin: 0; min-height: 44px; font-size: 15px; }
.invite__body { flex: 1; min-height: 0; height: 0; padding: 0 16px; box-sizing: border-box; }
.invite__project, .invite__hint, .invite__error { display: block; margin: 12px 0; font-size: 14px; overflow-wrap: anywhere; }
.invite__hint { color: #536176; }
.invite__label { display: block; margin: 20px 0 10px; font-size: 16px; font-weight: 600; }
.invite__search { display: flex; align-items: center; gap: 10px; }
.invite__search input { flex: 1; min-width: 0; height: 44px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 16px; }
.invite__search button { flex-shrink: 0; margin: 0; min-height: 44px; line-height: 44px; }
.invite__option { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 6px 0; box-sizing: border-box; border-bottom: 1px solid #edf0f4; font-size: 16px; }
.invite__option text { overflow-wrap: anywhere; min-width: 0; }
.invite__pages { display: flex; align-items: center; justify-content: space-between; margin: 12px 0; font-size: 14px; }
.invite__pages button { margin: 0; min-height: 44px; line-height: 44px; }
.invite__error { color: #b42318; }
.invite__footer { padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid #e3e8ee; }
.invite__footer button { background: #176ac7; font-size: 16px; min-height: 48px; }
.invite__footer button[disabled] { background: #e3e8ee; color: #536176; }
</style>
