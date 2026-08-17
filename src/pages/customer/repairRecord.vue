<route lang="json5" type="tab">
{
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '报修记录',
    disableScroll: true,
  },
}
</route>
<template>
  <PageLayout :navbarShow="false">
    <view class="page">
      <!-- 顶栏 -->
      <view class="topbar">
        <view class="topbar__title">报修记录</view>
        <view class="topbar__add" @click="goRepair">＋ 报修</view>
      </view>
      <!-- 状态 tab -->
      <scroll-view class="tabs" :scroll-x="true" :show-scrollbar="false">
        <view
          v-for="(t, i) in tabs"
          :key="t.value"
          class="tab"
          :class="{ active: active === i }"
          @click="switchTab(i)"
        >
          {{ t.label }}
        </view>
      </scroll-view>

      <scroll-view class="list" :scroll-y="true">
        <view v-if="!list.length" class="empty">暂无{{ tabs[active].label }}报修记录</view>
        <view v-for="r in list" :key="r.id" class="card" @click="goDetail(r)">
          <view class="card__head">
            <text class="card__no">{{ r.repairNo }}</text>
            <StatusBadge :value="r.status" :dict="REPAIR_STATUS" />
          </view>
          <view class="card__row"><text class="card__label">报修项目</text><text class="card__val">{{ r.project }}</text></view>
          <view class="card__row"><text class="card__label">故障描述</text><text class="card__val ellipsis-2">{{ r.faultDesc }}</text></view>
          <view class="card__row"><text class="card__label">报修时间</text><text class="card__val">{{ r.createTime }}</text></view>
          <!-- 进行中：维修专员 -->
          <view v-if="r.status === 'processing'" class="card__row card__row--primary">
            <text class="card__label">维修专员</text>
            <text class="card__val">📞 {{ r.repairerName }} {{ r.repairerPhone }}</text>
          </view>
          <!-- 待确认：维修后照片 + 确认 -->
          <view v-if="r.status === 'confirming'" class="card__photos">
            <image v-for="(p, i) in r.repairPhotos" :key="i" :src="p" mode="aspectFill" class="card__photo" @click.stop="preview(r.repairPhotos, i)" />
          </view>
          <!-- 撤回/修改/删除原因 -->
          <view v-if="r.reason" class="card__row"><text class="card__label">原因</text><text class="card__val">{{ r.reason }}</text></view>
          <!-- 操作 -->
          <view class="card__ops" @click.stop>
            <text v-if="r.status === 'pending'" class="op op--warn" @click="withdraw(r)">撤回</text>
            <template v-if="r.status === 'withdrawn' || r.status === 'rejected'">
              <text class="op" @click="goRepair">修改信息</text>
              <text class="op op--danger" @click="remove(r)">删除</text>
            </template>
            <text v-if="r.status === 'confirming'" class="op op--primary" @click="goConfirm(r)">确认维修</text>
            <text v-if="r.status === 'done'" class="op" @click="toast('已完成评价')">查看评价</text>
          </view>
        </view>
        <view class="list-footer">—— 到底了 ——</view>
      </scroll-view>
    </view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useToast, useMessage } from 'wot-design-uni'
import { http } from '@/utils/http'
import { REPAIR_STATUS } from '@/types/business'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'

const toast = useToast()
const tabs = [{ value: '', label: '全部' }, ...REPAIR_STATUS.map((s) => ({ value: s.value, label: s.label }))]
const active = ref(0)
const list = ref<any[]>([])

const switchTab = (i: number) => {
  active.value = i
  load()
}

const load = async () => {
  const query = tabs[active.value].value ? { status: tabs[active.value].value } : {}
  try {
    const res: any = await http.get('/repair/list', query)
    list.value = res.result || []
  } catch (e) {
    /* ignore */
  }
}

const goRepair = () => uni.navigateTo({ url: '/pages/customer/repair' })
const goDetail = (r: any) => uni.navigateTo({ url: `/pages/customer/repairDetail?id=${r.id}` })
const goConfirm = (r: any) => uni.navigateTo({ url: `/pages/customer/confirm?id=${r.id}` })
const preview = (list: string[], index: number) => uni.previewImage({ urls: list, current: index })

const withdraw = (r: any) => {
  useMessage()
    .confirm('确定撤回该报修吗？')
    .then(async () => {
      await http.post('/repair/withdraw', { id: r.id })
      toast.success('已撤回')
      load()
    })
    .catch(() => {})
}

const remove = (r: any) => {
  useMessage()
    .confirm('删除后不可恢复，确定删除吗？')
    .then(async () => {
      await http.post('/repair/remove', { id: r.id })
      toast.success('已删除')
      load()
    })
    .catch(() => {})
}

onShow(() => load())
</script>

<style lang="scss" scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 16px 12px;
  background: #fff;

  &__title {
    font-size: 20px;
    font-weight: 700;
  }

  &__add {
    color: #2f86ff;
    font-size: 14px;
  }
}

.tabs {
  background: #fff;
  white-space: nowrap;
  flex: none;

  .tab {
    display: inline-block;
    padding: 8px 14px;
    font-size: 14px;
    color: #666;
    position: relative;

    &.active {
      color: #2f86ff;
      font-weight: 600;

      &::after {
        content: '';
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        bottom: 2px;
        width: 20px;
        height: 3px;
        border-radius: 2px;
        background: #2f86ff;
      }
    }
  }
}

.list {
  flex: 1;
  min-height: 0;
  padding: 12px;
}

.empty {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 60px 0;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  &__no {
    font-size: 15px;
    font-weight: 600;
    color: #333;
  }

  &__row {
    display: flex;
    margin-top: 6px;

    &--primary {
      background: #f0f7ff;
      border-radius: 6px;
      padding: 6px 8px;
      margin-top: 8px;
    }
  }

  &__label {
    width: 76px;
    font-size: 13px;
    color: #999;
    flex: none;
  }

  &__val {
    flex: 1;
    font-size: 13px;
    color: #333;
  }

  &__photos {
    display: flex;
    margin-top: 8px;
  }

  &__photo {
    width: 64px;
    height: 64px;
    border-radius: 6px;
    margin-right: 8px;
  }

  &__ops {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #f5f5f5;

    .op {
      font-size: 13px;
      color: #666;
      padding: 6px 14px;
      border: 1px solid #ddd;
      border-radius: 16px;
      margin-left: 10px;

      &--primary {
        color: #2f86ff;
        border-color: #2f86ff;
      }

      &--warn {
        color: #e6a23c;
        border-color: #e6a23c;
      }

      &--danger {
        color: #f56c6c;
        border-color: #f56c6c;
      }
    }
  }
}

.list-footer {
  text-align: center;
  color: #ccc;
  font-size: 12px;
  padding: 12px 0 30px;
}
</style>
