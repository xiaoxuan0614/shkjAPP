import { http } from "@/utils/http";
import { projectApi, unwrapRecords } from "@/service/shkj";
import { reworkApi } from "./projectRework";
import { readProjectMembership } from "./projectMembership";
import {
  hasActiveRecheck,
  hasBlockingRework,
  isCurrentFailedAcceptance,
} from "@/utils/acceptanceWorkflow";
export type AcceptanceType = "INTERNAL" | "CUSTOMER";
export const acceptanceApi = {
  latestStatus: (periodId: string) => http.get('/project/acceptance/latestStatus', { periodId }),
  detail: (id: string) => http.get('/project/acceptance/queryById', { id }),
  list: (periodId: string, acceptType: AcceptanceType, pageNo: number) =>
    http.get("/project/acceptance/list", {
      periodId,
      acceptType,
      pageNo,
      pageSize: 100,
    }),
  complete: (data: Record<string, any>) =>
    http.post("/project/acceptance/complete", data),
  apply: (data: { periodId: string; acceptTypes: AcceptanceType[]; reason: string; applyMode: 'NORMAL' | 'WITHOUT_RECTIFICATION' }) =>
    http.post("/project/acceptance/apply", data),
};
export async function readAcceptanceRecords(
  periodId: string,
  type: AcceptanceType,
) {
  const all: any[] = [];
  for (let pageNo = 1; ; pageNo++) {
    const response: any = await acceptanceApi.list(periodId, type, pageNo);
    if (
      !Array.isArray(response?.result) &&
      !Array.isArray(response?.result?.records)
    )
      throw new Error("验收记录响应异常");
    const rows = unwrapRecords(response);
    all.push(
      ...rows.filter(
        (row) =>
          row.id &&
          String(row.periodId) === periodId &&
          String(row.acceptType).toUpperCase() === type,
      ),
    );
    const total = response?.result?.total;
    if (
      Array.isArray(response?.result) ||
      !rows.length ||
      (total != null ? pageNo * 100 >= Number(total) : rows.length < 100)
    )
      break;
  }
  return all.sort((a, b) =>
    String(b.createTime || "").localeCompare(String(a.createTime || "")),
  );
}
export function currentAcceptance(rows: any[], _reworkId: string) {
  // 保留调用签名；各类型独立取最新记录，不以分期旧轮次过滤。
  const superseded = new Set(rows.map((row) => String(row.sourceAcceptanceId || '')));
  return [...rows]
    .sort((a, b) => String(b.createTime || b.updateTime || '').localeCompare(String(a.createTime || a.updateTime || '')))
    .find((row) => row?.id && !superseded.has(String(row.id)));
}
export async function readAcceptanceContext(periodId: string) {
  const response: any = await projectApi.detail(periodId);
  if (!response?.result) throw new Error("项目详情加载失败");
  return response.result;
}

export async function readAcceptanceReworks(periodId: string) {
  const all: any[] = [];
  for (let pageNo = 1; ; pageNo++) {
    const response: any = await reworkApi.list(periodId, pageNo);
    const result = response?.result;
    const rows = Array.isArray(result) ? result : result?.records;
    if (!Array.isArray(rows)) throw new Error("返工记录响应异常，请刷新重试");
    all.push(...rows);
    if (
      Array.isArray(result) ||
      !rows.length ||
      (result.total != null
        ? all.length >= Number(result.total)
        : rows.length < 20)
    )
      return all;
  }
}

export async function assertAcceptanceApplication(
  periodId: string,
  userId: string,
  sourceId: string,
  mode: "recheck" | "rework",
  excludeReworkId = "",
) {
  const [project, access, internal, customer, reworks] = await Promise.all([
    readAcceptanceContext(periodId),
    readProjectMembership(periodId, userId),
    readAcceptanceRecords(periodId, "INTERNAL"),
    readAcceptanceRecords(periodId, "CUSTOMER"),
    readAcceptanceReworks(periodId),
  ]);
  const round = String(project.currentReworkId || "");
  const current = [
    currentAcceptance(internal, round),
    currentAcceptance(customer, round),
  ].filter(Boolean);
  const source = current.find((row) => String(row.id) === sourceId);
  if (
    String(project.periodStatus ?? project.status).toUpperCase() !==
      "ACCEPTING" ||
    !access.manager ||
    !isCurrentFailedAcceptance(source, current)
  )
    throw new Error("验收状态或项目经理资格已变化，请刷新后重试");
  if (hasBlockingRework(reworks, round, excludeReworkId))
    throw new Error("当前轮已有施工返工申请，请先办理返工记录");
  if (mode === "rework" && hasActiveRecheck(current))
    throw new Error("当前轮复验进行中，暂不能申请施工返工");
  if (
    mode === "rework" &&
    reworks.some(
      (row) =>
        String(row.id) !== excludeReworkId &&
        String(row.sourceAcceptanceId) === sourceId,
    )
  )
    throw new Error("该验收已有返工申请，请在原返工单中修改或重提");
}
