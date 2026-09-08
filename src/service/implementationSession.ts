export type ImplementationSessionStatus = 'CHECKED_IN' | 'LOG_DRAFT' | 'LOG_SUBMITTED' | 'COMPLETED'

export interface LocalImplementationSession {
  periodId: string
  project?: any
  processId: string
  status: ImplementationSessionStatus
  checkInTime: string
  checkInLocation?: any
  checkOutTime?: string
  checkOutLocation?: any
  checkOutLocationStatus?: string
  abnormalReason?: string
  logStep?: number
  logData?: any
  sgNo?: string
  duration?: string
}

const STORAGE_KEY = 'shkj:implementation:active-session'

export const readImplementationSession = (): LocalImplementationSession | null => {
  try {
    const session = uni.getStorageSync(STORAGE_KEY)
    if (!session) return null
    return {
      ...session,
      periodId: session.periodId || session.projectId,
    }
  } catch (error) {
    return null
  }
}

export const writeImplementationSession = (session: LocalImplementationSession) => {
  uni.setStorageSync(STORAGE_KEY, session)
  return session
}

export const clearImplementationSession = () => uni.removeStorageSync(STORAGE_KEY)
