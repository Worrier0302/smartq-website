# Smart Q — 装修工程业务管理系统

Smart HQME Solution Enterprise 内部系统：报价 → 发票 → 收据 → 送货单 → 采购单，
含判包成本加成、按判包商拆 PO、收款追踪、PDF 生成。

## 技术栈

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth + RLS) ·
`@react-pdf/renderer` · 部署 Vercel。

## 本地运行

```bash
npm install
cp .env.local.example .env.local   # 填入 Supabase URL + anon key
npm run dev                        # http://localhost:3000
```

## 目录

| 路径 | 说明 |
|---|---|
| `/` | 仪表板（成交/待收/进行中/毛利 + 最近单据 + DLP 提醒）|
| `/documents` · `/documents/[id]` | 单据列表与详情（流转、收款、PDF、PO WhatsApp）|
| `/quote/new` | 开新报价（可编辑 section + 实时预览）|
| `/markup` | 判包成本 → 加成工作台 + 拆 PO（owner）|
| `/clients` · `/subcontractors` | 资料库 |
| `/settings/terms` | 条款默认模板（owner）|
| `/api/pdf/[docId]` | 服务端 PDF 生成 |

## 权限

- `owner`：看全部（含成本、加成、利润、判包商、PO）
- `staff`：能开单填资料，但**数据库层面**看不到成本/加成/判包商/PO（RLS + 安全视图强制）

## 数据库

完整 SQL 在 `supabase/schema.sql`，可直接贴进 Supabase SQL Editor 运行。

## 部署

见 `DEPLOY.md`。
