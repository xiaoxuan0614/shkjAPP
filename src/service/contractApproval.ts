import { http } from '@/utils/http'

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

const requireSuccess = <T>(response: IResData<T>) => {
  if (response?.success !== true || Number(response?.code) !== 200)
    throw new Error(response?.message || '合同请求失败，请刷新后确认当前状态')
  return response
}

export const contractApprovalApi = {
  detail: async (periodId: string) =>
    requireSuccess(await http.get('/project/contract/queryById', { periodId })),
  users: (params: Record<string, any>) => http.get('/sys/user/list', params),
  // 当前接口接收 JSON；records 为完整回款计划，未传附件保留旧文件。
  saveManager: async (
    periodId: string,
    manager: ContractManagerOption,
    records: ContractPaymentRecordPayload[],
  ) => requireSuccess(await http.post('/project/contract/editWithPaymentRecords', {
    contract: {
      periodId,
      projectManagerUserId: manager.id,
      projectManagerUserName: manager.name,
    },
    records,
  })),
  decide: async (periodId: string, status: '0' | '1', approvalReason?: string) =>
    requireSuccess(await http.post('/project/contract/status', {
      periodId,
      status,
      approvalReason: status === '0' ? approvalReason : '',
    })),
}
