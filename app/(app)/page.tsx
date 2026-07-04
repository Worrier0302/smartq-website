"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { Btn } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { rm } from "@/lib/format";
import { DOC_META, DocType, STATUS_LABEL } from "@/lib/docmeta";
import type { Role } from "@/lib/types";

// 工种保固月数（默认 6，油漆 3）
function warrantyMonths(trade: string | null | undefined) {
  if (trade && /油漆|paint/i.test(trade)) return 3;
  return 6;
}

type Stats = {
  monthClosed: number;
  outstanding: number;
  activeProjects: number;
  monthMargin: number;
};

type RecentDoc = {
  id: string;
  doc_no: string;
  type: DocType;
  status: string;
  client: string;
  project: string;
  amount: number;
};

type DlpRow = {
  project: string;
  completion: string;
  expiry: string;
  daysLeft: number;
};

export default function DashboardPage() {
  const configured = isSupabaseConfigured();
  const [role, setRole] = useState<Role>("owner");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    monthClosed: 0,
    outstanding: 0,
    activeProjects: 0,
    monthMargin: 0,
  });
  const [recent, setRecent] = useState<RecentDoc[]>([]);
  const [dlp, setDlp] = useState<DlpRow[]>([]);

  const load = useCallback(async () => {
    if (!configured) return setLoading(false);
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let r: Role = "owner";
    if (user) {
      const { data: p } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      r = (p?.role as Role) ?? "staff";
    }
    setRole(r);

    const { data: docsRaw } = await supabase
      .from("documents")
      .select(
        "id, doc_no, type, status, issue_date, created_at, discount, project:projects(name, client:clients(name))"
      )
      .order("created_at", { ascending: false });
    const docs = (docsRaw ?? []) as unknown as {
      id: string;
      doc_no: string;
      type: DocType;
      status: string;
      issue_date: string;
      created_at: string;
      discount: number;
      project: { name: string; client: { name: string } | null } | null;
    }[];
    const ids = docs.map((d) => d.id);

    // client totals + cost totals
    const clientTotals = new Map<string, number>();
    const costTotals = new Map<string, number>();
    if (ids.length) {
      const { data: cf } = await supabase
        .from("line_items_staff")
        .select("document_id, client_price")
        .in("document_id", ids);
      (cf ?? []).forEach((l) =>
        clientTotals.set(
          l.document_id,
          (clientTotals.get(l.document_id) ?? 0) + (Number(l.client_price) || 0)
        )
      );
      if (r === "owner") {
        const { data: base } = await supabase
          .from("line_items")
          .select("document_id, cost")
          .in("document_id", ids);
        (base ?? []).forEach((l) =>
          costTotals.set(
            l.document_id,
            (costTotals.get(l.document_id) ?? 0) + (Number(l.cost) || 0)
          )
        );
      }
    }

    // payments
    const paidByDoc = new Map<string, number>();
    let monthPayments = 0;
    const now = new Date();
    const inThisMonth = (iso: string) => {
      const d = new Date(iso);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      );
    };
    const { data: pays } = await supabase
      .from("payments")
      .select("document_id, amount, paid_at");
    (pays ?? []).forEach((p) => {
      if (p.document_id)
        paidByDoc.set(
          p.document_id,
          (paidByDoc.get(p.document_id) ?? 0) + (Number(p.amount) || 0)
        );
      if (p.paid_at && inThisMonth(p.paid_at))
        monthPayments += Number(p.amount) || 0;
    });

    // stats
    let monthClosed = 0;
    let monthMargin = 0;
    let outstanding = 0;
    docs.forEach((d) => {
      const grand =
        (clientTotals.get(d.id) ?? 0) - (Number(d.discount) || 0);
      if (d.type === "invoice") {
        const paid = paidByDoc.get(d.id) ?? 0;
        const bal = grand - paid;
        if (bal > 0) outstanding += bal;
        if (inThisMonth(d.created_at)) {
          monthClosed += grand;
          monthMargin += grand - (costTotals.get(d.id) ?? 0);
        }
      }
    });

    // active projects + DLP
    const { data: projs } = await supabase
      .from("projects")
      .select("name, status, completion_date");
    const activeProjects = (projs ?? []).filter((p) =>
      ["confirmed", "in_progress"].includes(p.status)
    ).length;

    const dlpRows: DlpRow[] = [];
    (projs ?? []).forEach((p) => {
      if (!p.completion_date) return;
      const comp = new Date(p.completion_date);
      const exp = new Date(comp);
      exp.setMonth(exp.getMonth() + warrantyMonths(null));
      const daysLeft = Math.round((exp.getTime() - now.getTime()) / 864e5);
      if (daysLeft > -365)
        dlpRows.push({
          project: p.name,
          completion: comp.toLocaleDateString("en-GB"),
          expiry: exp.toLocaleDateString("en-GB"),
          daysLeft,
        });
    });
    dlpRows.sort((a, b) => a.daysLeft - b.daysLeft);

    setStats({
      monthClosed: monthClosed || monthPayments,
      outstanding,
      activeProjects,
      monthMargin,
    });
    setRecent(
      docs.slice(0, 6).map((d) => ({
        id: d.id,
        doc_no: d.doc_no,
        type: d.type,
        status: d.status,
        client: d.project?.client?.name ?? "—",
        project: d.project?.name ?? "—",
        amount:
          (clientTotals.get(d.id) ?? costTotals.get(d.id) ?? 0) -
          (d.type === "purchase_order" ? 0 : Number(d.discount) || 0),
      }))
    );
    setDlp(dlpRows);
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = [
    { lbl: "本月已成交", val: rm(stats.monthClosed), accent: "bg-forest" },
    { lbl: "待收款 Outstanding", val: rm(stats.outstanding), accent: "bg-amber" },
    {
      lbl: "进行中项目",
      val: `${stats.activeProjects} 个`,
      accent: "bg-moss",
    },
    {
      lbl: "本月毛利 Margin",
      val: rm(stats.monthMargin),
      accent: "bg-forest",
      ownerOnly: true,
    },
  ];

  return (
    <>
      <Topbar crumb="DASHBOARD" title="仪表板">
        <Link href="/quote/new">
          <Btn variant="amber">+ 开新报价</Btn>
        </Link>
      </Topbar>

      <div className="px-[30px] pt-[26px] pb-[60px]">
        {!configured && (
          <div className="mb-5 rounded-xl bg-amber-soft border border-amber/40 px-5 py-4 text-[13px] text-[#a8681e]">
            未连接 Supabase。
          </div>
        )}

        {/* stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-[26px] max-[1100px]:grid-cols-2">
          {cards.map((c) => {
            if (c.ownerOnly && role !== "owner") return null;
            return (
              <div
                key={c.lbl}
                className="relative overflow-hidden bg-card border border-line rounded-xl p-[18px] shadow-card"
              >
                <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${c.accent}`} />
                {c.ownerOnly && (
                  <span className="absolute top-3.5 right-3.5 font-mono text-[8.5px] bg-amber-soft text-amber px-1.5 py-0.5 rounded tracking-wide">
                    OWNER
                  </span>
                )}
                <div className="font-mono text-[10px] tracking-[1px] uppercase text-moss mb-2.5">
                  {c.lbl}
                </div>
                <div className="font-sans font-extrabold text-[27px] tracking-tight leading-none">
                  {loading ? "…" : c.val}
                </div>
              </div>
            );
          })}
        </div>

        {/* recent docs */}
        <div className="flex items-center justify-between mt-[30px] mb-3.5">
          <h2 className="font-sans font-bold text-base flex items-center gap-2">
            最近单据
            <span className="font-mono text-[11px] text-amber border border-line px-1.5 py-0.5 rounded">
              近期
            </span>
          </h2>
          <Link href="/documents">
            <Btn>查看全部 →</Btn>
          </Link>
        </div>
        <div className="bg-card border border-line rounded-xl overflow-hidden shadow-card">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {["单号", "类型", "客户 / 项目", "金额", "状态"].map((h) => (
                  <th
                    key={h}
                    className="font-mono text-[10px] tracking-wide uppercase text-moss text-left px-4 py-3 bg-paper-2 border-b border-line font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-[#9a938a]">
                    加载中…
                  </td>
                </tr>
              ) : recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-[#9a938a]">
                    还没有单据。
                  </td>
                </tr>
              ) : (
                recent.map((d) => (
                  <tr key={d.id} className="border-b border-paper-2 last:border-0 hover:bg-paper transition">
                    <td className="px-4 py-3">
                      <Link href={`/documents/${d.id}`} className="font-mono font-semibold text-forest hover:underline">
                        {d.doc_no}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded border border-line text-moss">
                        {DOC_META[d.type]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold block">{d.client}</span>
                      <span className="text-[#8a938e] text-[12px]">{d.project}</span>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-right">
                      {rm(d.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] px-2 py-1 rounded bg-paper-2 text-moss">
                        {STATUS_LABEL[d.status] ?? d.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* DLP */}
        <div className="flex items-center justify-between mt-[30px] mb-3.5">
          <h2 className="font-sans font-bold text-base flex items-center gap-2">
            DLP 保固到期提醒
            <span className="font-mono text-[11px] text-amber border border-line px-1.5 py-0.5 rounded">
              自动追踪
            </span>
          </h2>
        </div>
        <div className="bg-card border border-line rounded-xl overflow-hidden shadow-card">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {["项目", "完工日期", "保固到期", "剩余"].map((h) => (
                  <th
                    key={h}
                    className="font-mono text-[10px] tracking-wide uppercase text-moss text-left px-4 py-3 bg-paper-2 border-b border-line font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dlp.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[13px] text-[#9a938a]">
                    暂无保固追踪 —— 给工程填上「完工日期 completion_date」后自动计算（默认工艺 6 个月）。
                  </td>
                </tr>
              ) : (
                dlp.map((d, i) => (
                  <tr key={i} className="border-b border-paper-2 last:border-0">
                    <td className="px-4 py-3 font-semibold">{d.project}</td>
                    <td className="px-4 py-3 text-[#8a938e] font-mono text-[12px]">
                      {d.completion}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-forest">
                      {d.expiry}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-mono text-[11px] px-2 py-1 rounded ${
                          d.daysLeft < 0
                            ? "bg-paper-2 text-[#9a938a]"
                            : d.daysLeft <= 30
                              ? "bg-amber-soft text-[#a8681e]"
                              : "bg-paper-2 text-moss"
                        }`}
                      >
                        {d.daysLeft < 0 ? "已过期" : `${d.daysLeft} 天`}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
