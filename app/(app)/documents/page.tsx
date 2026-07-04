"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { Btn, EmptyRow } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { rm } from "@/lib/format";
import { DOC_META, DocType, STATUS_LABEL } from "@/lib/docmeta";
import type { Role } from "@/lib/types";

type DocRow = {
  id: string;
  doc_no: string;
  type: DocType;
  status: string;
  issue_date: string;
  project: { name: string; client: { name: string } | null } | null;
  amount: number;
  cost: number;
};

const TYPE_FILTERS: { key: DocType | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "quotation", label: "报价" },
  { key: "invoice", label: "发票" },
  { key: "receipt", label: "收据" },
  { key: "delivery_order", label: "送货单" },
  { key: "purchase_order", label: "采购单" },
];

export default function DocumentsPage() {
  const configured = isSupabaseConfigured();
  const [role, setRole] = useState<Role>("owner");
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeF, setTypeF] = useState<DocType | "all">("all");

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

    const { data: docs } = await supabase
      .from("documents")
      .select(
        "id, doc_no, type, status, issue_date, project:projects(name, client:clients(name))"
      )
      .order("created_at", { ascending: false });

    const list = (docs ?? []) as unknown as Omit<DocRow, "amount" | "cost">[];
    const ids = list.map((d) => d.id);

    // 客户价合计（安全视图，不含 PO）
    const clientTotals = new Map<string, number>();
    if (ids.length) {
      const { data: cf } = await supabase
        .from("line_items_staff")
        .select("document_id, client_price")
        .in("document_id", ids);
      (cf ?? []).forEach((l) => {
        clientTotals.set(
          l.document_id,
          (clientTotals.get(l.document_id) ?? 0) + (Number(l.client_price) || 0)
        );
      });
    }

    // 成本合计（owner，含 PO）
    const costTotals = new Map<string, number>();
    if (r === "owner" && ids.length) {
      const { data: base } = await supabase
        .from("line_items")
        .select("document_id, cost")
        .in("document_id", ids);
      (base ?? []).forEach((l) => {
        costTotals.set(
          l.document_id,
          (costTotals.get(l.document_id) ?? 0) + (Number(l.cost) || 0)
        );
      });
    }

    setRows(
      list.map((d) => ({
        ...d,
        amount: clientTotals.get(d.id) ?? costTotals.get(d.id) ?? 0,
        cost: costTotals.get(d.id) ?? 0,
      }))
    );
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((d) => typeF === "all" || d.type === typeF);

  return (
    <>
      <Topbar crumb="ALL DOCUMENTS" title="所有单据" />
      <div className="px-[30px] pt-[26px] pb-[60px]">
        {!configured && (
          <div className="mb-5 rounded-xl bg-amber-soft border border-amber/40 px-5 py-4 text-[13px] text-[#a8681e]">
            未连接 Supabase。
          </div>
        )}

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {TYPE_FILTERS.map((f) => {
            if (
              role === "staff" &&
              (f.key === "purchase_order")
            )
              return null;
            return (
              <button
                key={f.key}
                onClick={() => setTypeF(f.key)}
                className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold border transition ${
                  typeF === f.key
                    ? "bg-forest text-white border-forest"
                    : "bg-card text-moss border-line hover:border-moss"
                }`}
              >
                {f.label}
              </button>
            );
          })}
          <div className="flex-1" />
          <Link href="/quote/new">
            <Btn variant="amber">+ 开新报价</Btn>
          </Link>
        </div>

        <div className="bg-card border border-line rounded-xl overflow-hidden shadow-card">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {["单号", "类型", "客户 / 项目", "日期", "金额", ...(role === "owner" ? ["成本"] : []), "状态"].map(
                  (h) => (
                    <th
                      key={h}
                      className="font-mono text-[10px] tracking-wide uppercase text-moss text-left px-4 py-3 bg-paper-2 border-b border-line font-semibold"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <EmptyRow colSpan={role === "owner" ? 7 : 6} text="加载中…" />
              ) : filtered.length === 0 ? (
                <EmptyRow
                  colSpan={role === "owner" ? 7 : 6}
                  text={configured ? "没有单据。去开一张报价吧。" : "接上 Supabase 后显示。"}
                />
              ) : (
                filtered.map((d) => (
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
                      <span className="font-semibold block">
                        {d.project?.client?.name ?? "—"}
                      </span>
                      <span className="text-[#8a938e] text-[12px]">
                        {d.project?.name ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#8a938e] font-mono text-[12px]">
                      {d.issue_date
                        ? new Date(d.issue_date).toLocaleDateString("en-GB")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-right">
                      {rm(d.amount)}
                    </td>
                    {role === "owner" && (
                      <td className="px-4 py-3 font-mono text-right text-[#8a5a2b]">
                        {d.cost ? rm(d.cost) : "—"}
                      </td>
                    )}
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
      </div>
    </>
  );
}
