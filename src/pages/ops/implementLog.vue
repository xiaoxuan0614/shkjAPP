<route lang="json5">
{
  style: {
    navigationBarTitleText: '实施日志',
  },
}
</route>
<template>
  <PageLayout>
    <scroll-view class="page" :scroll-y="true">
      <!-- ① 项目信息 -->
      <SectionCard title="项目信息">
        <view class="form-row">
          <text class="label">选择项目</text>
          <picker mode="selector" :range="projectNames" @change="onProject">
            <view class="picker-value" :class="{ placeholder: !project.id }">{{ project.name || '请选择项目' }}</view>
          </picker>
        </view>
        <template v-if="project.id">
          <view class="row"><text class="label">当前工序</text><text class="val">{{ project.currentProcess }}</text></view>
          <view class="row"><text class="label">计划周期</text><text class="val">{{ project.processPlan }}</text></view>
          <view class="row"><text class="label">剩余工期</text>
            <text class="val" :class="{ warn: project.remainDays < 0 }">{{ project.remainDays < 0 ? `已延期 ${-project.remainDays} 天` : project.remainDays + ' 天' }}</text>
          </view>
        </template>
      </SectionCard>

      <!-- ② 实施记录 -->
      <SectionCard title="实施记录">
        <view class="form-row form-row--top">
          <text class="label">现场照片</text>
          <view class="photos">
            <view v-for="(p, i) in photos" :key="i" class="photo">
              <image :src="p" mode="aspectFill" class="photo__img" />
              <text class="photo__del" @click="photos.splice(i, 1)">×</text>
            </view>
            <view class="photo photo--add" @click="addPhoto">＋</view>
          </view>
        </view>
        <view class="form-row">
          <text class="label">实施位置</text>
          <input class="input" v-model="form.location" placeholder="填写实施位置" placeholder-style="color:#bbb" />
        </view>
        <view class="form-row form-row--top">
          <text class="label">实施内容</text>
          <textarea class="textarea" v-model="form.content" placeholder="填写本次实施内容" placeholder-style="color:#bbb" />
        </view>
        <view class="form-row">
          <text class="label">参与人员</text>
          <view class="chips">
            <text v-for="p in persons" :key="p" class="chip" :class="{ on: form.persons.includes(p) }" @click="togglePerson(p)">{{ p }}</text>
          </view>
        </view>
        <view class="form-row">
          <text class="label">外协人数</text>
          <input class="input" v-model="form.outerCount" type="number" placeholder="0" placeholder-style="color:#bbb" />
        </view>
        <view class="form-row">
          <text class="label">外协工时</text>
          <input class="input" v-model="form.outerHours" type="number" placeholder="0" placeholder-style="color:#bbb" />
        </view>
      </SectionCard>

      <!-- ③ 行车 + 用料 -->
      <SectionCard title="行车记录">
        <view class="form-row">
          <text class="label">用车</text>
          <picker mode="selector" :range="plates" @change="(e: any) => (form.plate = plates[Number(e.detail.value)])">
            <view class="picker-value" :class="{ placeholder: !form.plate }">{{ form.plate || '选择车辆' }}</view>
          </picker>
        </view>
      </SectionCard>
      <SectionCard title="用料记录">
        <view v-for="m in materials" :key="m.id" class="mat-row">
          <text class="mat-name">{{ m.name }} {{ m.spec }}</text>
          <text class="mat-qty">库存 {{ m.stock }}{{ m.unit }}</text>
          <input class="mat-input" type="number" placeholder="0" placeholder-style="color:#bbb" v-model="m.qty" />
        </view>
      </SectionCard>

      <view class="submit-wrap">
        <wd-button size="large" type="primary" :loading="submitting" @click="submit">提交实施日志</wd-button>
      </view>
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useToast, useMessage } from 'wot-design-uni'
import { http } from '@/utils/http'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const message = useMessage()
const projects = ref<any[]>([])
const projectNames = ref<string[]>([])
const project = ref<any>({})
const photos = ref<string[]>([])
const form = ref({ location: '', content: '', persons: [] as string[], outerCount: '', outerHours: '', plate: '' })
const persons = ['王强', '赵磊', '孙浩', '李伟']
const plates = ['沪A·8H213', '沪B·3K556']
const materials = ref<any[]>([])
const submitting = ref(false)
const sgNo = ref('')

const onProject = (e: any) => {
  const p = projects.value[Number(e.detail.value)]
  project.value = p
}

const togglePerson = (name: string) => {
  const i = form.value.persons.indexOf(name)
  if (i >= 0) form.value.persons.splice(i, 1)
  else form.value.persons.push(name)
}

const addPhoto = () => uni.chooseImage({ count: 3, success: (r) => photos.value.push(...r.tempFilePaths) })

const load = async () => {
  try {
    const [pRes, mRes]: any = await Promise.all([http.get('/project/list'), http.get('/stock/material/list')])
    projects.value = pRes.result || []
    projectNames.value = projects.value.map((p: any) => p.name)
    materials.value = (mRes.result || []).slice(0, 4).map((m: any) => ({ ...m, qty: '' }))
  } catch (e) {
    /* ignore */
  }
}

const submit = async () => {
  if (!project.value.id) return toast.warning('请选择项目')
  if (!form.value.content.trim()) return toast.warning('请填写实施内容')
  submitting.value = true
  try {
    const res: any = await http.post('/project/implementLog/save', {
      projectId: project.value.id,
      ...form.value,
      photos: photos.value,
      materials: materials.value.filter((m) => m.qty).map((m) => ({ id: m.id, name: m.name, qty: m.qty })),
    })
    sgNo.value = res.result?.sgNo || 'SG' + Date.now()
    message.alert({ title: '提交成功', msg: `实施单号：${sgNo.value}` }).then(() => uni.navigateBack())
  } catch (e) {
    toast.error('提交失败')
  } finally {
    submitting.value = false
  }
}

const back = () => uni.navigateBack()
load()
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

  .input {
    flex: 1;
    font-size: 14px;
  }

  .textarea {
    flex: 1;
    height: 70px;
    font-size: 13px;
    padding: 0;
  }

  .picker-value {
    flex: 1;
    font-size: 14px;
    color: #333;

    &.placeholder {
      color: #bbb;
    }
  }

  .photos {
    flex: 1;
    display: flex;
    flex-wrap: wrap;

    .photo {
      width: 60px;
      height: 60px;
      border-radius: 6px;
      margin: 0 8px 8px 0;
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

      &--add {
        border: 1px dashed #ccc;
        color: #999;
        font-size: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
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

.row {
  display: flex;
  padding: 8px 0;

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

    &.warn {
      color: #f56c6c;
    }
  }
}

.mat-row {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;

  .mat-name {
    flex: 1;
    font-size: 14px;
    color: #333;
  }

  .mat-qty {
    font-size: 12px;
    color: #999;
    margin-right: 12px;
  }

  .mat-input {
    width: 60px;
    text-align: center;
    border: 1px solid #eee;
    border-radius: 6px;
    padding: 4px 0;
    font-size: 13px;
  }
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
    font-size: 16px;
    font-weight: 600;
    margin-top: 10px;
  }
}
</style>
