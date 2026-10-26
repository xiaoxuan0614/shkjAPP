/** 与领料候选查询共用阶段范围；计划审批结果单独校验。 */
export const PROJECT_PICK_STAGES = [
  'PREPARING', 'IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED',
  'IMPLEMENT_COMPLETED', 'PENDING_ACCEPT', 'INTERNAL_ACCEPTING', 'ACCEPTING',
  'REACCEPTING', 'FAILED', 'REWORKING',
]

export const canPickProjectMaterial = (status: unknown, planStatus: unknown) =>
  String(planStatus) === '1' && PROJECT_PICK_STAGES.includes(String(status ?? '').trim().toUpperCase())
