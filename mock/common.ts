// mock/common.ts —— 登录 / 字典等通用接口
import { ok, CURRENT_USER, proxyPrefix } from './_data'

const token = 'mock-token-shouhui-20260816'

export default [
  // ===== 登录 =====
  {
    url: `${proxyPrefix}/sys/mLogin`,
    method: 'post',
    response: () =>
      ok({
        token,
        userInfo: { ...CURRENT_USER },
      }),
  },
  {
    url: `${proxyPrefix}/sys/phoneLogin`,
    method: 'post',
    response: () =>
      ok({
        token,
        userInfo: { ...CURRENT_USER },
      }),
  },
  {
    url: `${proxyPrefix}/sys/user/appQueryUser`,
    method: 'get',
    response: () => ok([{ id: CURRENT_USER.id, username: CURRENT_USER.username, orgCodeTxt: CURRENT_USER.orgCodeTxt }]),
  },
]
