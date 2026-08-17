<route lang="json5">
{
  style: {
    navigationBarTitleText: '线下预约',
  },
}
</route>
<template>
  <PageLayout>
    <scroll-view class="page" :scroll-y="true">
      <!-- 客户信息 -->
      <SectionCard title="客户信息">
        <view class="form-row">
          <text class="label">客户名称</text>
          <view class="search-box">
            <input class="search-input" v-model="form.customerName" placeholder="输入客户名称搜索" placeholder-style="color:#bbb" @confirm="searchCustomer" />
            <text class="search-btn" @click="searchCustomer">搜索</text>
          </view>
        </view>
        <view class="form-row" v-if="customer.warrantyPeriod">
          <text class="label">维保期限</text>
          <text class="static-val">{{ customer.warrantyPeriod }}</text>
        </view>
        <view class="form-row">
          <text class="label">维护性质</text>
          <picker mode="selector" :range="natureTexts" @change="onNature">
            <view class="picker-value" :class="{ placeholder: !form.maintenanceNature }">{{ form.maintenanceNature ? natureTexts[natureIndex] : '请选择' }}</view>
          </picker>
        </view>
        <view class="form-row">
          <text class="label">维护类型</text>
          <view class="picker-value static-val">线下预约</view>
        </view>
      </SectionCard>

      <!-- 预约信息 -->
      <SectionCard title="预约信息">
        <view class="form-row">
          <text class="label">报故时间</text>
          <picker mode="date" :value="form.faultTime" @change="(e: any) => (form.faultTime = e.detail.value)">
            <view class="picker-value">{{ form.faultTime }}</view>
          </picker>
        </view>
        <view class="form-row">
          <text class="label">维修预约时间</text>
          <picker mode="date" :value="form.reserveDate" @change="(e: any) => (form.reserveDate = e.detail.value)">
            <view class="picker-value">{{ form.reserveDate }}</view>
          </picker>
        </view>
        <view class="form-row">
          <text class="label">运维人员</text>
          <text class="static-val">{{ currentUser }}</text>
        </view>
      </SectionCard>

      <!-- 人员信息 -->
      <SectionCard title="人员信息">
        <view class="form-row">
          <text class="label">协助需求</text>
          <view class="radio-group">
            <text class="radio" :class="{ on: form.needAssistant }" @click="form.needAssistant = true">是</text>
            <text class="radio" :class="{ on: !form.needAssistant }" @click="form.needAssistant = false">否</text>
          </view>
        </view>
        <template v-if="form.needAssistant">
          <view class="form-row">
            <text class="label">协助类型</text>
            <view class="radio-group">
              <text v-for="a in ASSISTANT_TYPE" :key="a.value" class="radio" :class="{ on: form.assistantType === a.value }" @click="form.assistantType = a.value">{{ a.label }}</text>
            </view>
          </view>
          <!-- 内协：人员多选 -->
          <view class="form-row form-row--top" v-if="form.assistantType === 'inner'">
            <text class="label">内协人员</text>
            <view class="chips">
              <text v-for="p in persons" :key="p.name" class="chip" :class="{ on: form.assistantPersons.includes(p.name) }" @click="togglePerson(p.name)">{{ p.name }}</text>
            </view>
          </view>
          <!-- 外协：单位/人数/工时 -->
          <template v-if="form.assistantType === 'outer'">
            <view class="form-row">
              <text class="label">外协单位</text>
              <input class="input" v-model="form.outerOrg" placeholder="请输入外协单位" placeholder-style="color:#bbb" />
            </view>
            <view class="form-row">
              <text class="label">外协人数</text>
              <input class="input" v-model="form.outerCount" type="number" placeholder="请输入人数" placeholder-style="color:#bbb" />
            </view>
            <view class="form-row">
              <text class="label">外协工时</text>
              <input class="input" v-model="form.outerHours" type="number" placeholder="请输入工时" placeholder-style="color:#bbb" />
            </view>
          </template>
        </template>
      </SectionCard>

      <view class="submit-wrap">
        <wd-button size="large" type="primary" :loading="submitting" @click="submit">提交预约</wd-button>
      </view>
    </scroll-view>

    <!-- 客户搜索弹窗 -->
    <wd-popup v-model="showCustomer" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup-title">选择客户</view>
      <view class="popup-list">
        <view v-if="!customerList.length" class="popup-empty">未找到匹配客户</view>
        <view v-for="c in customerList" :key="c.id" class="popup-item" @click="pickCustomer(c)">
          <view class="popup-item__name">{{ c.name }}</view>
          <view class="popup-item__addr">{{ c.address }} · {{ c.warrantyPeriod }}</view>
        </view>
      </view>
    </wd-popup>
  </PageLayout>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import dayjs from 'dayjs'
import { useToast, useMessage } from 'wot-design-uni'
import { useUserStore } from '@/store/user'
import { http } from '@/utils/http'
import { MAINTENANCE_NATURE, ASSISTANT_TYPE } from '@/types/business'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const message = useMessage()
const userStore = useUserStore()
const natureTexts = MAINTENANCE_NATURE.map((n) => n.label)
const natureIndex = ref(0)

const form = ref({
  customerName: '',
  maintenanceNature: '',
  faultTime: dayjs().format('YYYY-MM-DD'),
  reserveDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
  needAssistant: false,
  assistantType: 'inner',
  assistantPersons: [] as string[],
  outerOrg: '',
  outerCount: '',
  outerHours: '',
})
const customer = ref<any>({})
const customerList = ref<any[]>([])
const showCustomer = ref(false)
const persons = [
  { name: '王强' },
  { name: '赵磊' },
  { name: '孙浩' },
  { name: '李伟' },
]
const submitting = ref(false)
const yyNo = ref('')
const currentUser = ref(userStore.userInfo.realname || '张三')

const onNature = (e: any) => {
  natureIndex.value = Number(e.detail.value)
  form.value.maintenanceNature = MAINTENANCE_NATURE[natureIndex.value].value
}

const searchCustomer = async () => {
  if (!form.value.customerName.trim()) return
  try {
    const res: any = await http.get('/ops/customerSearch', { name: form.value.customerName })
    customerList.value = res.result || []
    showCustomer.value = true
  } catch (e) {
    /* ignore */
  }
}

const pickCustomer = (c: any) => {
  form.value.customerName = c.name
  customer.value = c
  form.value.maintenanceNature = c.maintenanceNature || ''
  natureIndex.value = Math.max(0, MAINTENANCE_NATURE.findIndex((n) => n.value === c.maintenanceNature))
  showCustomer.value = false
}

const togglePerson = (name: string) => {
  const i = form.value.assistantPersons.indexOf(name)
  if (i >= 0) form.value.assistantPersons.splice(i, 1)
  else form.value.assistantPersons.push(name)
}

const submit = async () => {
  if (!form.value.customerName) return toast.warning('请选择客户')
  if (!form.value.maintenanceNature) return toast.warning('请选择维护性质')
  submitting.value = true
  try {
    const res: any = await http.post('/ops/reservation/save', { ...form.value })
    yyNo.value = res.result?.yyNo || 'YY' + Date.now()
    message.alert({ title: '预约提交成功', msg: `预约单号：${yyNo.value}\n系统将按预约时间安排维修` }).then(() => uni.navigateBack())
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

  &--top {
    align-items: flex-start;
  }

  .label {
    width: 84px;
    font-size: 14px;
    color: #333;
    flex: none;
  }

  .input,
  .search-input {
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

  .picker-value {
    flex: 1;
    font-size: 14px;
    color: #333;

    &.placeholder {
      color: #bbb;
    }
  }

  .static-val {
    flex: 1;
    font-size: 14px;
    color: #666;
  }

  .radio-group {
    flex: 1;
    display: flex;

    .radio {
      padding: 5px 18px;
      border: 1px solid #ddd;
      border-radius: 16px;
      font-size: 13px;
      color: #666;
      margin-right: 10px;

      &.on {
        border-color: #2f86ff;
        color: #2f86ff;
        background: #f0f7ff;
      }
    }
  }

  .chips {
    flex: 1;
    display: flex;
    flex-wrap: wrap;

    .chip {
      padding: 5px 14px;
      border: 1px solid #ddd;
      border-radius: 16px;
      font-size: 13px;
      color: #666;
      margin: 0 8px 8px 0;

      &.on {
        border-color: #2f86ff;
        color: #2f86ff;
        background: #f0f7ff;
      }
    }
  }
}

.submit-wrap {
  padding: 20px 16px 40px;
}

.popup-title {
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  padding: 16px 0 8px;
}

.popup-list {
  max-height: 60vh;
  overflow-y: auto;
  padding-bottom: 20px;
}

.popup-empty {
  text-align: center;
  color: #999;
  padding: 24px 0;
  font-size: 13px;
}

.popup-item {
  padding: 14px 20px;
  border-bottom: 1px solid #f5f5f5;

  &__name {
    font-size: 15px;
    color: #333;
  }

  &__addr {
    font-size: 12px;
    color: #999;
    margin-top: 4px;
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
