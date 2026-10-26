/** 还料不受计划审批结果变化影响，关闭后仍允许处理实际待还物料。 */
export const canReturnAtStage = (status: unknown) => [
  'PREPARING', 'PENDING_APPROVAL', 'IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED',
  'IMPLEMENT_COMPLETED', 'PENDING_ACCEPT', 'INTERNAL_ACCEPTING', 'ACCEPTING',
  'REACCEPTING', 'FAILED', 'REWORKING', 'WARRANTY', 'COMPLETED', 'CLOSED',
].includes(String(status ?? '').trim().toUpperCase())
