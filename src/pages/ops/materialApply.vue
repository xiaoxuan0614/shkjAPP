<route lang="json5">
{
  style: {
    navigationBarTitleText: '用料申请',
  },
}
</route>
<template>
  <PageLayout>
    <scroll-view class="page" :scroll-y="true">
      <!-- 关联单号 -->
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
        <view v-if="orderInfo.maintenanceNatureText" class="form-row">
          <text class="label">维护性质</text>
          <text class="static-val">{{ orderInfo.maintenanceNatureText }}</text>
        </view>
        <view class="form-row">
          <text class="label">使用时间</text>
          <picker mode="date" :value="useTime" @change="(e: any) => (useTime = e.detail.value)">
            <view class="picker-value">{{ useTime }}</view>
          </picker>
        </view>
      </SectionCard>

      <!-- 用料信息 -->
      <SectionCard title="用料信息">
        <view v-for="m in selectedMaterials" :key="m.id" class="material">
          <view class="material__info">
            <view class="material__name">{{ m.name }}</view>
            <view class="material__spec">规格：{{ m.spec }} · 库存 {{ m.stock }}{{ m.unit }}</view>
            <view class="material__spec">计划用量 {{ m.planQty }} · 已出库 {{ m.outQty }}</view>
          </view>
          <view class="material__qty">
            <text class="minus" @click="dec(m)">－</text>
            <input class="qty-input" type="number" v-model="m.qty" />
            <text class="plus" @click="inc(m)">＋</text>
          </view>
        </view>
        <view class="add-material" @click="showMaterial = true">＋ 添加物料</view>
      </SectionCard>

      <view class="submit-wrap">
        <wd-button size="large" type="primary" :loading="submitting" @click="submit">提交用料申请</wd-button>
      </view>
    </scroll-view>

    <!-- 物料选择弹窗 -->
    <wd-popup v-model="showMaterial" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup">
        <view class="popup__title">选择物料</view>
        <scroll-view :scroll-y="true" class="popup__list">
          <view v-for="m in materialList" :key="m.id" class="mat" :class="{ on: isSelected(m) }" @click="toggleMaterial(m)">
            <view class="mat__body">
              <view class="mat__name">{{ m.name }}</view>
              <view class="mat__spec">{{ m.spec }} · 库存 {{ m.stock }}{{ m.unit }}</view>
            </view>
            <text class="mat__check">{{ isSelected(m) ? '✓' : '' }}</text>
          </view>
        </scroll-view>
        <view class="popup__btns">
          <text class="btn btn--plain" @click="showMaterial = false">取消</text>
          <text class="btn btn--primary" @click="showMaterial = false">确定</text>
        </view>
      </view>
    </wd-popup>
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
const useTime = ref(dayjs().format('YYYY-MM-DD'))
const materialList = ref<any[]>([])
const selectedMaterials = ref<any[]>([])
const showMaterial = ref(false)
const submitting = ref(false)
const applyNo = ref('')

const loadMaterials = async () => {
  try {
    const res: any = await http.get('/stock/material/list')
    materialList.value = res.result || []
  } catch (e) {
    /* ignore */
  }
}

const queryOrder = async () => {
  if (!orderNo.value.trim()) return toast.warning('请输入关联单号')
  try {
    const res: any = await http.get('/ops/orderCustomer', { orderNo: orderNo.value })
    orderInfo.value = res.result || {}
    if (!orderInfo.value.customerName) toast.info('未找到该单号')
  } catch (e) {
    /* ignore */
  }
}

const isSelected = (m: any) => selectedMaterials.value.some((x) => x.id === m.id)

const toggleMaterial = (m: any) => {
  const i = selectedMaterials.value.findIndex((x) => x.id === m.id)
  if (i >= 0) selectedMaterials.value.splice(i, 1)
  else selectedMaterials.value.push({ ...m, qty: m.planQty || 1 })
}

const inc = (m: any) => m.qty++
const dec = (m: any) => {
  if (m.qty > 1) m.qty--
}

const submit = async () => {
  if (!orderNo.value.trim()) return toast.warning('请填写关联单号')
  if (!selectedMaterials.value.length) return toast.warning('请选择物料')
  submitting.value = true
  try {
    const res: any = await http.post('/ops/materialApply/save', {
      orderNo: orderNo.value,
      useTime: useTime.value,
      items: selectedMaterials.value.map((m) => ({ id: m.id, name: m.name, qty: m.qty })),
    })
    applyNo.value = res.result?.applyNo || 'LK' + Date.now()
    message.alert({ title: '申请提交成功', msg: `申请单号：${applyNo.value}\n库管出库后，请及时领取物料` }).then(() => uni.navigateBack())
  } catch (e) {
    toast.error('提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

const back = () => uni.navigateBack()
loadMaterials()
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

  .search-input,
  .static-val,
  .picker-value {
    flex: 1;
    font-size: 14px;
    color: #333;
  }

  .search-box {
    flex: 1;
    display: flex;
    align-items: center;
  }

  .search-btn {
    color: #2f86ff;
    font-size: 13px;
    padding: 4px 0 4px 12px;
  }

  .static-val {
    color: #666;
  }
}

.material {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;

  &__info {
    flex: 1;
  }

  &__name {
    font-size: 14px;
    color: #333;
    font-weight: 500;
  }

  &__spec {
    font-size: 12px;
    color: #999;
    margin-top: 2px;
  }

  &__qty {
    display: flex;
    align-items: center;

    .minus,
    .plus {
      width: 28px;
      height: 28px;
      border: 1px solid #ddd;
      border-radius: 6px;
      text-align: center;
      line-height: 26px;
      font-size: 16px;
      color: #666;
    }

    .qty-input {
      width: 44px;
      text-align: center;
      font-size: 14px;
    }
  }
}

.add-material {
  text-align: center;
  color: #2f86ff;
  font-size: 14px;
  padding: 12px 0 2px;
}

.submit-wrap {
  padding: 20px 16px 40px;
}

.popup {
  padding: 16px 20px 24px;

  &__title {
    font-size: 16px;
    font-weight: 600;
    text-align: center;
  }

  &__list {
    max-height: 50vh;
    margin-top: 12px;
  }

  &__btns {
    display: flex;
    margin-top: 16px;

    .btn {
      flex: 1;
      text-align: center;
      padding: 11px 0;
      border-radius: 22px;
      font-size: 14px;
      margin-left: 12px;

      &:first-child {
        margin-left: 0;
      }

      &--plain {
        border: 1px solid #ddd;
        color: #666;
      }

      &--primary {
        background: #2f86ff;
        color: #fff;
      }
    }
  }
}

.mat {
  display: flex;
  align-items: center;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 10px;
  margin-bottom: 10px;

  &.on {
    border-color: #2f86ff;
    background: #f0f7ff;
  }

  &__body {
    flex: 1;
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

  &__check {
    color: #2f86ff;
    font-size: 18px;
  }
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
