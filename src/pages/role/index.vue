<route lang="json5">
{
  style: {
    navigationBarTitleText: '角色演示入口',
  },
}
</route>
<template>
  <PageLayout>
    <scroll-view class="page" :scroll-y="true">
      <view class="tip">登录/角色路由尚未接通，此页面用于预览各角色页面（开发期专用）</view>
      <SectionCard v-for="g in groups" :key="g.title" :title="g.title">
        <view v-for="p in g.pages" :key="p.path" class="item" @click="go(p.path)">
          <text class="item__label">{{ p.label }}</text>
          <text class="item__arrow">›</text>
        </view>
      </SectionCard>
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
const groups = [
  {
    title: '客户',
    pages: [
      { label: '客户首页', path: '/pages/customer/home' },
      { label: '故障报修', path: '/pages/customer/repair' },
      { label: '报修记录', path: '/pages/customer/repairRecord' },
      { label: '报修详情', path: '/pages/customer/repairDetail?id=bx3' },
      { label: '维修确认签字', path: '/pages/customer/confirm?id=bx3' },
    ],
  },
  {
    title: '运维',
    pages: [
      { label: '运维工作台', path: '/pages/ops/home' },
      { label: '报修接单', path: '/pages/ops/accept' },
      { label: '接单详情', path: '/pages/ops/acceptDetail?id=ac1' },
      { label: '线下预约', path: '/pages/ops/reservation' },
      { label: '用料申请', path: '/pages/ops/materialApply' },
      { label: '还料申请', path: '/pages/ops/materialReturn' },
      { label: '线下维修', path: '/pages/ops/repairOffline?id=wo1' },
      { label: '线上维修', path: '/pages/ops/repairOnline?id=wo5' },
      { label: '维修记录', path: '/pages/ops/repairRecord' },
      { label: '工单详情', path: '/pages/ops/repairDetail?id=wo2' },
      { label: '车辆管理', path: '/pages/ops/vehicle' },
      { label: '内协打卡', path: '/pages/ops/punch' },
      { label: '实施日志', path: '/pages/ops/implementLog' },
      { label: '项目列表', path: '/pages/ops/project' },
      { label: '项目详情', path: '/pages/ops/projectDetail?id=p1' },
      { label: '巡检管理', path: '/pages/ops/inspection' },
    ],
  },
  {
    title: '库管',
    pages: [
      { label: '申请物料记录', path: '/pages/stock/materialApply' },
      { label: '申请详情', path: '/pages/stock/materialDetail?id=s1' },
    ],
  },
  {
    title: '管理员',
    pages: [
      { label: '审批工单', path: '/pages/admin/approval' },
      { label: '审批详情', path: '/pages/admin/approvalDetail?id=ap1' },
    ],
  },
  {
    title: '信息部门',
    pages: [
      { label: '派单列表', path: '/pages/dispatch/list' },
      { label: '派单详情', path: '/pages/dispatch/detail?id=d1' },
    ],
  },
]

const go = (path: string) => {
  const tabPages = ['/pages/customer/home', '/pages/customer/repairRecord', '/pages/customer/mine']
  if (tabPages.includes(path)) return uni.switchTab({ url: path })
  uni.navigateTo({ url: path })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 0;
}

.tip {
  background: #fff7e6;
  color: #e6a23c;
  font-size: 12px;
  padding: 10px 14px;
  margin: 12px;
  border-radius: 8px;
}

.item {
  display: flex;
  align-items: center;
  padding: 13px 4px;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  &__label {
    flex: 1;
    font-size: 14px;
    color: #333;
  }

  &__arrow {
    color: #ccc;
  }
}
</style>
