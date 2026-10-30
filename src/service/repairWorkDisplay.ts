/** Apifox /repair/work/page: clockAbnormal is not a location-range verdict. */
export function repairClockDisplay(record: Record<string, any>) {
  const corrected = record.signOutStatus === 'CORRECTED'
  return {
    corrected,
    signInAbnormal: record.signInStatus === 'MISSING',
    signOutAbnormal: !corrected && record.signOutStatus === 'MISSING',
    signInName: record.signInStatusName || ({ NORMAL:'已签到', MISSING:'签到缺卡', UNKNOWN:'签到信息不完整' } as Record<string,string>)[record.signInStatus] || '签到状态未记录',
    signOutName: record.signOutStatusName || ({ NORMAL:'已签退', NOT_SIGNED_OUT:'未签退', CORRECTED:'已补签退', MISSING:'签退缺卡', UNKNOWN:'签退信息不完整' } as Record<string,string>)[record.signOutStatus] || '签退状态未记录',
    correctionDescription: corrected ? record.correctionDescription || record.correctionReason || '补签退说明未记录' : '',
    // Aggregate reasons can cover both ends; never attach them to just one location.
    generalReason: record.clockAbnormal === true ? record.clockAbnormalReason || '' : '',
  }
}

export function repairCompletionSubmitted(detail: Record<string, any> = {}) {
  return ['COMPLETED','CLOSED'].includes(detail.order?.workStatus)
    || (detail.completions || []).length > 0
    || (detail.applications || []).some((a:any) => a.applicationType === 'COMPLETION' && a.applicationStatus && a.applicationStatus !== 'DRAFT')
}
