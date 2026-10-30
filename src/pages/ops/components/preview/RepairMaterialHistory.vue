<template>
  <wd-popup :model-value="!!material" position="bottom" :z-index="12500" :safe-area-inset-bottom="true" custom-style="border-radius:16px 16px 0 0" @update:model-value="close">
    <view v-if="material" class="panel">
      <view class="head"><text>物料详情</text><button @click="close">关闭</button></view>
      <scroll-view scroll-y class="body">
        <view class="material-heading">
          <text class="name">{{ material.materialName || '物料名称未返回' }}</text>
          <text v-if="material.brand_dictText || material.brand || material.model" class="hint">{{ [material.brand_dictText || material.brand, material.model].filter(Boolean).join(' / ') }}</text>
          <text class="unit">数量单位：{{ material.baseUnitName || '未返回' }}</text>
        </view>
        <view v-for="group in groups" :key="group.title" class="section">
          <text class="section-title">{{ group.title }}</text>
          <view class="quantities">
            <view v-for="field in group.fields" :key="field.key" class="quantity">
              <text class="quantity-label">{{ field.label }}</text><text class="quantity-value">{{ quantity(field.key) }}</text>
            </view>
          </view>
          <text class="hint section-note">{{ group.note }}</text>
        </view>
        <text class="footnote">各项有包含关系，请勿直接相加。“—”表示数据未返回，不代表 0。</text>
      </scroll-view>
    </view>
  </wd-popup>
</template>
<script setup lang="ts">
const props=defineProps<{orderId:string;material:any}>()
const emit=defineEmits(['close'])
// 按 materialAccount/page 定义展示，不将有效占用命名为历史申请总量。
const groups=[
  {title:'领料情况',fields:[{key:'applyingQty',label:'申请中领料'},{key:'pendingApplyQty',label:'待审批量'},{key:'unOutboundQty',label:'待出库量'},{key:'outboundQty',label:'已出库量'}],note:'申请中领料 = 待审批 + 已审批待出库。'},
  {title:'使用情况',fields:[{key:'consumedQty',label:'已使用量'}],note:'包含已提交待确认的用料，草稿不计入。'},
  {title:'还料情况',fields:[{key:'shouldReturnQty',label:'应还总量'},{key:'frozenReturnQty',label:'还料申请占用'},{key:'pendingReturnQty',label:'待处理还料'},{key:'actualReturnQty',label:'已入库量'},{key:'availableReturnQty',label:'当前可还量'}],note:'应还总量未扣已还；申请占用包含有效申请及已执行部分。待处理含待审批、待执行，不等于待入库。'},
]
function quantity(key:string){const value=props.material?.[key];return value == null || value === '' ? '—' : value}
function close(){emit('close')}
</script>
<style scoped>
.panel{background:#fff;color:#344054;display:flex;flex-direction:column;max-height:88vh}
.head{display:flex;align-items:center;justify-content:space-between;flex-shrink:0;padding:8px 16px;border-bottom:1px solid #edf0f3;font-size:17px;font-weight:600}
.head button{margin:0;padding:0 8px;min-height:44px;line-height:44px;background:transparent;color:#176ac7;font-size:14px;font-weight:400}
button::after{border:0}button:focus-visible{outline:2px solid #176ac7;outline-offset:2px}
.body{max-height:calc(88vh - 61px);min-height:0;box-sizing:border-box;padding:0 16px}
.material-heading{padding:16px 0 12px}.name{display:block;font-size:16px;font-weight:600;overflow-wrap:anywhere;line-height:1.6}
.hint{display:block;font-size:12px;line-height:1.7;color:#667085;overflow-wrap:anywhere}.unit{display:block;margin-top:8px;font-size:12px;color:#536176}
.section{padding:20px 0 16px;border-bottom:1px solid #edf0f3}.section-title{display:block;font-size:15px;font-weight:600;line-height:1.5;margin-bottom:12px}
.quantities{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 20px}.quantity{display:flex;flex-direction:column;gap:3px;min-width:0}.quantity-label{font-size:13px;color:#667085;line-height:1.6}.quantity-value{font-size:19px;font-weight:600;line-height:1.5;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.section-note{margin-top:12px}.footnote{display:block;padding:14px 0 20px;color:#667085;font-size:12px;line-height:1.7}
</style>
