<route lang="json5">
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
    <!-- 顶部 -->
    <view class="header">
      <view class="header__top">
        <view class="user">
          <view class="avatar">{{ (user.realname || '张').slice(0, 1) }}</view>
          <view class="user__info">
            <view class="name">{{ user.realname }} <text class="role-tag">{{ user.roleName }}</text></view>
            <view class="org">{{ user.orgCodeTxt }}</view>
          </view>
        </view>
        <view class="todo-badge" @click="goTodo">待办 {{ todoCount }}</view>
      </view>
      <!-- 计数卡片 -->
      <view class="counts">
        <view v-for="c in counts" :key="c.key" class="count" @click="goCount(c.key)">
          <view class="count__num">{{ c.value }}</view>
          <view class="count__label">{{ c.label }}</view>
        </view>
      </view>
    </view>

    <scroll-view class="body" :scroll-y="true">
      <!-- 日常办公九宫格 -->
      <SectionCard title="日常办公">
        <view class="grid">
          <view v-for="g in countGrid" :key="g.key" class="grid__item" @click="goGrid(g.key)">
            <view class="grid__icon">{{ gridIcons[g.key] || '🧰' }}</view>
            <view class="grid__label">{{ g.label }}</view>
            <view v-if="g.count" class="grid__badge">{{ g.count }}</view>
          </view>
        </view>
      </SectionCard>

      <!-- 车辆管理 -->
      <SectionCard title="车辆管理">
        <view class="grid grid--4">
          <view v-for="v in vehicleGrid" :key="v.key" class="grid__item" @click="goVehicle(v.key)">
            <view class="grid__icon">{{ vehicleIcons[v.key] || '🚗' }}</view>
            <view class="grid__label">{{ v.label }}</view>
          </view>
        </view>
      </SectionCard>

      <!-- 待办事项 -->
      <SectionCard title="待办事项" :extra="todoCount ? '清空' : ''" @extra-click="clearTodo">
        <view v-if="!todoList.length" class="empty">暂无待办</view>
        <view v-for="t in todoList" :key="t.id" class="todo" @click="goTodoItem(t)">
          <view class="todo__tag" :class="{ urgent: t.urgent }">{{ t.urgent ? '急' : '待' }}</view>
          <view class="todo__body">
            <view class="todo__title">{{ t.title }}</view>
            <view class="todo__desc">{{ t.desc }}</view>
          </view>
          <text class="todo__time">{{ t.time }}</text>
        </view>
      </SectionCard>

      <!-- 维修列表 -->
      <SectionCard title="维修列表" extra="查看全部" @extra-click="goGrid('repairRecord')">
        <view v-for="o in repairList" :key="o.id" class="repair" @click="goRepairDetail(o)">
          <view class="repair__head">
            <text class="repair__no">{{ o.orderNo }}</text>
            <StatusBadge :value="o.status" :dict="WORK_ORDER_STATUS" />
          </view>
          <view class="repair__row"><text class="label">{{ o.customerName }}</text><text class="type">{{ o.maintenanceType }}</text></view>
          <view class="repair__row"><text class="label">{{ o.faultDesc }}</text></view>
        </view>
      </SectionCard>

      <view class="footer">— 首汇科技 · 运维工作台 —</view>
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useToast, useMessage } from 'wot-design-uni'
import { http } from '@/utils/http'
import { WORK_ORDER_STATUS } from '@/types/business'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const user = ref<any>({ realname: '张三', roleName: '运维人员', orgCodeTxt: '' })
const todoCount = ref(0)
const counts = ref<{ key: string; label: string; value: number }[]>([])
const countGrid = ref<any[]>([])
const vehicleGrid = ref<any[]>([])
const todoList = ref<any[]>([])
const repairList = ref<any[]>([])

const gridIcons: Record<string, string> = {
  offlineRepair: '🔧',
  offlineReserve: '📅',
  onlineRepair: '💻',
  materialApply: '📦',
  materialReturn: '↩️',
  implementLog: '📝',
  material: '🗄️',
  punch: '⏱️',
  inspection: '🔍',
}
const vehicleIcons: Record<string, string> = { vehicleLog: '📒', vehicleTrip: '🛣️', vehicleFuel: '⛽', vehicleMaintain: '🛠️' }

const load = async () => {
  try {
    const [wbRes, todoRes]: any = await Promise.all([http.get('/ops/workbench'), http.get('/ops/todoList')])
    const d = wbRes.result
    user.value = d.userInfo
    countGrid.value = d.countGrid
    vehicleGrid.value = d.vehicleGrid
    todoCount.value = d.todoCount
    repairList.value = d.repairList
    todoList.value = todoRes.result || []
    counts.value = [
      { key: 'repair', label: '客户报修', value: d.counts.repair },
      { key: 'project', label: '项目管理', value: d.counts.project },
      { key: 'inspection', label: '巡检管理', value: d.counts.inspection },
    ]
  } catch (e) {
    /* ignore */
  }
}

const goGrid = (key: string) => {
  const map: Record<string, string> = {
    offlineRepair: '/pages/ops/repairOffline',
    offlineReserve: '/pages/ops/reservation',
    onlineRepair: '/pages/ops/repairOnline',
    materialApply: '/pages/ops/materialApply',
    materialReturn: '/pages/ops/materialReturn',
    implementLog: '/pages/ops/implementLog',
    material: '/pages/ops/materialApply?tab=out',
    punch: '/pages/ops/punch',
    inspection: '/pages/ops/inspection',
    repairRecord: '/pages/ops/repairRecord',
  }
  const path = map[key]
  if (path) uni.navigateTo({ url: path })
  else toast.info('该功能暂未实现')
}

const goVehicle = (key: string) => {
  const tabMap: Record<string, string> = { vehicleLog: 'log', vehicleTrip: 'trip', vehicleFuel: 'fuel', vehicleMaintain: 'maintain' }
  uni.navigateTo({ url: `/pages/ops/vehicle?tab=${tabMap[key] || 'fuel'}` })
}

const goCount = (key: string) => {
  if (key === 'repair') goGrid('repairRecord')
  else if (key === 'project') uni.navigateTo({ url: '/pages/ops/project' })
  else uni.navigateTo({ url: '/pages/ops/inspection' })
}

const goRepairDetail = (o: any) => uni.navigateTo({ url: `/pages/ops/repairDetail?id=${o.id}` })

const goTodo = async () => {
  try {
    const res: any = await http.get('/ops/todoList')
    todoList.value = res.result || []
  } catch (e) {
    /* ignore */
  }
}

const goTodoItem = (t: any) => {
  const map: Record<string, string> = {
    project_due: '/pages/ops/project',
    workorder_audit: '/pages/ops/repairDetail?id=wo2',
    material_apply: '/pages/ops/materialApply',
    material_return: '/pages/ops/materialReturn',
    transfer: '/pages/ops/repairDetail?id=wo1',
    inner_invite: '/pages/ops/punch',
    repair_remind: '/pages/ops/accept',
    repair_timeout: '/pages/ops/accept',
    inspection_due: '/pages/ops/inspection',
  }
  if (map[t.type]) uni.navigateTo({ url: map[t.type] })
}

const clearTodo = () => {
  useMessage()
    .confirm('确定清空全部待办吗？')
    .then(async () => {
      await http.post('/ops/todo/clear')
      todoList.value = []
      todoCount.value = 0
      toast.success('待办已清空')
    })
    .catch(() => {})
}

onShow(load)
</script>

<style lang="scss" scoped>
.header {
  background: linear-gradient(135deg, #2f86ff 0%, #5aa8ff 100%);
  padding: 24px 16px 16px;
  border-radius: 0 0 24px 24px;

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .user {
    display: flex;
    align-items: center;
  }

  .avatar {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.25);
    color: #fff;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 10px;
  }

  .user__info {
    color: #fff;

    .name {
      font-size: 17px;
      font-weight: 600;

      .role-tag {
        font-size: 11px;
        background: rgba(255, 255, 255, 0.25);
        padding: 1px 6px;
        border-radius: 4px;
        margin-left: 6px;
        font-weight: 400;
      }
    }

    .org {
      font-size: 12px;
      opacity: 0.8;
      margin-top: 2px;
    }
  }

  .todo-badge {
    background: #fff;
    color: #2f86ff;
    font-size: 13px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 16px;
  }
}

.counts {
  display: flex;
  margin-top: 16px;

  .count {
    flex: 1;
    text-align: center;
    color: #fff;

    &__num {
      font-size: 22px;
      font-weight: 700;
    }

    &__label {
      font-size: 12px;
      opacity: 0.85;
      margin-top: 2px;
    }
  }
}

.body {
  min-height: 0;
}

.grid {
  display: flex;
  flex-wrap: wrap;

  &--4 .grid__item {
    width: 25%;
  }

  &__item {
    width: 33.33%;
    text-align: center;
    padding: 12px 0;
    position: relative;
  }

  &__icon {
    font-size: 26px;
  }

  &__label {
    font-size: 12px;
    color: #555;
    margin-top: 6px;
  }

  &__badge {
    position: absolute;
    top: 6px;
    right: calc(50% - 22px);
    min-width: 16px;
    height: 16px;
    line-height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: #f56c6c;
    color: #fff;
    font-size: 10px;
  }
}

.empty {
  color: #999;
  font-size: 13px;
  text-align: center;
  padding: 20px 0;
}

.todo {
  display: flex;
  align-items: center;
  padding: 11px 0;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  &__tag {
    width: 20px;
    height: 20px;
    border-radius: 6px;
    background: #e6a23c;
    color: #fff;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 10px;
    flex: none;

    &.urgent {
      background: #f56c6c;
    }
  }

  &__body {
    flex: 1;
  }

  &__title {
    font-size: 14px;
    color: #333;
  }

  &__desc {
    font-size: 12px;
    color: #999;
    margin-top: 2px;
  }

  &__time {
    font-size: 12px;
    color: #bbb;
  }
}

.repair {
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__no {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  &__row {
    font-size: 13px;
    color: #666;
    margin-top: 5px;

    .label {
      margin-right: 8px;
    }

    .type {
      color: #2f86ff;
      font-size: 12px;
      background: #f0f7ff;
      padding: 2px 8px;
      border-radius: 4px;
    }
  }
}

.footer {
  text-align: center;
  color: #bbb;
  font-size: 12px;
  padding: 20px 0 40px;
}
</style>
