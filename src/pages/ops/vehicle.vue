<route lang="json5">
{
  style: {
    navigationBarTitleText: '车辆管理',
  },
}
</route>
<template>
  <PageLayout>
    <view class="tabs">
      <view v-for="(t, i) in tabs" :key="t.value" class="tab" :class="{ on: active === i }" @click="switchTab(i)">{{ t.label }}</view>
    </view>

    <scroll-view class="list" :scroll-y="true">
      <view v-if="!list.length" class="empty">暂无{{ tabs[active].label }}记录</view>

      <!-- 加油记录 -->
      <view v-for="r in list" :key="r.id" class="card" v-if="active === 0">
        <view class="card__head"><text class="card__title">{{ r.type }}</text><text class="card__date">{{ r.date }}</text></view>
        <view class="row"><text class="label">车牌</text><text class="val">{{ r.plate }}</text></view>
        <view class="row"><text class="label">油量</text><text class="val">{{ r.amount }}</text></view>
        <view class="row"><text class="label">金额</text><text class="val price">¥{{ r.price }}</text></view>
        <view class="row"><text class="label">加油站</text><text class="val">{{ r.station }}</text></view>
        <view class="row"><text class="label">里程</text><text class="val">{{ r.odometer }} km</text></view>
        <image v-if="r.image" :src="r.image" mode="aspectFill" class="card__img" />
      </view>

      <!-- 行车记录 -->
      <view v-for="r in list" :key="r.id" class="card" v-if="active === 1">
        <view class="card__head"><text class="card__title">{{ r.plate }}</text><text class="card__date">{{ r.startTime }}</text></view>
        <view class="row"><text class="label">出发</text><text class="val">{{ r.startLoc }} · {{ r.startTime }}</text></view>
        <view class="row"><text class="label">到达</text><text class="val">{{ r.endLoc }} · {{ r.endTime }}</text></view>
        <view class="row"><text class="label">里程</text><text class="val">{{ r.mileage }} km</text></view>
        <view class="row"><text class="label">事由</text><text class="val">{{ r.purpose }}</text></view>
        <image v-if="r.image" :src="r.image" mode="aspectFill" class="card__img" />
      </view>

      <!-- 保养记录 -->
      <view v-for="r in list" :key="r.id" class="card" v-if="active === 2">
        <view class="card__head"><text class="card__title">{{ r.type }}</text><text class="card__date">{{ r.date }}</text></view>
        <view class="row"><text class="label">车牌</text><text class="val">{{ r.plate }}</text></view>
        <view class="row"><text class="label">费用</text><text class="val price">¥{{ r.cost }}</text></view>
        <view class="row"><text class="label">门店</text><text class="val">{{ r.store }}</text></view>
        <view class="row"><text class="label">里程</text><text class="val">{{ r.odometer }} km</text></view>
      </view>

      <!-- 车辆日志 -->
      <view v-for="r in list" :key="r.id" class="card" v-if="active === 3">
        <view class="card__head"><text class="card__title">{{ r.plate }}</text><text class="card__date">{{ r.date || r.startTime }}</text></view>
        <view class="row"><text class="label">类型</text><text class="val">{{ r.type || '行车' }}</text></view>
        <view class="row"><text class="label">内容</text><text class="val">{{ r.station || r.store || r.purpose || (r.startLoc + ' → ' + r.endLoc) }}</text></view>
      </view>

      <view class="add-btn" @click="showAdd = true">＋ 添加{{ tabs[active].label }}记录</view>
    </scroll-view>

    <!-- 新增弹窗 -->
    <wd-popup v-model="showAdd" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup">
        <view class="popup__title">添加{{ tabs[active].label }}记录</view>
        <view class="form-row">
          <text class="label">车牌</text>
          <picker mode="selector" :range="plates" @change="(e: any) => (addForm.plate = plates[Number(e.detail.value)])">
            <view class="picker-value">{{ addForm.plate }}</view>
          </picker>
        </view>
        <view class="form-row">
          <text class="label">日期</text>
          <picker mode="date" :value="addForm.date" @change="(e: any) => (addForm.date = e.detail.value)">
            <view class="picker-value">{{ addForm.date }}</view>
          </picker>
        </view>
        <view class="form-row" v-if="active === 0">
          <text class="label">油量/金额</text>
          <input class="input" v-model="addForm.amount" placeholder="如 42.3L" placeholder-style="color:#bbb" />
        </view>
        <view class="form-row" v-if="active === 1">
          <text class="label">里程</text>
          <input class="input" v-model="addForm.mileage" type="number" placeholder="km" placeholder-style="color:#bbb" />
        </view>
        <view class="form-row" v-if="active === 2">
          <text class="label">保养项目</text>
          <input class="input" v-model="addForm.type" placeholder="如 机油机滤" placeholder-style="color:#bbb" />
        </view>
        <view class="form-row">
          <text class="label">备注</text>
          <input class="input" v-model="addForm.remark" placeholder="选填" placeholder-style="color:#bbb" />
        </view>
        <view class="popup__btns">
          <text class="btn btn--plain" @click="showAdd = false">取消</text>
          <text class="btn btn--primary" @click="save">保存</text>
        </view>
      </view>
    </wd-popup>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onLoad, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import dayjs from 'dayjs'
import { useToast } from 'wot-design-uni'
import { http } from '@/utils/http'

const toast = useToast()
const tabs = [
  { value: 'fuel', label: '加油' },
  { value: 'trip', label: '行车' },
  { value: 'maintain', label: '保养' },
  { value: 'log', label: '车辆日志' },
]
const active = ref(0)
const list = ref<any[]>([])
const showAdd = ref(false)
const plates = ['沪A·8H213', '沪B·3K556']
const addForm = ref({ plate: plates[0], date: dayjs().format('YYYY-MM-DD'), amount: '', mileage: '', type: '', remark: '' })

const load = async () => {
  try {
    const res: any = await http.get('/ops/vehicleList', { type: tabs[active.value].value })
    list.value = res.result || []
  } catch (e) {
    /* ignore */
  }
}

const switchTab = (i: number) => {
  active.value = i
  load()
}

const save = async () => {
  await http.post('/ops/vehicle/save', { type: tabs[active.value].value, ...addForm.value })
  toast.success('已保存')
  showAdd.value = false
  load()
}

onLoad((query) => {
  const map: Record<string, number> = { fuel: 0, trip: 1, maintain: 2, log: 3 }
  active.value = map[(query as any)?.tab] ?? 0
})
onShow(load)
</script>

<style lang="scss" scoped>
.tabs {
  display: flex;
  background: #fff;

  .tab {
    flex: 1;
    text-align: center;
    padding: 13px 0;
    font-size: 14px;
    color: #666;
    position: relative;

    &.on {
      color: #2f86ff;
      font-weight: 600;

      &::after {
        content: '';
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        bottom: 5px;
        width: 24px;
        height: 3px;
        border-radius: 2px;
        background: #2f86ff;
      }
    }
  }
}

.list {
  height: calc(100vh - 44px - 80px);
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
    justify-content: space-between;
    margin-bottom: 6px;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: #333;
  }

  &__date {
    font-size: 12px;
    color: #bbb;
  }

  &__img {
    width: 100%;
    height: 120px;
    border-radius: 8px;
    margin-top: 10px;
  }
}

.row {
  display: flex;
  margin-top: 6px;

  .label {
    width: 70px;
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
    }
  }
}

.add-btn {
  text-align: center;
  color: #2f86ff;
  font-size: 14px;
  padding: 16px 0 30px;
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

.form-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;

  .label {
    width: 76px;
    font-size: 14px;
    color: #333;
    flex: none;
  }

  .input,
  .picker-value {
    flex: 1;
    font-size: 14px;
    color: #333;
  }
}
</style>
