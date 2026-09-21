import { defineUniPages } from '@uni-helper/vite-plugin-uni-pages'
import { loadEnv } from 'vite'
import path from 'node:path'

const env = loadEnv(process.env.NODE_ENV || 'development', path.resolve(process.cwd(), 'env'))
// H5 的 tabBar 静态路径不会自动跟随 Vite base，需要显式加部署前缀。
const tabIcon = (name: string) => {
  const asset = `static/tabbar/${name}.png`
  if (process.env.UNI_PLATFORM !== 'h5') return asset
  const base = (env.VITE_APP_PUBLIC_BASE || '/').replace(/\/$/, '')
  return `${base}/${asset}`
}

export default defineUniPages({
  globalStyle: {
    navigationStyle: 'default',
    navigationBarTitleText: 'uniapp',
    navigationBarBackgroundColor: '#176ac7',
    navigationBarTextStyle: 'white',
    backgroundColor: '#f5f6f8',
  },
  easycom: {
    autoscan: true,
    custom: {
      '^wd-(.*)': 'wot-design-uni/components/wd-$1/wd-$1.vue',
      '^(?!z-paging-refresh|z-paging-load-more)z-paging(.*)':
        'z-paging/components/z-paging$1/z-paging$1.vue',
    },
  },
  tabBar: {
    color: '#aaa',
    selectedColor: '#39b54a',
    backgroundColor: '#F8F8F8',
    borderStyle: 'black',
    height: '50px',
    fontSize: '11px',
    iconWidth: '24px',
    spacing: '3px',
    list: [
      {
        iconPath: tabIcon('tabbar-home-2'),
        selectedIconPath: tabIcon('tabbar-home'),
        pagePath: 'pages/home/index',
        text: '首页',
      },
      {
        iconPath: tabIcon('tabbar-user-2'),
        selectedIconPath: tabIcon('tabbar-user'),
        pagePath: 'pages/customer/mine',
        text: '我的',
      },
    ],
  },
})
