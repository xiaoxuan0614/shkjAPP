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

const requireDirectorySuccess = <T>(response: IResData<T>) => {
  if (response?.success !== true || ![0, 200].includes(Number(response?.code)))
    throw new Error(response?.message || '人员目录查询失败，请重试')
  return response
}

export const contractApprovalApi = {
  detail: async (periodId: string) => {
    const response = await http.get('/project/contract/queryById', { periodId })
    if (response?.success !== true || ![0, 200].includes(Number(response.code)))
      throw new Error(response?.message || '合同详情读取失败')
    return response
  },
  managerRoleId: async () => {
    const response = requireDirectorySuccess(await http.get<any>('/sys/role/list', {
      roleCode: 'project_management', pageNo: 1, pageSize: 100,
    }))
    const result = response.result
    const rows = Array.isArray(result) ? result : result?.records
    if (!Array.isArray(rows)) throw new Error('项目经理角色列表返回异常，请重试')
    const roles = rows.filter(
      (role: any) => String(role.roleCode || '').trim() === 'project_management' && role.id,
    )
    if (roles.length !== 1) throw new Error('未能确认项目经理角色，请检查角色配置')
    return String(roles[0].id)
  },
  users: async (params: Record<string, any>) => {
    if (!params.roleId) throw new Error('缺少项目经理角色，无法查询')
    return requireDirectorySuccess(await http.get('/sys/user/userRoleList', params))
  },
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
