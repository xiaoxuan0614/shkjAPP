<route lang="json5">
{
  style: {
    navigationBarTitleText: '申请详情',
  },
}
</route>
<template>
  <PageLayout v-if="detail.id">
    <scroll-view class="page" :scroll-y="true">
      <SectionCard title="申请信息">
        <view class="row"><text class="label">申请单号</text><text class="val">{{ detail.applyNo }}</text></view>
        <view class="row"><text class="label">申请类型</text><text class="val">{{ detail.typeText }}</text></view>
        <view class="row"><text class="label">关联单号</text><text class="val">{{ detail.orderNo }}</text></view>
        <view class="row"><text class="label">客户名称</text><text class="val">{{ detail.customerName }}</text></view>
        <view class="row"><text class="label">使用时间</text><text class="val">{{ detail.useTime }}</text></view>
        <view class="row"><text class="label">申请时间</text><text class="val">{{ detail.applyTime }}</text></view>
        <view class="row"><text class="label">备注</text><text class="val">{{ detail.remark || '—' }}</text></view>
      </SectionCard>

      <SectionCard title="物料明细">
        <view class="stat-head">
          <text>物料</text><text>申请</text><text>出库</text><text>使用</text><text>应还</text><text>还料</text>
        </view>
        <view class="stat-row" v-for="m in detail.items" :key="m.name">
          <view class="stat-name">
            <view>{{ m.name }}</view>
            <view class="stat-spec">{{ m.spec }}</view>
          </view>
          <text class="stat-num">{{ m.applyQty }}</text>
          <text class="stat-num">{{ m.outQty }}</text>
          <text class="stat-num">{{ m.usedQty }}</text>
          <text class="stat-num">{{ m.returnableQty }}</text>
          <text class="stat-num stat-num--key">{{ m.returnQty }}</text>
        </view>
      </SectionCard>
    </scroll-view>

    <view class="bottom" v-if="detail.status === 'pending'">
      <text class="btn btn--primary" @click="execute">{{ detail.type === 'out' ? '确认出库' : '确认入库' }}</text>
    </view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useToast, useMessage } from 'wot-design-uni'
import { http } from '@/utils/http'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const detail = ref<any>({})
const id = ref('')

const load = async () => {
  try {
    const res: any = await http.get('/stock/applyDetail', { id: id.value })
    detail.value = res.result
  } catch (e) {
    /* ignore */
  }
}

const execute = () => {
  useMessage()
    .confirm(`确认执行${detail.value.type === 'out' ? '出库' : '入库'}吗？`)
    .then(async () => {
      await http.post('/stock/apply/execute', { id: id.value, type: detail.value.type })
      toast.success('操作成功')
      uni.navigateBack()
    })
    .catch(() => {})
}

onLoad((query) => {
  id.value = query?.id || ''
  load()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 0;
}

.row {
  display: flex;
  margin-top: 10px;

  .label {
    width: 84px;
    font-size: 13px;
    color: #999;
    flex: none;
  }

  .val {
    flex: 1;
    font-size: 13px;
    color: #333;
  }
}

.stat-head,
.stat-row {
  display: flex;
  align-items: center;

  text {
    flex: 1;
    text-align: center;
    font-size: 12px;
  }
}

.stat-head {
  color: #999;
  padding-bottom: 8px;

  text:first-child {
    flex: 2;
  }
}

.stat-row {
  padding: 10px 0;
  border-top: 1px solid #f5f5f5;

  .stat-name {
    flex: 2;
    font-size: 13px;
    color: #333;

    .stat-spec {
      font-size: 11px;
      color: #999;
      margin-top: 2px;
    }
  }

  .stat-num {
    font-size: 13px;
    color: #333;

    &--key {
      color: #f56c6c;
      font-weight: 700;
    }
  }
}

.bottom {
  display: flex;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid #f0f0f0;

  .btn {
    flex: 1;
    text-align: center;
    padding: 12px 0;
    border-radius: 22px;
    font-size: 15px;

    &--primary {
      background: #2f86ff;
      color: #fff;
    }
  }
}
</style>
