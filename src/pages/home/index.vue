<route lang="json5" type="home">
{
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '运维工作台',
    disableScroll: true,
  },
}
</route>

<template>
  <PageLayout :navbarShow="false">
    <view class="header">
      <view class="header__top">
        <view class="user">
          <view class="avatar">{{ avatarText }}</view>
          <view class="user__info">
            <view class="user__name">
              {{ displayName }}
              <text v-if="roleName" class="role-tag">{{ roleName }}</text>
            </view>
            <view class="user__org">{{ organization }}</view>
          </view>
        </view>
        <view class="todo-badge" @click="scrollToTodo">待办 {{ todoTotal }}</view>
      </view>

      <view v-if="summaryItems.length" class="counts">
        <view v-for="item in summaryItems" :key="item.key" class="count" @click="openPath(item.path)">
          <view class="count__num">{{ item.value }}</view>
          <view class="count__label">{{ item.label }}</view>
        </view>
      </view>
    </view>

    <scroll-view class="body" :scroll-y="true" :scroll-into-view="scrollTarget" scroll-with-animation>
      <SectionCard v-if="visibleOfficeEntries.length" title="日常办公">
        <view class="grid grid--three">
          <view v-for="item in visibleOfficeEntries" :key="item.key" class="grid__item" @click="openPath(item.path)">
            <view class="grid__icon" :class="`tone-${item.tone}`">
              <wd-icon :name="item.icon" size="24px" />
            </view>
            <view class="grid__label">{{ item.label }}</view>
          </view>
        </view>
      </SectionCard>

      <SectionCard v-if="visibleVehicleEntries.length" title="车辆管理">
        <view class="grid grid--four">
          <view v-for="item in visibleVehicleEntries" :key="item.key" class="grid__item" @click="openPath(item.path)">
            <view class="grid__icon tone-blue"><wd-icon :name="item.icon" size="23px" /></view>
            <view class="grid__label">{{ item.label }}</view>
          </view>
        </view>
      </SectionCard>

      <view id="todo-section">
        <SectionCard title="待办事项" :extra="permissionStore.loadError ? '重新同步权限' : ''" @extra-click="refreshAuthorization">
          <view v-if="permissionStore.loadError" class="permission-warning" @click="refreshAuthorization">
            <wd-icon name="warning" size="16px" />
            <text>菜单权限暂未同步，功能页仍由后端接口鉴权。点击重试。</text>
          </view>
          <view v-if="todoLoading" class="empty">正在加载待办…</view>
          <view v-else-if="!todoList.length" class="empty">暂无待办事项</view>
          <view v-for="item in todoList" :key="item.id" class="todo" @click="openTodo(item)">
            <view class="todo__tag" :class="{ urgent: item.urgent }">{{ item.urgent ? '急' : '待' }}</view>
            <view class="todo__body">
              <view class="todo__title">{{ item.title }}</view>
              <view class="todo__summary">{{ item.summary }}</view>
            </view>
            <text class="todo__time">{{ formatShortDate(item.time) }}</text>
          </view>
        </SectionCard>
      </view>

      <SectionCard title="项目动态" extra="查看全部" @extra-click="openPath('/pages/ops/project')">
        <view v-if="projectLoading" class="empty">正在加载参与项目…</view>
        <view v-else-if="!recentProjects.length" class="empty">暂无可查看项目</view>
        <view v-for="item in recentProjects" :key="item.id" class="project-row" @click="openPath(`/pages/ops/projectDetail?id=${item.id}`)">
          <view class="project-row__head">
            <text>{{ item.xmNo || '暂无编号' }}</text>
            <text class="project-row__status">{{ projectStatusText(item.status) }}</text>
          </view>
          <view class="project-row__name">{{ item.name }}</view>
          <view class="project-row__meta">{{ item.customerName || '暂无客户信息' }}</view>
        </view>
      </SectionCard>

      <view class="footer">— 首汇科技 · 运维工作台 —</view>
    </scroll-view>

    <ContractApprovalPopup ref="contractApprovalPopup" @processed="refreshAfterContractApproval" />

    <wd-popup
      v-model="showInvitation"
      position="bottom"
      :close-on-click-modal="!invitationSubmitting"
      :safe-area-inset-bottom="true"
      :root-portal="true"
      :z-index="2000"
      custom-style="border-radius:22px 22px 0 0;"
    >
      <view class="invitation-popup">
        <view class="invitation-popup__handle" />
        <view class="invitation-popup__head">
          <view class="invitation-popup__eyebrow">项目协作邀请</view>
          <view
            class="invitation-popup__close"
            :class="{ disabled: invitationSubmitting }"
            @click="closeInvitation"
          >
            <wd-icon name="close" size="18px" />
          </view>
        </view>

        <view class="invitation-popup__content">
          <view class="invitation-popup__message">
            <text class="invitation-popup__manager">{{ invitation.managerName }}</text>
            <text class="invitation-popup__message-text">邀请您参加</text>
          </view>
          <view class="invitation-popup__project">
            {{ invitation.summary }}
          </view>
          <view class="invitation-popup__role">
            <text class="invitation-popup__role-label">您的角色是</text>
            <text class="invitation-popup__role-value">{{ invitation.roleName }}</text>
          </view>
        </view>

        <view class="invitation-popup__actions">
          <view class="invitation-popup__action">
            <wd-button
              type="error"
              plain
              block
              size="large"
              :disabled="invitationSubmitting"
              :loading="invitationDecision === '0'"
              @click="respondInvitation('0')"
            >
              拒绝
            </wd-button>
          </view>
          <view class="invitation-popup__action">
            <wd-button
              type="primary"
              block
              size="large"
              :disabled="invitationSubmitting"
              :loading="invitationDecision === '1'"
              @click="respondInvitation('1')"
            >
              同意
            </wd-button>
          </view>
        </view>
      </view>
    </wd-popup>
  </PageLayout>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { useToast } from 'wot-design-uni'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import ContractApprovalPopup from './components/ContractApprovalPopup.vue'
import { projectApi, normalizeProject, unwrapRecords } from '@/service/shkj'
import { buildPermissionOwnerKey, ensureCurrentAuthorization } from '@/service/permission'
import {
  parseTodoActionParams,
  projectInvitationApi,
  todoApi,
  unwrapTodoPage,
  type ProjectInvitationRecord,
  type TodoRecord,
} from '@/service/todo'
import { usePermissionStore } from '@/store/permission'
import { useUserStore } from '@/store/user'

type WorkEntry = { key: string; label: string; path: string; icon: string; tone: string }
type WorkbenchPresentation = Pick<WorkEntry, 'icon' | 'tone'> & {
  section: 'office' | 'vehicle'
  label?: string
}

const toast = useToast()
const userStore = useUserStore()
const permissionStore = usePermissionStore()
const todoList = ref<any[]>([])
const todoTotal = ref(0)
const todoLoading = ref(false)
const contractApprovalPopup = ref<InstanceType<typeof ContractApprovalPopup>>()
const showInvitation = ref(false)
const invitationLoading = ref(false)
const invitationSubmitting = ref(false)
const invitationDecision = ref<'' | '0' | '1'>('')
const invitation = ref({
  memberId: '',
  periodId: '',
  managerName: '',
  summary: '',
  roleName: '',
})
const recentProjects = ref<any[]>([])
const projectLoading = ref(false)
const scrollTarget = ref('')

const displayName = computed(() => userStore.userInfo.realname || userStore.userInfo.username || '当前用户')
const organization = computed(() => userStore.userInfo.orgCodeTxt || userStore.userInfo.departName || '首汇科技')
const roleName = computed(() => (userStore.userInfo as any).roleName || (userStore.userInfo as any).roleNames || '')
const avatarText = computed(() => String(displayName.value).slice(0, 1))

const normalizedPath = (path: string) => path.split('?')[0]

const workbenchPresentation: Record<string, WorkbenchPresentation> = {
  '/pages/ops/repairOffline': { icon: 'tools', tone: 'blue', section: 'office' },
  '/pages/ops/reservation': { icon: 'calendar', tone: 'green', section: 'office' },
  '/pages/ops/repairOnline': { icon: 'service', tone: 'purple', section: 'office' },
  '/pages/ops/materialApply': {
    icon: 'goods',
    tone: 'orange',
    section: 'office',
    label: '领料申请',
  },
  '/pages/ops/materialReturn': { icon: 'refresh', tone: 'green', section: 'office' },
  '/pages/ops/implementLog': { icon: 'edit-outline', tone: 'blue', section: 'office' },
  '/pages/ops/project': { icon: 'view-list', tone: 'purple', section: 'office' },
  '/pages/stock/materialApply': { icon: 'goods', tone: 'orange', section: 'office' },
  '/pages/ops/inspection': { icon: 'search', tone: 'blue', section: 'office' },
  '/pages/ops/vehicle': { icon: 'view-list', tone: 'blue', section: 'vehicle' },
}

const authorizedMenuByPath = computed(
  () => new Map(permissionStore.menus.map((menu) => [normalizedPath(menu.miniAppPath), menu])),
)
const workbenchEntries = computed(() =>
  permissionStore.menus.flatMap((menu) => {
    const path = normalizedPath(menu.miniAppPath)
    const presentation = workbenchPresentation[path]
    if (!presentation) return []
    return [{ key: menu.id, label: presentation.label || menu.name, path, ...presentation }]
  }),
)
const visibleOfficeEntries = computed(() =>
  workbenchEntries.value.filter((item) => item.section === 'office'),
)
const visibleVehicleEntries = computed(() =>
  workbenchEntries.value.filter((item) => item.section === 'vehicle'),
)
const summaryItems = computed(() =>
  [
    { path: '/pages/ops/repairRecord', value: '—' },
    { path: '/pages/ops/project', label: '参与项目', value: projectLoading.value ? '…' : recentProjects.value.length },
    { path: '/pages/ops/inspection', value: '—' },
  ].flatMap((item) => {
    const menu = authorizedMenuByPath.value.get(item.path)
    if (!menu) return []
    return [{ key: menu.id, label: item.label || menu.name, path: item.path, value: item.value }]
  }),
)

const isLocked = (path: string) => permissionStore.loaded && !permissionStore.hasPageAccess(normalizedPath(path))

const openPath = (path: string) => {
  if (isLocked(path)) {
    toast.warning('当前角色未授权该功能，请在 OA 角色权限中配置')
    return
  }
  uni.navigateTo({ url: path })
}

const scrollToTodo = () => {
  scrollTarget.value = ''
  setTimeout(() => (scrollTarget.value = 'todo-section'), 0)
}

const loadProjects = async () => {
  projectLoading.value = true
  try {
    const response: any = await projectApi.list()
    recentProjects.value = unwrapRecords(response).map(normalizeProject).slice(0, 3)
  } catch {
    recentProjects.value = []
  } finally {
    projectLoading.value = false
  }
}

const loadTodos = async () => {
  todoLoading.value = true
  try {
    const page = unwrapTodoPage(await todoApi.page())
    todoList.value = page.records.map((item: TodoRecord) => ({
      ...item,
      actionParams: parseTodoActionParams(item.actionParams),
      time: item.dueTime || item.createTime,
      urgent: item.urgent === true,
    }))
    todoTotal.value = page.total
  } catch {
    todoList.value = []
    todoTotal.value = 0
  } finally {
    todoLoading.value = false
  }
}

const memberRoleFallback: Record<string, string> = {
  0: '客户对接人',
  1: '销售负责人',
  2: '项目经理',
  4: '参与人员',
  5: '技术支持',
}

const memberRoleCodes = (value: unknown) =>
  String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const closeInvitation = () => {
  if (!invitationSubmitting.value) showInvitation.value = false
}

const openProjectInvitation = async (item: TodoRecord) => {
  if (invitationLoading.value) return

  invitationDecision.value = ''
  const periodId = String(item.bizSubId || '').trim()
  if (!periodId) {
    toast.warning('当前待办缺少项目分期ID')
    return
  }

  invitationLoading.value = true
  uni.showLoading({ title: '正在加载邀请', mask: true })
  try {
    const response: any = await projectInvitationApi.list()
    const periodInvitations = (unwrapRecords(response) as ProjectInvitationRecord[]).filter(
      (record) => String(record.periodId || '').trim() === periodId,
    )
    const todoBizId = String(item.bizId || '').trim()
    const matchedInvitation =
      periodInvitations.find((record) => todoBizId && String(record.id || '').trim() === todoBizId) ||
      periodInvitations[0]

    if (!matchedInvitation?.id) {
      toast.warning('未找到对应的待处理邀请，可能已被处理')
      await loadTodos()
      return
    }

    const contractResponse: any = await projectApi.contractDetail(periodId)
    const contractResult = contractResponse?.result ?? contractResponse ?? {}
    const contract = contractResult.contract || contractResult
    const managerName = String(
      contract.projectManagerUserName ||
        contract.projectManagerName ||
        matchedInvitation.projectManagerUserName ||
        matchedInvitation.projectManagerName ||
        '',
    ).trim()
    if (!managerName) {
      toast.warning('未获取到该项目的项目经理名称')
      return
    }

    const roleCodes = memberRoleCodes(matchedInvitation.memberRole)
    invitation.value = {
      memberId: String(matchedInvitation.id),
      periodId,
      managerName,
      summary: String(item.summary || ''),
      roleName:
        String(matchedInvitation.memberRole_dictText || '').trim() ||
        roleCodes.map((code) => memberRoleFallback[code] || code).join('、') ||
        '未配置角色',
    }
    showInvitation.value = true
  } catch (error) {
    console.warn('查询项目邀请失败', error)
  } finally {
    uni.hideLoading()
    invitationLoading.value = false
  }
}

const respondInvitation = async (inviteStatus: '0' | '1') => {
  if (!invitation.value.memberId || invitationSubmitting.value) return

  invitationSubmitting.value = true
  invitationDecision.value = inviteStatus
  try {
    await projectInvitationApi.respond(invitation.value.memberId, inviteStatus)
    showInvitation.value = false
    toast.success(inviteStatus === '1' ? '已同意项目邀请' : '已拒绝项目邀请')
    await Promise.all([loadTodos(), loadProjects()])
  } catch (error) {
    console.warn('处理项目邀请失败', error)
  } finally {
    invitationSubmitting.value = false
    invitationDecision.value = ''
  }
}

const openTodo = (item: TodoRecord & { actionParams?: Record<string, any> }) => {
  if ([item.todoType, item.actionKey].some((value) => String(value || '').trim().toUpperCase() === 'PROJECT_CONTRACT_APPROVAL')) {
    contractApprovalPopup.value?.open(item)
    return
  }
  if (String(item.actionKey || '').trim().toUpperCase() === 'PROJECT_MEMBER_INVITATION') {
    openProjectInvitation(item)
    return
  }

  const periodId = item.actionParams?.periodId || item.bizSubId || item.periodId
  if (periodId && item.todoType === 'PROJECT_PLAN_APPROVAL')
    openPath(`/pages/ops/projectDetail?id=${periodId}`)
  else toast.info('请在 PC 端办理该类型待办')
}

const refreshAfterContractApproval = () => Promise.all([loadTodos(), loadProjects()])

const refreshAuthorization = async () => {
  try {
    await ensureCurrentAuthorization(userStore.userInfo, true)
    toast.success('权限已同步')
  } catch {
    toast.warning('权限服务暂不可用，功能数据仍由接口鉴权')
  }
}

const formatShortDate = (value?: string) => (value ? dayjs(value).format('MM-DD HH:mm') : '')
const projectStatusText = (status: string) => ({ notStart: '未开始', preparing: '准备中', implementing: '实施中', accepting: '验收中', warranty: '质保中', finished: '已完成', closed: '已关闭' }[status] || status || '未知')

onShow(() => {
  if (!userStore.userInfo.token) return

  if (
    !permissionStore.loaded ||
    permissionStore.ownerKey !== buildPermissionOwnerKey(userStore.userInfo)
  )
    refreshAuthorization()
  loadProjects()
  loadTodos()
})
</script>

<style lang="scss" scoped>
.header {
  padding: calc(env(safe-area-inset-top) + 24px) 16px 18px;
  border-radius: 0 0 24px 24px;
  background: linear-gradient(135deg, #2f86ff 0%, #5aa8ff 100%);
  color: #fff;

  &__top { display: flex; align-items: center; justify-content: space-between; }
}
.user { display: flex; min-width: 0; align-items: center; }
.avatar { display: flex; width: 46px; height: 46px; flex: none; align-items: center; justify-content: center; margin-right: 10px; border-radius: 50%; background: rgba(255, 255, 255, .25); font-size: 20px; }
.user__info { min-width: 0; }
.user__name { overflow: hidden; font-size: 17px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.user__org { overflow: hidden; margin-top: 3px; color: rgba(255, 255, 255, .8); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.role-tag { padding: 2px 6px; margin-left: 6px; border-radius: 4px; background: rgba(255, 255, 255, .22); font-size: 11px; font-weight: 400; }
.todo-badge { flex: none; padding: 6px 13px; border-radius: 16px; background: #fff; color: #2f86ff; font-size: 13px; font-weight: 600; }
.counts { display: flex; margin-top: 18px; }
.count { flex: 1; color: #fff; text-align: center; }
.count__num { min-height: 29px; font-size: 22px; font-weight: 700; }
.count__label { margin-top: 2px; color: rgba(255, 255, 255, .86); font-size: 12px; }
.body { min-height: 0; background: #f3f5f8; }
.grid { display: flex; flex-wrap: wrap; }
.grid--three .grid__item { width: 33.333%; }
.grid--four .grid__item { width: 25%; }
.grid__item { position: relative; padding: 11px 0 12px; text-align: center; }
.grid__item.locked { opacity: .52; }
.grid__icon { display: flex; width: 44px; height: 44px; align-items: center; justify-content: center; margin: 0 auto; border-radius: 13px; }
.tone-blue { background: #eaf4ff; color: #2f86ff; }
.tone-green { background: #ebf8f2; color: #2e9b69; }
.tone-purple { background: #f1edff; color: #7457c5; }
.tone-orange { background: #fff3e5; color: #c47618; }
.grid__label { margin-top: 7px; color: #4c5968; font-size: 12px; }
.grid__lock { position: absolute; top: 7px; left: calc(50% + 13px); display: flex; width: 17px; height: 17px; align-items: center; justify-content: center; border-radius: 50%; background: #8a96a5; color: #fff; }
.permission-warning { display: flex; align-items: flex-start; gap: 8px; padding: 10px 11px; margin-bottom: 8px; border-radius: 8px; background: #fff5e8; color: #96601f; font-size: 12px; line-height: 1.5; }
.permission-warning text { flex: 1; }
.empty { padding: 20px 0; color: #939dab; font-size: 13px; text-align: center; }
.todo { display: flex; align-items: center; padding: 11px 0; border-bottom: 1px solid #f1f2f4; }
.todo:last-child { border-bottom: 0; }
.todo__tag { display: flex; width: 21px; height: 21px; flex: none; align-items: center; justify-content: center; margin-right: 10px; border-radius: 6px; background: #e6a23c; color: #fff; font-size: 11px; }
.todo__tag.urgent { background: #e85b5b; }
.todo__body { min-width: 0; flex: 1; }
.todo__title { overflow: hidden; color: #303b49; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.todo__summary { overflow: hidden; margin-top: 3px; color: #8a95a3; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.todo__time { margin-left: 10px; color: #a5adb8; font-size: 11px; }
.invitation-popup {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  max-width: 520px;
  max-height: calc(100vh - 20px);
  max-height: calc(100dvh - 20px);
  flex-direction: column;
  padding: 10px 20px 22px;
  margin: 0 auto;
  overflow: hidden;
  background: #fff;
}
.invitation-popup__handle {
  width: 40px;
  height: 4px;
  margin: 0 auto 17px;
  border-radius: 999px;
  background: #dfe4ea;
}
.invitation-popup__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.invitation-popup__eyebrow {
  color: #202b38;
  font-size: 18px;
  font-weight: 700;
}
.invitation-popup__close {
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f2f4f7;
  color: #778291;
}
.invitation-popup__close.disabled {
  opacity: 0.45;
}
.invitation-popup__content {
  min-height: 0;
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.invitation-popup__message {
  margin-top: 27px;
  color: #596574;
  font-size: 15px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.invitation-popup__manager {
  color: #202b38;
  font-weight: 700;
}
.invitation-popup__message-text {
  margin-left: 4px;
}
.invitation-popup__project {
  padding: 16px;
  margin-top: 11px;
  border: 1px solid #dceafe;
  border-radius: 14px;
  background: #f3f8ff;
  color: #2369c7;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.45;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.invitation-popup__role {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 15px 2px;
  border-bottom: 1px solid #eef1f4;
}
.invitation-popup__role-label {
  flex: none;
  color: #8a95a3;
  font-size: 13px;
}
.invitation-popup__role-value {
  min-width: 0;
  color: #303b49;
  font-size: 14px;
  font-weight: 600;
  text-align: right;
  overflow-wrap: anywhere;
}
.invitation-popup__actions {
  display: flex;
  flex: none;
  gap: 12px;
  padding-top: 4px;
  margin-top: 22px;
  background: #fff;
}
.invitation-popup__action {
  min-width: 0;
  flex: 1;
}
@media screen and (max-width: 360px) {
  .invitation-popup {
    padding: 8px 14px 16px;
  }
  .invitation-popup__message {
    margin-top: 21px;
    font-size: 14px;
  }
  .invitation-popup__project {
    padding: 13px;
    font-size: 14px;
  }
  .invitation-popup__role {
    align-items: flex-start;
    gap: 6px;
    flex-direction: column;
  }
  .invitation-popup__role-value {
    text-align: left;
  }
  .invitation-popup__actions {
    gap: 8px;
    margin-top: 18px;
  }
}
.project-row { padding: 11px 0; border-bottom: 1px solid #f1f2f4; }
.project-row:last-child { border-bottom: 0; }
.project-row__head { display: flex; align-items: center; justify-content: space-between; color: #586576; font-size: 12px; }
.project-row__status { color: #2f86ff; }
.project-row__name { margin-top: 5px; color: #273240; font-size: 14px; font-weight: 600; }
.project-row__meta { margin-top: 4px; color: #8b96a4; font-size: 12px; }
.footer { padding: 20px 0 40px; color: #a5adb8; font-size: 12px; text-align: center; }
</style>
