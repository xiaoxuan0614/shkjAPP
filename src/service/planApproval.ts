import { http } from "@/utils/http";

export const planResult = (response: any) => response?.result ?? response;

// 审批必须读取完整清单，不能把第一页误认为整个计划。
export async function planList(url: string, periodId: string) {
  const records: any[] = [];
  const seen = new Set<string>();
  for (let pageNo = 1; pageNo <= 1000; pageNo++) {
    const result = planResult(
      await http.get(url, { periodId, pageNo, pageSize: 100 }),
    );
    const rows = Array.isArray(result) ? result : result?.records;
    if (!Array.isArray(rows)) throw new Error("计划清单响应格式异常");
    const fingerprint = JSON.stringify(rows);
    if (rows.length && seen.has(fingerprint))
      throw new Error("计划分页重复，请刷新后重试");
    seen.add(fingerprint);
    records.push(...rows);
    if (
      Array.isArray(result) ||
      (result.total != null
        ? records.length >= Number(result.total)
        : rows.length < 100)
    )
      return records;
    if (!rows.length) throw new Error("计划清单未完整返回");
  }
  throw new Error("计划清单过大，请在 PC 端核对");
}

export const planApprovalApi = {
  context: async (periodId: string) => {
    const result: any = planResult(
      await http.get("/project/project/projectPeriodDetail", { periodId }),
    );
    if (!result || typeof result !== "object" || !(result.periodStatus ?? result.status))
      throw new Error("项目状态加载失败");
    return { ...result, status: String(result.periodStatus ?? result.status).trim().toUpperCase() };
  },
  decide: (periodId: string, approve: boolean) =>
    http.post("/project/period/status", {
      periodId,
      status: approve ? "IMPLEMENTING" : "PREPARING",
    }),
};
