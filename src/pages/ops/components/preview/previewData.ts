/** UI-only fixtures. Never pass these IDs to business APIs or persistent storage. */
export type RepairMode = "offline" | "online";
export type OrderStatus =
  | "未开始"
  | "进行中"
  | "待审批"
  | "待确认"
  | "待评价"
  | "已完结"
  | "已关闭";
export interface PreviewLog {
  description: string;
  result: string;
  reason: string;
  photos: string[];
  vehicle: string;
  people: string[];
  materials: { name: string; qty: number; unit: string }[];
  outsource?: string;
  outsourceCount?: string;
  outsourceHours?: string;
  faultPosition?: string;
  quote?: string;
}
export interface PreviewOrder {
  id: string;
  customer: string;
  equipment: string;
  fault: string;
  mode: RepairMode;
  status: OrderStatus;
  contact: string;
  phone: string;
  address: string;
  nature: string;
  owner: string;
  appointment: string;
  returnState: "无需还料" | "待申请" | "待库管入库" | "已入库";
  logs: PreviewLog[];
  events: string[];
  assistance?: {
    requested: boolean;
    types: string[];
    people: string[];
    outsource: string;
    count: string;
    hours: string;
  };
  costs?: { labor: number; material: number };
  transfer?: {
    to: string;
    reason: string;
    status: "待接收" | "已接收" | "已驳回" | "已撤回";
  };
}
export interface PreviewFormData {
  customer: string;
  address: string;
  contact: string;
  phone: string;
  nature: string;
  equipment: string;
  fault: string;
  faultPosition: string;
  faultDate: string;
  faultTime: string;
  date: string;
  time: string;
  assistance: boolean;
  assistTypes: string[];
  people: string[];
  outsource: string;
  outsourceCount: string;
  outsourceHours: string;
  result: string;
  description: string;
  reason: string;
  photos: string[];
  quote: string;
  vehicle: string;
  materials: {
    name: string;
    model: string;
    qty: number;
    available: number;
    unit: string;
  }[];
}
export const peopleOptions = [
  "运维甲（示例）",
  "运维乙（示例）",
  "运维丙（示例）",
];
export const materialOptions = [
  { name: "铅封机显示屏", model: "V8", available: 2, unit: "台", qty: 0 },
  { name: "工业电源", model: "24V / 5A", available: 4, unit: "个", qty: 0 },
  { name: "网线", model: "六类", available: 30, unit: "m", qty: 0 },
];
export function createOrders(): PreviewOrder[] {
  const statuses: OrderStatus[] = [
    "未开始",
    "进行中",
    "待审批",
    "待确认",
    "待评价",
    "已完结",
    "已关闭",
  ];
  return statuses.map((status, i) => ({
    id: `DEMO-GZ-00${i + 1}`,
    customer: ["滨海堆场（示例）", "港区物流（示例）", "智慧园区（示例）"][
      i % 3
    ],
    equipment: i % 2 ? "闸口软件" : "铅封机",
    fault:
      i % 2
        ? "车辆识别后，通行记录未同步。"
        : "显示屏间歇黑屏，需检查供电和连接线路。",
    mode: i === 3 || i === 5 ? "online" : "offline",
    status,
    contact: "客户联系人（示例）",
    phone: "未填写",
    address: "示例园区 · 一号作业区",
    nature: "全包",
    owner: "当前操作人（示例）",
    appointment: "2026-09-24 14:00",
    returnState: i === 1 ? "待申请" : "无需还料",
    logs:
      i > 1 && i < 6
        ? [
            {
              description: "检查连接线路并完成设备联调，设备运行正常。",
              result: "维修完成",
              reason: "",
              photos: [],
              vehicle: "",
              people: [],
              materials: [],
            },
          ]
        : [],
    events: ["09-24 09:00 · 创建工单（示例）"],
  }));
}
export function createReports() {
  return [
    {
      id: "DEMO-BX-001",
      customer: "滨海堆场（示例）",
      equipment: "铅封机",
      fault: "显示屏间歇黑屏，影响现场作业。",
      time: "09-24 09:20",
      status: "未处理",
      reason: "",
    },
    {
      id: "DEMO-BX-002",
      customer: "港区物流（示例）",
      equipment: "闸口软件",
      fault: "车辆通行记录未同步，请协助检查。",
      time: "09-24 08:45",
      status: "未处理",
      reason: "",
    },
    {
      id: "DEMO-BX-003",
      customer: "智慧园区（示例）",
      equipment: "车牌摄像头",
      fault: "抓拍画面模糊。",
      time: "09-23 15:10",
      status: "已接单",
      reason: "",
    },
    {
      id: "DEMO-BX-004",
      customer: "滨海堆场（示例）",
      equipment: "道闸",
      fault: "重复提交的报修。",
      time: "09-23 10:00",
      status: "已驳回",
      reason: "同一故障已有工单跟进（示例）",
    },
  ];
}
