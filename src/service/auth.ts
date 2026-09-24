import { http } from '@/utils/http'

export const authApi = {
  login: (data: Record<string, any>) => http.post('/sys/login', data),
  phoneLogin: (mobile: string, captcha: string) =>
    http.post('/sys/phoneLogin', { mobile, captcha }),
  sendLoginSms: (mobile: string) => http.post('/sys/sms', { mobile, smsmode: '0' }),
  updatePassword: (params: Record<string, any>) =>
    http({ url: '/sys/user/updatePassword', query: params, method: 'PUT' }),
  logout: () => http.get('/sys/logout'),
}
