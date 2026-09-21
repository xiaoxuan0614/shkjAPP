import { http } from "@/utils/http";

export type TodoScope = "ASSIGNED" | "CLAIMABLE";

export interface TodoQuery {
  pageNo?: number;
  pageSize?: number;
  scope?: TodoScope;
  todoType?: string;
}

export interface TodoRecord {
  id?: string;
  todoType?: string;
  bizModule?: string;
  bizId?: string;
  bizSubId?: string;
  projectName?: string;
  periodName?: string;
  title?: string;
  summary?: string;
  createBy?: string;
  applyUserName?: string | null;
  realName?: string | null;
  scope?: TodoScope;
  todoStatus?: string;
  priority?: number;
  dueTime?: string;
  actionKey?: string;
  actionParams?: string | Record<string, any>;
  createTime?: string;
  [key: string]: any;
}

export interface TodoPage {
  records: TodoRecord[];
  total: number;
}

interface TodoTypeMeta {
  text: string;
}

export const TODO_TYPE_DICT_CODE = "todo_type";

const TODO_TYPE_FALLBACKS: Record<string, TodoTypeMeta> = {
  PROJECT_MEMBER_INVITATION: { text: "项目成员邀请" },
  PROJECT_PLAN_APPROVAL: { text: "项目计划方案审批" },
  PROJECT_PERIOD_APPROVAL: { text: "项目计划方案审批" },
  PROJECT_CONTRACT_APPROVAL: { text: "项目合同审批" },
  PROJECT_MATERIAL_APPLY_APPROVAL: { text: "项目用料申请审批" },
  PROJECT_DELAY_APPROVAL: { text: "项目延期审批" },
  PROJECT_REWORK_APPROVAL: { text: "项目返工审批" },
  PROJECT_ACCEPTANCE_FAILED: { text: "验收驳回提醒" },
  PROJECT_ACCEPTANCE_FAILED_HANDLE: { text: "验收驳回提醒" },
  PROJECT_ACCEPTANCE_PENDING: { text: "待验收" },
  STOCK_IN_APPROVAL: { text: "入库申请审批" },
  STOCK_IN_EXECUTE: { text: "入库执行待办，等待库管入库" },
  STOCK_OUT_APPROVAL: { text: "出库申请审批" },
  STOCK_OUT_EXECUTE: { text: "出库执行待办，等待库管出库" },
};

let todoTypeMap: Record<string, TodoTypeMeta> = {};
let todoTypeDictLoaded = false;
let pendingTodoTypeDict: Promise<void> | null = null;

export interface ProjectInvitationRecord {
  id?: string;
  periodId?: string;
  userId?: string;
  userName?: string;
  memberRole?: string | number;
  memberRole_dictText?: string;
  inviteStatus?: string | number;
  inviteTime?: string;
  acceptTime?: string;
  remark?: string;
  projectManagerUserName?: string;
  projectManagerName?: string;
  [key: string]: any;
}

export const todoApi = {
  page: (query: TodoQuery = {}) =>
    http.get("/sys/todo/page", { pageNo: 1, pageSize: 100, ...query }),
};

export const loadTodoTypeDictionary = async () => {
  if (todoTypeDictLoaded) return;
  if (pendingTodoTypeDict) return pendingTodoTypeDict;

  pendingTodoTypeDict = (async () => {
    try {
      const response: any = await http.get(
        `/sys/dict/getDictItems/${TODO_TYPE_DICT_CODE}`,
      );
      const rows = Array.isArray(response?.result)
        ? response.result
        : Array.isArray(response)
          ? response
          : [];
      const configured = Object.fromEntries(
        rows.flatMap((row: any) => {
          const value = String(row.value ?? "").trim();
          const text = String(row.text ?? row.label ?? "").trim();
          return value && text ? [[value, { text }]] : [];
        }),
      );
      todoTypeMap = configured;
      todoTypeDictLoaded = true;
    } catch {
      todoTypeMap = {};
    } finally {
      pendingTodoTypeDict = null;
    }
  })();

  return pendingTodoTypeDict;
};

export const todoTypeText = (type: unknown) => {
  const value = String(type ?? "").trim();
  return (
    todoTypeMap[value]?.text ||
    TODO_TYPE_FALLBACKS[value]?.text ||
    value ||
    "业务待办"
  );
};

export const projectInvitationApi = {
  list: (query: { pageNo?: number; pageSize?: number } = {}) =>
    http.get("/project/member/myInvitations", {
      pageNo: 1,
      pageSize: 100,
      ...query,
    }),
  respond: (memberId: string, inviteStatus: "0" | "1") =>
    http.post("/project/member/respond", { memberId, inviteStatus }),
};

export const unwrapTodoPage = (response: any): TodoPage => {
  const result = response?.result ?? response;
  const records = Array.isArray(result)
    ? result
    : Array.isArray(result?.records)
      ? result.records
      : [];
  const rawTotal = Array.isArray(result) ? result.length : result?.total;
  const total = Number(rawTotal);

  return {
    records,
    total: Number.isFinite(total) ? total : records.length,
  };
};

export const parseTodoActionParams = (value: TodoRecord["actionParams"]) => {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value.trim()) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
};

export const isPlanApprovalTodo = (item: TodoRecord) =>
  [item.todoType, item.actionKey].some((value) =>
    ["PROJECT_PLAN_APPROVAL", "PROJECT_PERIOD_APPROVAL"].includes(
      String(value || "").trim().toUpperCase(),
    ),
  );

export const isStockOutExecuteTodo = (item: TodoRecord) =>
  [item.actionKey, item.todoType].some(
    (value) => String(value || '').trim().toUpperCase() === 'STOCK_OUT_EXECUTE',
  );

// 与 PC 待办一致：申请 ID 由 actionParams.applyId 提供，不猜测业务主/子 ID。
export const resolveStockTodoApplyId = (item: TodoRecord) => {
  const value = parseTodoActionParams(item.actionParams).applyId;
  if (typeof value === 'string') return value.trim();
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? String(value) : '';
};

export const resolvePlanApprovalPeriodId = (item: TodoRecord) => {
  const params = parseTodoActionParams(item.actionParams);
  const isPeriodApproval = [item.todoType, item.actionKey].some(
    (value) => String(value || "").trim().toUpperCase() === "PROJECT_PERIOD_APPROVAL",
  );
  return String(
    item.bizSubId || params.periodId || params.projectPeriodId || item.periodId ||
    (isPeriodApproval ? item.bizId : "") || "",
  ).trim();
};
