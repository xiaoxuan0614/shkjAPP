import type { App } from 'vue';
// 仅保留被业务组件复用的 statusTip（选人/在线表单等），echarts/拖拽等模板组件已随 demo 清理
import StatusTip from '@/pages-work/components/statusTip.vue';

// 全局注册组件
export function registerGlobComp(app: App) {
  app.component('statusTip', StatusTip)
}
