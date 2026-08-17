<route lang="json5">
{
  style: {
    navigationBarTitleText: '维修确认',
  },
}
</route>
<template>
  <PageLayout v-if="info.id">
    <!-- 步骤条 -->
    <view class="steps">
      <view v-for="(s, i) in stepList" :key="i" class="step" :class="{ active: i < step, current: i === step }">
        <view class="step__dot">{{ i < step ? '✓' : i + 1 }}</view>
        <view class="step__label">{{ s }}</view>
      </view>
    </view>

    <scroll-view class="page" :scroll-y="true">
      <!-- ===== 步骤 1 核对信息 ===== -->
      <template v-if="step === 0">
        <SectionCard title="客户信息">
          <view class="row"><text class="label">客户名称</text><text class="val">{{ info.customerName }}</text></view>
          <view class="row"><text class="label">地址</text><text class="val">{{ info.address }}</text></view>
          <view class="row"><text class="label">联系人</text><text class="val">{{ info.contact }} {{ info.phone }}</text></view>
        </SectionCard>
        <SectionCard title="维护信息">
          <view class="row"><text class="label">报修单号</text><text class="val">{{ info.repairNo }}</text></view>
          <view class="row"><text class="label">报修项目</text><text class="val">{{ info.project }}</text></view>
          <view class="row"><text class="label">故障描述</text><text class="val">{{ info.faultDesc }}</text></view>
        </SectionCard>
        <SectionCard title="维修前后照片">
          <view class="img-group">
            <view class="img-block">
              <view class="img-block__title">维修前</view>
              <image v-for="(p, i) in info.beforePhotos" :key="'b' + i" :src="p" mode="aspectFill" class="img" @click="preview(info.beforePhotos, i)" />
            </view>
            <view class="img-block">
              <view class="img-block__title">维修后</view>
              <image v-for="(p, i) in info.afterPhotos" :key="'a' + i" :src="p" mode="aspectFill" class="img" @click="preview(info.afterPhotos, i)" />
            </view>
          </view>
        </SectionCard>
        <SectionCard title="运维专员与报价">
          <view class="row"><text class="label">运维专员</text><text class="val">{{ info.repairerName }}</text></view>
          <view class="row"><text class="label">人工费</text><text class="val">¥{{ info.price.labor }}</text></view>
          <view class="row"><text class="label">材料费</text><text class="val">¥{{ info.price.material }}</text></view>
          <view class="row"><text class="label">合计</text><text class="val price">¥{{ info.price.total }}</text></view>
        </SectionCard>
      </template>

      <!-- ===== 步骤 2 签字确认 ===== -->
      <template v-if="step === 1">
        <SectionCard title="签字确认">
          <view class="sign-tip">请在下方签字板签名确认本次维修结果</view>
          <view class="sign-box">
            <canvas
              class="sign-canvas"
              :style="{ width: canvasW + 'px', height: canvasH + 'px' }"
              canvas-id="signCanvas"
              @touchstart="onTouchStart"
              @touchmove="onTouchMove"
              @touchend="onTouchEnd"
            ></canvas>
            <view class="sign-bg">签名区域</view>
          </view>
          <view class="sign-ops">
            <text class="sign-op" @click="resetSign">重置</text>
          </view>
        </SectionCard>
      </template>

      <!-- ===== 步骤 3 评价建议 ===== -->
      <template v-if="step === 2">
        <SectionCard title="服务评价">
          <view class="rate-row" v-for="(r, i) in rateItems" :key="i">
            <text class="rate-label">{{ r.label }}</text>
            <view class="stars">
              <text v-for="n in 5" :key="n" class="star" :class="{ on: n <= evaluate[r.key] }" @click="evaluate[r.key] = n">★</text>
            </view>
          </view>
          <view class="rate-row rate-row--top">
            <text class="rate-label">建议</text>
            <textarea class="rate-textarea" v-model="evaluate.suggestion" placeholder="填写您的建议（选填）" placeholder-style="color:#bbb" />
          </view>
        </SectionCard>
      </template>
    </scroll-view>

    <!-- 底部操作 -->
    <view class="bottom">
      <text v-if="step > 0" class="btn btn--plain" @click="step--">上一步</text>
      <text v-if="step < 2" class="btn btn--primary" @click="next">下一步</text>
      <text v-else class="btn btn--primary" :loading="submitting" @click="submit">提交</text>
    </view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { ref, getCurrentInstance } from 'vue'
import { useToast, useMessage } from 'wot-design-uni'
import { http } from '@/utils/http'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const message = useMessage()
const info = ref<any>({})
const stepList = ['核对信息', '签字确认', '评价建议']
const step = ref(0)
const submitting = ref(false)
const id = ref('')

const rateItems = [
  { key: 'speed', label: '响应速度' },
  { key: 'handle', label: '处理速度' },
  { key: 'attitude', label: '服务态度' },
]
const evaluate = ref<Record<string, any>>({ speed: 5, handle: 5, attitude: 5, suggestion: '' })

// 签名板
const canvasW = ref(320)
const canvasH = ref(180)
let ctx: any = null
let drawing = false

const initCanvas = () => {
  const sys = uni.getSystemInfoSync()
  const w = (sys.windowWidth || 375) - 60
  canvasW.value = w
  canvasH.value = Math.round((w * 180) / 320)
  setTimeout(() => {
    ctx = uni.createCanvasContext('signCanvas', getCurrentInstance()?.proxy)
    ctx.setStrokeStyle('#333')
    ctx.setLineWidth(2)
    ctx.setLineCap('round')
    ctx.setLineJoin('round')
  }, 100)
}

const getPos = (e: any) => {
  const t = e.touches && e.touches[0]
  return { x: t ? t.x : 0, y: t ? t.y : 0 }
}

const onTouchStart = (e: any) => {
  drawing = true
  const { x, y } = getPos(e)
  ctx?.beginPath()
  ctx?.moveTo(x, y)
}
const onTouchMove = (e: any) => {
  if (!drawing) return
  const { x, y } = getPos(e)
  ctx?.lineTo(x, y)
  ctx?.stroke()
  ctx?.draw(true)
  ctx?.moveTo(x, y)
}
const onTouchEnd = () => {
  drawing = false
}

const resetSign = () => {
  ctx?.clearRect(0, 0, canvasW.value, canvasH.value)
  ctx?.draw()
}

const saveSign = (): Promise<string> =>
  new Promise((resolve) => {
    uni.canvasToTempFilePath(
      { canvasId: 'signCanvas', success: (res) => resolve(res.tempFilePath), fail: () => resolve('') },
      getCurrentInstance()?.proxy,
    )
  })

const next = async () => {
  if (step.value === 1) {
    const sign = await saveSign()
    if (!sign) return toast.warning('请先完成签字')
    info.value.signImage = sign
  }
  step.value++
}

const submit = async () => {
  submitting.value = true
  try {
    await http.post('/repair/confirm', {
      id: id.value,
      signImage: info.value.signImage,
      evaluate: evaluate.value,
    })
    message.alert({ title: '确认完成', msg: '维修确认与评价已提交\n感谢您的信任与支持' }).then(() => {
      uni.switchTab({ url: '/pages/customer/repairRecord' })
    })
  } catch (e) {
    toast.error('提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

const back = () => {
  uni.switchTab({ url: '/pages/customer/repairRecord' })
}
const preview = (urls: string[], index: number) => uni.previewImage({ urls, current: index })

onLoad(async (query) => {
  id.value = query?.id || ''
  try {
    const res: any = await http.get('/repair/confirmInfo', { id: id.value })
    info.value = res.result
  } catch (e) {
    /* ignore */
  }
  initCanvas()
})
</script>

<style lang="scss" scoped>
.steps {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 14px 16px;

  .step {
    flex: 1;
    display: flex;
    align-items: center;
    flex-direction: column;
    position: relative;

    &__dot {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #e5e5e5;
      color: #999;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &__label {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }

    &::before {
      content: '';
      position: absolute;
      top: 12px;
      left: -50%;
      width: 100%;
      height: 2px;
      background: #e5e5e5;
      z-index: 0;
    }

    &:first-child::before {
      display: none;
    }

    &.active {
      .step__dot {
        background: #67c23a;
        color: #fff;
      }
      .step__label {
        color: #67c23a;
      }
      &::before {
        background: #67c23a;
      }
    }

    &.current {
      .step__dot {
        background: #2f86ff;
        color: #fff;
      }
      .step__label {
        color: #2f86ff;
        font-weight: 600;
      }
    }
  }
}

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

    &.price {
      color: #f56c6c;
      font-weight: 600;
    }
  }
}

.img-group {
  display: flex;

  .img-block {
    flex: 1;

    &__title {
      font-size: 13px;
      color: #666;
      margin-bottom: 8px;
      font-weight: 500;
    }

    .img {
      width: 90%;
      height: 90px;
      border-radius: 8px;
      margin-bottom: 8px;
    }
  }
}

.sign-tip {
  font-size: 13px;
  color: #999;
  margin-bottom: 12px;
}

.sign-box {
  position: relative;
  border: 1px dashed #ccc;
  border-radius: 8px;
  overflow: hidden;

  .sign-canvas {
    position: relative;
    z-index: 2;
  }

  .sign-bg {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #ddd;
    font-size: 16px;
    z-index: 1;
    pointer-events: none;
  }
}

.sign-ops {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;

  .sign-op {
    color: #2f86ff;
    font-size: 13px;
    padding: 6px 16px;
    border: 1px solid #2f86ff;
    border-radius: 16px;
  }
}

.rate-row {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  &--top {
    align-items: flex-start;
  }

  .rate-label {
    width: 84px;
    font-size: 14px;
    color: #333;
    flex: none;
  }

  .stars {
    .star {
      font-size: 26px;
      color: #ddd;
      margin-right: 4px;

      &.on {
        color: #ff9900;
      }
    }
  }

  .rate-textarea {
    flex: 1;
    height: 80px;
    font-size: 13px;
    padding: 0;
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
    padding: 11px 0;
    border-radius: 22px;
    font-size: 14px;
    margin-left: 12px;

    &:first-child {
      margin-left: 0;
    }

    &--primary {
      background: #2f86ff;
      color: #fff;
    }

    &--plain {
      border: 1px solid #ddd;
      color: #666;
    }
  }
}

.done-box {
  text-align: center;
  padding: 8px 0;

  .done-icon {
    font-size: 40px;
  }

  .done-text {
    font-size: 16px;
    font-weight: 600;
    margin-top: 10px;
  }

  .done-sub {
    font-size: 13px;
    color: #999;
    margin-top: 6px;
  }
}
</style>
