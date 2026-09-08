<route lang="json5">
{
  style: {
    navigationBarTitleText: '巡检表',
  },
}
</route>
<template>
  <PageLayout :navbarShow="false" v-if="detail.xjNo">
    <view class="head">
      <view class="head__no">{{ detail.xjNo }} · {{ detail.name }}</view>
      <StatusBadge :value="detail.status" :dict="statusDict" />
    </view>

    <view class="table">
      <!-- 左侧巡检对象菜单 -->
      <scroll-view class="left" :scroll-y="true">
        <view
          v-for="(obj, i) in detail.form"
          :key="obj.id"
          class="left__item"
          :class="{ on: currentObj === i }"
          @click="switchObj(i)"
        >
          <view class="left__name">{{ obj.name }}</view>
          <view class="left__dot" v-if="!isComplete(obj)"></view>
        </view>
      </scroll-view>

      <!-- 右侧填写 -->
      <scroll-view class="right" :scroll-y="true">
        <view class="right__title">{{ detail.form[currentObj]?.name }}</view>
        <view v-for="item in detail.form[currentObj]?.items" :key="item.id" class="item">
          <view class="item__label">{{ item.label }}</view>
          <view class="item__ops">
            <text class="op" :class="{ on: item.value === 'normal' }" @click="setItem(item, 'normal')">正常</text>
            <text class="op" :class="{ on: item.value === 'abnormal' }" @click="setItem(item, 'abnormal')">异常</text>
          </view>
          <view class="item__media" v-if="item.value === 'abnormal'">
            <view class="media-thumb" v-if="item.photo">
              <image :src="item.photo" mode="aspectFill" class="media-thumb__img" />
              <text class="media-thumb__del" @click="item.photo = ''">×</text>
            </view>
            <text v-else class="media-add" @click="addMedia(item)">＋ 拍照/视频</text>
          </view>
        </view>

        <!-- 巡检结论 -->
        <view class="conclusion">
          <view class="conclusion__title">巡检结论</view>
          <textarea v-model="detail.conclusion" placeholder="填写巡检结论" placeholder-style="color:#bbb" class="conclusion__textarea" />
        </view>

        <!-- 提交 / 办结 -->
        <view class="bottom-ops">
          <text v-if="allComplete && detail.status === 'undone'" class="main-btn" @click="submitForm">提交巡检</text>
        </view>
        <view class="finish-wrap" v-if="detail.status === 'undone'">
          <text class="finish-btn" @click="showFinish = true">办结</text>
        </view>
        <view class="done-tip" v-if="detail.status === 'done'">
          ✅ 已办结：{{ detail.finishRemark }} · {{ detail.finishTime }}
          <text class="download" @click="download">导出/下载巡检单</text>
        </view>
      </scroll-view>
    </view>

    <!-- 办结弹窗 -->
    <wd-popup v-model="showFinish" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup">
        <view class="popup__title">办结说明</view>
        <textarea class="finish-textarea" v-model="finishRemark" placeholder="请填写办结说明" placeholder-style="color:#bbb" />
        <view class="popup__btns">
          <text class="btn btn--plain" @click="showFinish = false">取消</text>
          <text class="btn btn--primary" @click="doFinish">确认办结</text>
        </view>
      </view>
    </wd-popup>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { useToast } from 'wot-design-uni'
import { http } from '@/utils/http'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'

const toast = useToast()
const detail = ref<any>({})
const id = ref('')
const currentObj = ref(0)
const showFinish = ref(false)
const finishRemark = ref('')

const statusDict = [
  { value: 'undone', label: '未办结', color: '#e6a23c' },
  { value: 'done', label: '已办结', color: '#67c23a' },
]

const isComplete = (obj: any) => obj.items.every((i: any) => i.value)

const allComplete = computed(() => detail.value.form?.every((o: any) => isComplete(o)))

const load = async () => {
  try {
    const res: any = await http.get('/inspection/detail', { id: id.value })
    detail.value = res.result
    detail.value.conclusion = detail.value.conclusion || ''
  } catch (e) {
    /* ignore */
  }
}

const switchObj = (i: number) => {
  currentObj.value = i
  // 切换自动保存
  http.post('/inspection/saveItem', { id: id.value, objIndex: i, form: detail.value.form }).catch(() => {})
}

const setItem = (item: any, v: string) => {
  item.value = item.value === v ? '' : v
}

const addMedia = (item: any) => {
  uni.chooseImage({ count: 1, success: (r) => (item.photo = r.tempFilePaths[0]) })
}

const submitForm = async () => {
  await http.post('/inspection/saveItem', { id: id.value, form: detail.value.form, submit: true })
  toast.success('巡检已提交')
}

const doFinish = async () => {
  if (!finishRemark.value.trim()) return toast.warning('请填写办结说明')
  await http.post('/inspection/finish', { id: id.value, remark: finishRemark.value })
  toast.success('已办结')
  showFinish.value = false
  load()
}

const download = () => toast.success('已生成巡检单下载链接（模拟）')

onLoad((query) => {
  id.value = query?.id || ''
  load()
})
</script>

<style lang="scss" scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  padding: 14px 16px;

  &__no {
    font-size: 15px;
    font-weight: 600;
    color: #333;
  }
}

.table {
  display: flex;
  height: calc(100vh - 44px - 56px);

  .left {
    width: 96px;
    background: #f7f8fa;
    flex: none;

    &__item {
      padding: 16px 10px;
      font-size: 13px;
      color: #666;
      text-align: center;
      position: relative;
      border-left: 3px solid transparent;

      &.on {
        background: #fff;
        color: #2f86ff;
        font-weight: 600;
        border-left-color: #2f86ff;
      }
    }

    &__name {
      display: inline-block;
    }

    &__dot {
      position: absolute;
      top: 10px;
      right: 8px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f56c6c;
    }
  }

  .right {
    flex: 1;
    min-width: 0;
    background: #fff;
    padding: 14px;

    &__title {
      font-size: 15px;
      font-weight: 600;
      color: #333;
      margin-bottom: 10px;
    }
  }
}

.item {
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;

  &__label {
    font-size: 14px;
    color: #333;
    margin-bottom: 8px;
  }

  &__ops {
    display: flex;

    .op {
      padding: 5px 16px;
      border: 1px solid #ddd;
      border-radius: 15px;
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

  &__media {
    margin-top: 10px;

    .media-thumb {
      width: 70px;
      height: 70px;
      position: relative;

      &__img {
        width: 100%;
        height: 100%;
        border-radius: 6px;
      }

      &__del {
        position: absolute;
        top: 0;
        right: 0;
        width: 18px;
        height: 18px;
        background: rgba(0, 0, 0, 0.5);
        color: #fff;
        font-size: 13px;
        text-align: center;
        line-height: 18px;
        border-radius: 0 0 0 6px;
      }
    }

    .media-add {
      display: inline-block;
      padding: 6px 12px;
      border: 1px dashed #2f86ff;
      border-radius: 6px;
      color: #2f86ff;
      font-size: 13px;
    }
  }
}

.conclusion {
  margin-top: 14px;

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  &__textarea {
    width: 100%;
    height: 80px;
    margin-top: 8px;
    background: #f7f8fa;
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    box-sizing: border-box;
  }
}

.bottom-ops {
  margin-top: 16px;

  .main-btn {
    display: block;
    text-align: center;
    background: #2f86ff;
    color: #fff;
    padding: 12px 0;
    border-radius: 22px;
    font-size: 15px;
  }
}

.finish-wrap {
  margin-top: 12px;

  .finish-btn {
    display: block;
    text-align: center;
    border: 1px solid #2f86ff;
    color: #2f86ff;
    padding: 12px 0;
    border-radius: 22px;
    font-size: 15px;
  }
}

.done-tip {
  margin-top: 16px;
  background: #f0f9eb;
  border-radius: 8px;
  padding: 12px;
  font-size: 13px;
  color: #67c23a;

  .download {
    color: #2f86ff;
    margin-left: 8px;
  }
}

.popup {
  padding: 16px 20px 24px;

  &__title {
    font-size: 16px;
    font-weight: 600;
    text-align: center;
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

.finish-textarea {
  width: 100%;
  height: 80px;
  margin-top: 14px;
  background: #f7f8fa;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  box-sizing: border-box;
}
</style>
