<route lang="json5">
{
  style: {
    navigationBarTitleText: '故障报修',
  },
}
</route>
<template>
  <PageLayout>
    <scroll-view class="page" :scroll-y="true">
      <!-- 客户信息：可搜索带出 -->
      <SectionCard title="客户信息">
        <view class="form-row">
          <text class="label">客户名称</text>
          <view class="search-box">
            <input class="search-input" v-model="form.customerName" placeholder="请输入客户名称" placeholder-style="color:#bbb" />
            <text class="search-btn" @click="searchCustomer">搜索</text>
          </view>
        </view>
        <view class="form-row">
          <text class="label">所在地址</text>
          <input class="input" v-model="form.address" placeholder="请输入地址" placeholder-style="color:#bbb" />
        </view>
        <view class="form-row">
          <text class="label">联系人</text>
          <input class="input" v-model="form.contact" placeholder="请输入联系人" placeholder-style="color:#bbb" />
        </view>
        <view class="form-row">
          <text class="label">联系电话</text>
          <input class="input" v-model="form.phone" type="number" placeholder="请输入电话" placeholder-style="color:#bbb" />
        </view>
      </SectionCard>

      <!-- 报修信息 -->
      <SectionCard title="报修信息">
        <view class="form-row">
          <text class="label">报修项目</text>
          <picker mode="selector" :range="faultTypeTexts" @change="onFaultType">
            <view class="picker-value" :class="{ placeholder: !form.faultType }">
              {{ form.faultType ? faultTypeTexts[faultTypeIndex] : '请选择报修项目' }}
            </view>
          </picker>
        </view>
        <view class="form-row">
          <text class="label">故障时间</text>
          <picker mode="date" :value="form.faultTime" @change="onFaultTime">
            <view class="picker-value">{{ form.faultTime }}</view>
          </picker>
        </view>
        <view class="form-row form-row--top">
          <text class="label">故障描述</text>
          <textarea class="textarea" v-model="form.faultDesc" placeholder="请详细描述故障现象，便于维修人员快速处理" placeholder-style="color:#bbb" />
        </view>
        <!-- 照片 / 视频 -->
        <view class="form-row form-row--top">
          <text class="label">照片/视频</text>
          <view class="upload-box">
            <view class="thumb" v-for="(img, i) in images" :key="'img' + i">
              <image :src="img" mode="aspectFill" class="thumb__img" />
              <view class="thumb__del" @click="images.splice(i, 1)">×</view>
            </view>
            <view class="thumb thumb--video" v-for="(v, i) in videos" :key="'v' + i">
              <view class="thumb__video-icon">▶</view>
              <view class="thumb__del" @click="videos.splice(i, 1)">×</view>
            </view>
            <view class="thumb thumb--add" v-if="images.length + videos.length < 6" @click="addMedia">
              <view class="add-plus">＋</view>
              <view class="add-text">拍照/视频</view>
            </view>
          </view>
        </view>
      </SectionCard>

      <view class="submit-wrap">
        <wd-button size="large" type="primary" :loading="submitting" @click="submit">提交报修</wd-button>
      </view>
    </scroll-view>

    <!-- 客户搜索弹窗 -->
    <wd-popup v-model="showCustomer" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup-title">选择客户</view>
      <view class="popup-list">
        <view v-if="!customerList.length" class="popup-empty">未找到匹配客户，请直接输入名称</view>
        <view v-for="c in customerList" :key="c.id" class="popup-item" @click="pickCustomer(c)">
          <view class="popup-item__name">{{ c.name }}</view>
          <view class="popup-item__addr">{{ c.address }}</view>
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
import { FAULT_TYPE } from '@/types/business'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const message = useMessage()
const faultTypeTexts = FAULT_TYPE.map((f) => f.label)
const faultTypeIndex = ref(0)

const form = ref({
  customerName: '',
  address: '',
  contact: '',
  phone: '',
  faultType: '',
  faultTime: dayjs().format('YYYY-MM-DD'),
  faultDesc: '',
})
const images = ref<string[]>([])
const videos = ref<string[]>([])
const showCustomer = ref(false)
const customerList = ref<any[]>([])
const submitting = ref(false)
const repairNo = ref('')

const onFaultType = (e: any) => {
  faultTypeIndex.value = Number(e.detail.value)
  form.value.faultType = FAULT_TYPE[faultTypeIndex.value].value
}
const onFaultTime = (e: any) => (form.value.faultTime = e.detail.value)

const searchCustomer = async () => {
  if (!form.value.customerName.trim()) return toast.warning('请输入客户名称')
  try {
    const res: any = await http.get('/repair/customer', { name: form.value.customerName })
    customerList.value = res.result || []
    showCustomer.value = true
  } catch (e) {
    /* ignore */
  }
}

const pickCustomer = (c: any) => {
  form.value.customerName = c.name
  form.value.address = c.address
  form.value.contact = c.contact
  form.value.phone = c.phone
  showCustomer.value = false
}

const addMedia = () => {
  uni.showActionSheet({
    itemList: ['拍照', '从相册选择', '拍摄视频'],
    success: (res) => {
      const idx = res.tapIndex
      if (idx === 2) {
        uni.chooseVideo({ count: 1, sourceType: ['camera', 'album'], success: (r) => videos.value.push(r.tempFilePath) })
      } else {
        uni.chooseImage({ count: 6, sourceType: idx === 0 ? ['camera'] : ['album'], success: (r) => images.value.push(...r.tempFilePaths) })
      }
    },
  })
}

const validate = () => {
  if (!form.value.customerName) return toast.warning('请填写客户名称')
  if (!form.value.phone) return toast.warning('请填写联系电话')
  if (!form.value.faultType) return toast.warning('请选择报修项目')
  if (!form.value.faultDesc) return toast.warning('请填写故障描述')
  return true
}

const submit = async () => {
  if (!validate()) return
  submitting.value = true
  try {
    const res: any = await http.post('/repair/apply', { ...form.value, images: images.value, videos: videos.value })
    repairNo.value = res.result?.repairNo || 'BX' + Date.now()
    message.alert({ title: '报修提交成功', msg: `报修单号：${repairNo.value}\n我们将尽快安排维修人员与您联系` }).then(() => goRecord())
  } catch (e) {
    toast.error('提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

const goRecord = () => uni.switchTab({ url: '/pages/customer/repairRecord' })
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

  .textarea {
    flex: 1;
    width: auto;
    height: 80px;
    font-size: 14px;
    padding: 0;
  }
}

.upload-box {
  flex: 1;
  display: flex;
  flex-wrap: wrap;

  .thumb {
    width: 68px;
    height: 68px;
    border-radius: 8px;
    margin: 0 8px 8px 0;
    position: relative;
    overflow: hidden;
    background: #f5f6f8;

    &__img {
      width: 100%;
      height: 100%;
    }

    &__del {
      position: absolute;
      top: 0;
      right: 0;
      width: 20px;
      height: 20px;
      background: rgba(0, 0, 0, 0.5);
      color: #fff;
      font-size: 14px;
      text-align: center;
      line-height: 20px;
      border-radius: 0 0 0 8px;
    }

    &--video {
      background: #eef3ff;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &__video-icon {
      font-size: 20px;
      color: #2f86ff;
    }

    &--add {
      border: 1px dashed #ccc;
      background: #fafafa;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;

      .add-plus {
        font-size: 22px;
        color: #999;
        line-height: 24px;
      }

      .add-text {
        font-size: 10px;
        color: #999;
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

.success-box {
  text-align: center;
  padding: 8px 0;

  .success-icon {
    font-size: 40px;
  }

  .success-no {
    font-size: 16px;
    font-weight: 600;
    margin-top: 10px;
  }

  .success-desc {
    font-size: 13px;
    color: #999;
    margin-top: 6px;
  }
}
</style>
