"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { rm } from "@/lib/format";
import { DOC_META, DocType, STATUS_LABEL } from "@/lib/docmeta";
import { PROJECT_STATUS, PROJECT_STATUS_KEYS } from "@/lib/projectmeta";

type Project = {
  id: string;
  code: string | null;
  name: string;
  status: string;
  site_address: string | null;
  completion_date: string | null;
  client: { name: string; phone: string | null } | null;
};

type DocRow = {
  id: string;
  doc_no: string;
  type: DocType;
  status: string;
  issue_date: string | null;
  amount: number;
};

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const configured = isSupabaseConfigured();
  const id = params.id;
  const [project, setProject] = useState<Project | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [invoiced, setInvoiced] = useState(0);
  const [paid, setPaid] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2400);
  };

  const load = useCallback(async () => {
    if (!configured) return setLoading(false);
    setLoading(true);
    const supabase = createClient();
    const { data: p } = await supabase
      .from("projects")
      .select(
        "id, code, name, status, site_address, completion_date, client:clients(name, phone)"
      )
      .eq("id", id)
      .single();
    if (!p) {
      setLoading(false);
      return;
    }
    setProject(p as unknown as Project);

    const { data: dRaw } = await supabase
      .from("documents")
      .select("id, doc_no, type, status, issue_date, discount")
      .eq("project_id", id)
      .order("created_at", { ascending: false });
    const dl = (dRaw ?? []) as {
      id: string;
      doc_no: string;
      type: DocType;
      status: string;
      issue_date: string | null;
      discount: number;
    }[];
    const ids = dl.map((d) => d.id);

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

    let inv = 0;
    setDocs(
      dl.map((d) => {
        const isPO = d.type === "purchase_order" || d.type === "subcon_quote";
        const grand =
          (clientTotals.get(d.id) ?? (isPO ? costTotals.get(d.id) ?? 0 : 0)) -
          (isPO ? 0 : Number(d.discount) || 0);
        if (d.type === "invoice") inv += grand;
        return {
          id: d.id,
          doc_no: d.doc_no,
          type: d.type,
          status: d.status,
          issue_date: d.issue_date,
          amount: grand,
        };
      })
    );
    setInvoiced(inv);

    const { data: pays } = await supabase
      .from("payments")
      .select("amount")
      .eq("project_id", id);
    setPaid((pays ?? []).reduce((a, x) => a + (Number(x.amount) || 0), 0));
    setLoading(false);
  }, [configured, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateProject(patch: Record<string, unknown>) {
    const supabase = createClient();
    const { error } = await supabase.from("projects").update(patch).eq("id", id);
    if (error) return notify("更新失败：" + error.message);
    notify("已更新 ✓");
    load();
  }

  if (loading)
    return (
      <>
        <Topbar crumb="PROJECT" title="工程" />
        <div className="px-[30px] pt-[26px] text-[13px] text-moss">加载中…</div>
      </>
    );
  if (!project)
    return (
      <>
        <Topbar crumb="PROJECT" title="工程" />
        <div className="px-[30px] pt-[26px] text-[13px] text-brick">
          工程不存在或无权访问。
        </div>
      </>
    );

  const balance = invoiced - paid;
  const progress = invoiced ? Math.min(100, Math.round((paid / invoiced) * 100)) : 0;

  // DLP
  let dlpText = "填「完工日期」后自动计算";
  let dlpDays: number | null = null;
  if (project.completion_date) {
    const comp = new Date(project.completion_date);
    const exp = new Date(comp);
    exp.setMonth(exp.getMonth() + 6);
    dlpDays = Math.round((exp.getTime() - Date.now()) / 864e5);
    dlpText = `${exp.toLocaleDateString("en-GB")}（${
      dlpDays < 0 ? "已过期" : `剩 ${dlpDays} 天`
    }）`;
  }

  return (
    <>
      <Topbar crumb="PROJECT" title={`${project.name}`}>
        <Link href="/quote/new">
          <span className="font-sans font-semibold text-[13px] px-4 py-[9px] rounded-lg border bg-amber text-ink border-amber inline-flex items-center gap-2">
            + 开新报价
          </span>
        </Link>
      </Topbar>

      <div className="px-[30px] pt-[26px] pb-[60px] max-w-[900px]">
        {/* header info */}
        <div className="grid grid-cols-4 gap-4 mb-5 max-[700px]:grid-cols-2">
          <Info label="工程编号" value={project.code ?? "—"} mono />
          <Info label="客户" value={project.client?.name ?? "—"} />
          <Info label="电话" value={project.client?.phone ?? "—"} mono />
          <Info label="工地" value={project.site_address ?? "—"} />
        </div>

        {/* editable status + completion */}
        <div className="bg-card border border-line rounded-xl p-4 shadow-card mb-5 flex flex-wrap gap-6 items-center">
          <div>
            <label className="block font-mono text-[10px] uppercase text-moss mb-1.5">
              状态
            </label>
            <select
              value={project.status}
              onChange={(e) => updateProject({ status: e.target.value })}
              className="px-3 py-2 border border-line rounded-md bg-paper text-[13px] focus:outline-none focus:border-moss"
            >
              {PROJECT_STATUS_KEYS.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-moss mb-1.5">
              完工日期（DLP 起算）
            </label>
            <input
              type="date"
              value={project.completion_date ?? ""}
              onChange={(e) =>
                updateProject({ completion_date: e.target.value || null })
              }
              className="px-3 py-2 border border-line rounded-md bg-paper text-[13px] focus:outline-none focus:border-moss"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-moss mb-1.5">
              🛡 DLP 保固到期
            </label>
            <div
              className={`px-3 py-2 rounded-md text-[13px] font-mono ${
                dlpDays !== null && dlpDays >= 0 && dlpDays <= 30
                  ? "bg-amber-soft text-[#a8681e]"
                  : "bg-paper-2 text-moss"
              }`}
            >
              {dlpText}
            </div>
          </div>
        </div>

        {/* payment progress */}
        <div className="bg-card border border-line rounded-xl p-5 shadow-card mb-5">
          <h3 className="font-sans font-bold text-[14px] mb-3">收款进度 Payment Progress</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Info label="已开发票 Invoiced" value={rm(invoiced)} />
            <Info label="已收 Paid" value={rm(paid)} />
            <Info label="结余 Balance" value={rm(balance)} accent={balance > 0} />
          </div>
          <div className="h-2.5 rounded bg-paper-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-moss to-sage transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="font-mono text-[11px] text-[#6b7570] mt-1.5">
            {progress}% 已收
          </div>
        </div>

        {/* documents */}
        <h3 className="font-sans font-bold text-[14px] mb-3">
          单据 Documents（{docs.length}）
        </h3>
        <div className="bg-card border border-line rounded-xl overflow-hidden shadow-card">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {["单号", "类型", "日期", "金额", "状态"].map((h) => (
                  <th
                    key={h}
                    className="font-mono text-[10px] uppercase text-moss text-left px-4 py-3 bg-paper-2 border-b border-line font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-[#9a938a]">
                    这个工程还没有单据。
                  </td>
                </tr>
              ) : (
                docs.map((d) => (
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
                    <td className="px-4 py-3 text-[#8a938e] font-mono text-[12px]">
                      {d.issue_date ? new Date(d.issue_date).toLocaleDateString("en-GB") : "—"}
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
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-forest text-white px-5 py-3 rounded-lg text-[13px] font-semibold shadow-doc z-50">
          {toast}
        </div>
      )}
    </>
  );
}

function Info({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="bg-card border border-line rounded-lg p-3">
      <div className="font-mono text-[9.5px] uppercase text-moss mb-1">{label}</div>
      <div className={`font-semibold text-[14px] ${accent ? "text-forest" : ""} ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}
