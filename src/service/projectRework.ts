import { http } from "@/utils/http";

export const reworkApi = {
  list: (periodId: string, pageNo = 1) =>
    http.get("/project/rework/list", { periodId, pageNo, pageSize: 20 }),
  detail: (id: string) => http.get("/project/rework/queryById", { id }),
  submit: (data: any) => http.post("/project/rework/submit", data),
  withdraw: (data: any) => http.post("/project/rework/withdraw", data),
  approve: (data: any) => http.post("/project/rework/approve", data),
};

export async function reworkName(previousReworkId: string, periodId: string) {
  let id = String(previousReworkId || ""),
    round = 1;
  const seen = new Set<string>();
  while (id) {
    if (seen.has(id) || seen.size >= 1000)
      throw new Error("返工轮次链异常，请联系管理员");
    seen.add(id);
    const response: any = await reworkApi.detail(id);
    const row = response?.result;
    if (
      !row ||
      String(row.id) !== id ||
      String(row.periodId) !== periodId ||
      String(row.approvalStatus) !== "1"
    )
      throw new Error("无法确认上一轮返工，请刷新重试");
    round++;
    id = String(row.previousReworkId || "");
  }
  return `第${round}轮返工`;
}
export function reworkPlan(row: any) {
  try {
    const plan =
      typeof row.planJson === "string"
        ? JSON.parse(row.planJson)
        : row.planJson || {};
    return {
      process: Array.isArray(plan.process)
        ? plan.process
        : plan.process
          ? [plan.process]
          : [],
      materials: plan.materials || [],
      outsources: plan.outsources || [],
    };
  } catch {
    throw new Error("返工方案数据异常，请联系管理员核实");
  }
}
