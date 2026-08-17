<route lang="json5">
{
  style: {
    navigationBarTitleText: '还料申请',
  },
}
</route>
<template>
  <PageLayout>
    <scroll-view class="page" :scroll-y="true">
      <SectionCard title="关联信息">
        <view class="form-row">
          <text class="label">关联单号</text>
          <view class="search-box">
            <input class="search-input" v-model="orderNo" placeholder="输入项目XM/故障GZ单号" placeholder-style="color:#bbb" @confirm="queryOrder" />
            <text class="search-btn" @click="queryOrder">查询</text>
          </view>
        </view>
        <view v-if="orderInfo.customerName" class="form-row">
          <text class="label">客户名称</text>
          <text class="static-val">{{ orderInfo.customerName }}</text>
        </view>
        <view class="form-row">
          <text class="label">还料时间</text>
          <picker mode="date" :value="returnTime" @change="(e: any) => (returnTime = e.detail.value)">
            <view class="picker-value">{{ returnTime }}</view>
          </picker>
        </view>
      </SectionCard>

      <SectionCard title="还料信息">
        <view v-if="!items.length" class="empty-tip">查询单号后展示「申请数量 − 使用数量 > 0」的物料</view>
        <view class="item-head" v-if="items.length">
          <text>物料</text><text>申请</text><text>使用</text><text>还料</text>
        </view>
        <view v-for="m in items" :key="m.id" class="material">
          <view class="material__info">
            <view class="material__name">{{ m.name }}</view>
            <view class="material__spec">{{ m.spec }}</view>
          </view>
          <view class="material__num">{{ m.applyQty }}</view>
          <view class="material__num">{{ m.usedQty }}</view>
          <view class="material__num material__num--key">{{ m.returnQty }}</view>
        </view>
        <view v-if="items.length" class="tip">还料数量 = 申请数量 − 使用数量，请核对后提交</view>
      </SectionCard>

      <view class="submit-wrap">
        <wd-button size="large" type="primary" :loading="submitting" @click="submit">提交还料申请</wd-button>
      </view>
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import dayjs from 'dayjs'
import { useToast, useMessage } from 'wot-design-uni'
import { http } from '@/utils/http'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const message = useMessage()
const orderNo = ref('')
const orderInfo = ref<any>({})
const returnTime = ref(dayjs().format('YYYY-MM-DD'))
const items = ref<any[]>([])
const submitting = ref(false)
const returnNo = ref('')

const queryOrder = async () => {
  if (!orderNo.value.trim()) return toast.warning('请输入关联单号')
  try {
    const [orderRes, itemRes]: any = await Promise.all([
      http.get('/ops/orderCustomer', { orderNo: orderNo.value }),
      http.get('/ops/materialReturn/items', { orderNo: orderNo.value }),
    ])
    orderInfo.value = orderRes.result || {}
    items.value = itemRes.result || []
    if (!orderInfo.value.customerName) toast.info('未找到该单号')
  } catch (e) {
    /* ignore */
  }
}

const submit = async () => {
  if (!orderNo.value.trim()) return toast.warning('请填写关联单号')
  if (!items.value.length) return toast.warning('无可还料物料')
  submitting.value = true
  try {
    const res: any = await http.post('/ops/materialReturn/save', {
      orderNo: orderNo.value,
      returnTime: returnTime.value,
      items: items.value.map((m) => ({ id: m.id, name: m.name, returnQty: m.returnQty })),
    })
    returnNo.value = res.result?.returnNo || 'HL' + Date.now()
    message.alert({ title: '还料申请提交成功', msg: `申请单号：${returnNo.value}\n请等待库管核对数量后入库` }).then(() => uni.navigateBack())
  } catch (e) {
    toast.error('提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

const back = () => uni.navigateBack()
</script>

<style lang="scss" scoped>
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
  color: #999;
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
