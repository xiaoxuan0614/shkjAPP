# ReadOnlyTable

移动端只读数据表，适用于计划信息、人员清单等，不承载请求、权限或编辑校验。

- `label`：表格的可访问名称。
- `columns`：`key`、`label`，可选 CSS Grid `width` 与 `align`。
- `rows`：字段键对应列键，建议提供稳定 `key`；可选 `remark` 显示整行备注。
- `minWidth`：宽表最小宽度（如 `500px`），超出容器时横向滚动。
- `emptyText`：无数据文案，默认“暂无记录”。空值显示 `—`，数字 0 保留。
- `cell` 插槽：接收 `row`、`column`、`index`，用于自定义只读内容。
- `footer` 插槽：容纳页面提供的分页控件。分页状态、请求与筛选由页面负责，组件不自行截取数据。

```vue
<ReadOnlyTable label="用料清单" :columns="[
  { key: 'name', label: '物料', width: 'minmax(120px, 2fr)' },
  { key: 'quantity', label: '数量', align: 'right' },
]" :rows="materials" min-width="320px" />
```

当前接入：PlanApprovalPopup 的用料、人员及外协、回款、工序计划；项目详情通过 readonly 模式共用。
