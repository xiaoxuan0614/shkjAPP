import dayjs from 'dayjs'
import { assessReport, finishSurvey, submitQuote, confirmQuote, assignDemoDuty, type IntakeReport } from './intakeFlow'

/** In-memory demo records only; never submit these IDs to business APIs. */
export function createIntakeFixtures(applicantId: string): IntakeReport[] {
  return Array.from({ length: 8 }, (_, index) => {
    const time = dayjs().subtract(index, 'day').hour(9).minute(30).format('YYYY-MM-DD HH:mm')
    const report: IntakeReport = {
      id: `DEMO-BX-SEED-${index + 1}`, customerId: 'DEMO-C-1', customer: '滨海堆场（示例）',
      projectId: 'DEMO-P-1', projectName: '闸口设备维护（示例）', equipment: '铅封机',
      contact: '客户联系人（示例）', phone: '未填写', address: '示例园区 · 一号作业区',
      fault: ['显示屏间歇黑屏，重启后仍出现。', '设备启动时有异响，需要现场排查。', '供电不稳定，需更换电源模块。', '识别结果未同步到管理系统。'][index % 4],
      reportedAt: time.slice(0, 10), createdAt: time, remark: '客户现场白天可联系，请提前预约（示例）。',
      applicantId, applicant: '报修人员（示例）', stage: '待受理', handling: '', surveyor: '', survey: '',
      quoteId: '', items: [], quoteReason: '', quoteConfirmed: false, owner: '', mode: 'offline', orderId: '',
      events: [`${time} 提交报修（示例）`],
    }
    assignDemoDuty(report)
    if (index === 0) return report
    if (index === 7) { assessReport(report, false, false, '操作设置问题，已指导恢复（示例）。'); return report }
    assessReport(report, true, index !== 4 && index !== 6, '确认故障，按维护范围处理（示例）。')
    if (index === 1 || index === 4) return report
    if (index === 6) return report
    finishSurvey(report, report.owner, '现场确认电源故障，需更换后调试（示例）。')
    if (index === 2) return report
    submitQuote(report, [{ name: '电源模块（示例）', qty: 1, price: 280 }, { name: '现场检修服务（示例）', qty: 1, price: 200 }])
    if (index === 5) confirmQuote(report, true, '内部确认通过（示例）')
    return report
  })
}
