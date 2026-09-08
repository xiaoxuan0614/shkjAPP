import { http } from '@/utils/http'
import { useUserStore } from '@/store/user'
import signMd5Utils from '@/utils/signMd5Utils'
import { isH5 } from '@/utils/platform'

export interface ContractManagerOption {
  id: string
  name: string
  username?: string
}

export interface ContractPaymentRecordPayload {
  id?: string
  paymentNode: string
  ratio: number
  plannedAmount: number
  actualAmount?: number | null
  remark?: string | null
  plannedDate?: string | null
  paymentDate?: string | null
  invoiceStatus?: string | null
  payStatus?: string | null
  payMethod?: string | null
  rollbackTime?: number | null
}

const multipartRequest = <T>(url: string, value: Record<string, any>) => {
  const userStore = useUserStore()
  const boundary = `----shkj-contract-${Date.now()}-${Math.random().toString(16).slice(2)}`
  // uni.request 会把普通对象按 JSON 发送；这里手工构造与 FormData.append('data', json) 一致的文本分片，兼容 H5 与小程序。
  const data = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="data"',
    '',
    JSON.stringify(value),
    `--${boundary}--`,
    '',
  ].join('\r\n')
  const sign = signMd5Utils.getSign(url, {})
  let requestUrl = url
  if (
    JSON.parse(import.meta.env.VITE_APP_PROXY) &&
    isH5 &&
    import.meta.env.MODE === 'development'
  ) {
    requestUrl = import.meta.env.VITE_APP_PROXY_PREFIX + requestUrl
  }

  return new Promise<IResData<T>>((resolve, reject) => {
    uni.request({
      url: requestUrl,
      method: 'POST',
      data,
      dataType: 'json',
      header: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'X-Access-Token': userStore.userInfo.token,
        'X-Tenant-Id': userStore.userInfo.tenantId,
        'X-Sign': sign,
        'V-Sign': signMd5Utils.getVSign(undefined, sign),
        'X-TIMESTAMP': signMd5Utils.getTimestamp(),
        'X-Version': 'v3',
      },
      success(response) {
        let result: any = response.data
        if (typeof result === 'string') {
          try {
            result = JSON.parse(result)
          } catch {
            // 非 JSON 响应继续按 HTTP 状态码处理。
          }
        }
        const hasBusinessCode = result && typeof result === 'object' && Reflect.has(result, 'code')
        const businessCode = Number(result?.code)
        const businessSuccess = !hasBusinessCode || businessCode === 0 || businessCode === 200
        if (response.statusCode >= 200 && response.statusCode < 300 && businessSuccess) {
          resolve(result)
          return
        }
        if (response.statusCode === 401 || businessCode === 401) {
          userStore.clearUserInfo()
          uni.navigateTo({ url: '/pages/login/login' })
        }
        const message = result?.message || (result as any)?.msg || '请求失败'
        uni.showToast({ icon: 'none', title: message })
        reject(new Error(message))
      },
      fail(error) {
        uni.showToast({ icon: 'none', title: '网络错误，换个网络试试' })
        reject(error)
      },
    })
  })
}

export const contractApprovalApi = {
  detail: (periodId: string) => http.get('/project/contract/queryById', { periodId }),
  users: (params: Record<string, any>) => http.get('/sys/user/list', params),
  saveManager: (
    periodId: string,
    manager: ContractManagerOption,
    records: ContractPaymentRecordPayload[],
  ) =>
    multipartRequest('/project/contract/editWithPaymentRecords', {
      contract: {
        periodId,
        projectManagerUserId: manager.id,
        projectManagerUserName: manager.name,
      },
      records,
    }),
  decide: (periodId: string, status: '0' | '1', approvalReason?: string) =>
    http.post('/project/contract/status', {
      periodId,
      status,
      approvalReason: status === '0' ? approvalReason : '',
    }),
  startPreparing: (periodId: string) =>
    http.post('/project/period/status', { periodId, status: 'PREPARING' }),
}
