"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { Btn, Field, inputCls, Modal } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { rm } from "@/lib/format";
import { sectionCode } from "@/lib/quote";
import { DOC_META, DocType, NEXT_TYPE, STATUS_LABEL } from "@/lib/docmeta";
import { poWhatsAppText } from "@/lib/whatsapp";
import type { Role } from "@/lib/types";

type Doc = {
  id: string;
  doc_no: string;
  type: DocType;
  status: string;
  issue_date: string | null;
  valid_until: string | null;
  due_date: string | null;
  discount: number;
  project_id: string;
  subcontractor_id: string | null;
  project: {
    name: string;
    site_address: string | null;
    client: { name: string } | null;
  } | null;
  subcontractor: { company_name: string; address: string | null } | null;
};

type Line = {
  section_name: string;
  section_order: number;
  line_order: number;
  description: string;
  qty: number;
  amount: number; // client price 或 cost
  cost: number;
};

type Payment = {
  id: string;
  amount: number;
  method: string | null;
  bank_ref: string | null;
  paid_at: string;
  stage_name: string | null;
};

export default function DocDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const id = params.id;

  const [role, setRole] = useState<Role>("owner");
  const [doc, setDoc] = useState<Doc | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: "",
    method: "转账",
    bank_ref: "",
    stage_name: "",
  });

  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2800);
  };

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

    const { data: d } = await supabase
      .from("documents")
      .select(
        "id, doc_no, type, status, issue_date, valid_until, due_date, discount, project_id, subcontractor_id, project:projects(name, site_address, client:clients(name)), subcontractor:subcontractors(company_name, address)"
      )
      .eq("id", id)
      .single();
    if (!d) {
      setLoading(false);
      return;
    }
    const dd = d as unknown as Doc;
    setDoc(dd);

    const isPO = dd.type === "purchase_order" || dd.type === "subcon_quote";
    if (r === "owner") {
      const { data: li } = await supabase
        .from("line_items")
        .select(
          "section_name, section_order, line_order, description, qty, cost, markup_pct, manual_price"
        )
        .eq("document_id", id)
        .order("section_order")
        .order("line_order");
      const gp = 35;
      setLines(
        (li ?? []).map((l) => {
          const clientPrice =
            l.manual_price != null
              ? Number(l.manual_price)
              : Math.round(
                  (Number(l.cost) || 0) *
                    (1 + (Number(l.markup_pct) || gp) / 100)
                );
          return {
            section_name: l.section_name,
            section_order: l.section_order ?? 0,
            line_order: l.line_order ?? 0,
            description: l.description ?? "",
            qty: Number(l.qty) || 1,
            amount: isPO ? Number(l.cost) || 0 : clientPrice,
            cost: Number(l.cost) || 0,
          };
        })
      );
    } else {
      const { data: li } = await supabase
        .from("line_items_staff")
        .select("section_name, section_order, line_order, description, qty, client_price")
        .eq("document_id", id)
        .order("section_order")
        .order("line_order");
      setLines(
        (li ?? []).map((l) => ({
          section_name: l.section_name,
          section_order: l.section_order ?? 0,
          line_order: l.line_order ?? 0,
          description: l.description ?? "",
          qty: Number(l.qty) || 1,
          amount: Number(l.client_price) || 0,
          cost: 0,
        }))
      );
    }

    const { data: pays } = await supabase
      .from("payments")
      .select("id, amount, method, bank_ref, paid_at, stage_name")
      .eq("document_id", id)
      .order("paid_at");
    setPayments((pays as Payment[]) ?? []);
    setLoading(false);
  }, [configured, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <>
        <Topbar crumb="DOCUMENT" title="单据" />
        <div className="px-[30px] pt-[26px] text-[13px] text-moss">加载中…</div>
      </>
    );
  if (!doc)
    return (
      <>
        <Topbar crumb="DOCUMENT" title="单据" />
        <div className="px-[30px] pt-[26px] text-[13px] text-brick">
          单据不存在或无权访问。
        </div>
      </>
    );

  const meta = DOC_META[doc.type];
  const isPO = doc.type === "purchase_order" || doc.type === "subcon_quote";
  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const discount = isPO ? 0 : Number(doc.discount) || 0;
  const grand = subtotal - discount;
  const totalCost = lines.reduce((a, l) => a + l.cost, 0);
  const paid = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const balance = grand - paid;
  const nextType = NEXT_TYPE[doc.type];

  // group lines by section
  const secs: { code: string; name: string; items: Line[] }[] = [];
  const seen = new Map<number, number>();
  lines.forEach((l) => {
    if (!seen.has(l.section_order)) {
      seen.set(l.section_order, secs.length);
      secs.push({ code: "", name: l.section_name, items: [] });
    }
    secs[seen.get(l.section_order)!].items.push(l);
  });
  secs.forEach((s, i) => (s.code = sectionCode(i)));

  async function convert() {
    if (!nextType || !doc) return;
    setBusy(true);
    const supabase = createClient();
    try {
      const { data: dno } = await supabase.rpc("next_doc_no", {
        p_prefix: DOC_META[nextType].prefix,
      });
      const today = new Date();
      const due = new Date();
      due.setDate(today.getDate() + 30);
      const { data: nd, error } = await supabase
        .from("documents")
        .insert({
          doc_no: dno,
          type: nextType,
          project_id: doc.project_id,
          status: "draft",
          issue_date: today.toISOString().slice(0, 10),
          due_date: nextType === "invoice" ? due.toISOString().slice(0, 10) : null,
          discount: doc.discount,
        })
        .select("id, doc_no")
        .single();
      if (error) throw error;

      // 复用明细行
      if (role === "owner") {
        const { data: src } = await supabase
          .from("line_items")
          .select(
            "section_name, section_order, line_order, description, dimension, qty, cost, markup_pct, manual_price, subcontractor_id"
          )
          .eq("document_id", doc.id)
          .order("section_order")
          .order("line_order");
        const rows = (src ?? []).map((l) => ({ ...l, document_id: nd.id }));
        if (rows.length)
          await supabase.from("line_items").insert(rows);
      } else {
        const rows = lines.map((l) => ({
          document_id: nd.id,
          section_name: l.section_name,
          section_order: l.section_order,
          line_order: l.line_order,
          description: l.description,
          qty: l.qty,
          manual_price: l.amount,
        }));
        if (rows.length) await supabase.from("line_items").insert(rows);
      }

      // 报价→发票 复制付款时程
      if (nextType === "invoice") {
        const { data: ps } = await supabase
          .from("payment_schedules")
          .select("stage_name, pct, condition_text, stage_order")
          .eq("document_id", doc.id);
        const rows = (ps ?? []).map((p) => ({ ...p, document_id: nd.id }));
        if (rows.length) await supabase.from("payment_schedules").insert(rows);
      }

      notify(`已转成 ${DOC_META[nextType].label} ${nd.doc_no} ✓`);
      setTimeout(() => router.push(`/documents/${nd.id}`), 700);
    } catch (e) {
      notify("转换失败：" + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // 创建新版本 v2/v3…（复制当前报价，旧版本保留）
  async function createRevision() {
    if (!doc) return;
    setBusy(true);
    const supabase = createClient();
    try {
      const base = doc.doc_no.replace(/-v\d+$/, "");
      const m = doc.doc_no.match(/-v(\d+)$/);
      const nextV = m ? Number(m[1]) + 1 : 2;
      const newNo = `${base}-v${nextV}`;

      const { data: nd, error } = await supabase
        .from("documents")
        .insert({
          doc_no: newNo,
          type: "quotation",
          project_id: doc.project_id,
          status: "draft",
          issue_date: new Date().toISOString().slice(0, 10),
          valid_until: new Date(Date.now() + 14 * 864e5)
            .toISOString()
            .slice(0, 10),
          discount: doc.discount,
          markup_mode: "manual",
        })
        .select("id, doc_no")
        .single();
      if (error) throw error;

      // 复制明细 + 条款 + 付款时程
      if (role === "owner") {
        const { data: src } = await supabase
          .from("line_items")
          .select(
            "section_name, section_order, line_order, description, dimension, qty, cost, markup_pct, manual_price, subcontractor_id"
          )
          .eq("document_id", doc.id);
        const rows = (src ?? []).map((l) => ({ ...l, document_id: nd.id }));
        if (rows.length) await supabase.from("line_items").insert(rows);
      } else {
        const rows = lines.map((l) => ({
          document_id: nd.id,
          section_name: l.section_name,
          section_order: l.section_order,
          line_order: l.line_order,
          description: l.description,
          qty: l.qty,
          manual_price: l.amount,
        }));
        if (rows.length) await supabase.from("line_items").insert(rows);
      }
      const { data: srcDoc } = await supabase
        .from("documents")
        .select("terms_included, terms_excluded, terms_dlp, terms_conditions")
        .eq("id", doc.id)
        .single();
      if (srcDoc) await supabase.from("documents").update(srcDoc).eq("id", nd.id);
      const { data: ps } = await supabase
        .from("payment_schedules")
        .select("stage_name, pct, condition_text, stage_order")
        .eq("document_id", doc.id);
      const psRows = (ps ?? []).map((p) => ({ ...p, document_id: nd.id }));
      if (psRows.length)
        await supabase.from("payment_schedules").insert(psRows);

      notify(`已创建新版本 ${newNo}，正在打开编辑…`);
      setTimeout(() => router.push(`/quote/new?edit=${nd.id}`), 600);
    } catch (e) {
      notify("创建新版本失败：" + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!doc) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("payments").insert({
      project_id: doc.project_id,
      document_id: doc.id,
      amount: +payForm.amount || 0,
      method: payForm.method || null,
      bank_ref: payForm.bank_ref || null,
      stage_name: payForm.stage_name || null,
    });
    setBusy(false);
    if (error) return notify("失败：" + error.message);
    setPayOpen(false);
    setPayForm({ amount: "", method: "转账", bank_ref: "", stage_name: "" });
    notify("已记录收款 ✓");
    load();
  }

  async function setStatus(status: string) {
    const supabase = createClient();
    await supabase.from("documents").update({ status }).eq("id", id);
    load();
  }

  const waText = poWhatsAppText({
    docNo: doc.doc_no,
    subconName: doc.subcontractor?.company_name ?? "",
    projectName: doc.project?.name ?? "",
    siteAddress: doc.project?.site_address ?? "",
    requiredBy: "",
    items: lines.map((l) => ({ description: l.description, cost: l.cost })),
    total: totalCost,
    paymentTerms: "",
  });

  return (
    <>
      <Topbar crumb={meta.en} title={`${meta.label} ${doc.doc_no}`}>
        <Btn onClick={() => window.open(`/api/pdf/${doc.id}`, "_blank")}>
          生成 PDF
        </Btn>
        {doc.type === "quotation" &&
          (doc.status === "draft" || doc.status === "sent") && (
            <Btn onClick={() => router.push(`/quote/new?edit=${doc.id}`)}>
              ✏️ 编辑
            </Btn>
          )}
        {doc.type === "quotation" && (
          <Btn onClick={createRevision} disabled={busy}>
            + 新版本
          </Btn>
        )}
        {isPO && (
          <Btn onClick={() => setWaOpen(true)}>WhatsApp 文字</Btn>
        )}
        {nextType && (
          <Btn variant="amber" onClick={convert} disabled={busy}>
            转成 {DOC_META[nextType].label} →
          </Btn>
        )}
      </Topbar>

      <div className="px-[30px] pt-[26px] pb-[60px] max-w-[900px]">
        {/* summary */}
        <div className="grid grid-cols-4 gap-4 mb-5 max-[700px]:grid-cols-2">
          <Info label="收件" value={isPO ? doc.subcontractor?.company_name ?? "—" : doc.project?.client?.name ?? "—"} />
          <Info label="工程" value={doc.project?.name ?? "—"} />
          <Info label="日期" value={doc.issue_date ? new Date(doc.issue_date).toLocaleDateString("en-GB") : "—"} />
          <Info label="总额" value={rm(grand)} accent />
        </div>

        {/* status */}
        <div className="flex items-center gap-2 mb-5">
          <span className="font-mono text-[10px] uppercase text-moss">状态</span>
          <select
            value={doc.status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-1.5 border border-line rounded-md bg-paper text-[12.5px] focus:outline-none focus:border-moss"
          >
            {["draft", "sent", "confirmed", "due", "partial", "paid", "completed", "cancelled"].map(
              (s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              )
            )}
          </select>
        </div>

        {/* line items */}
        <div className="bg-card border border-line rounded-xl overflow-hidden shadow-card mb-5">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {["No", "描述", "数量", isPO ? "成本" : "金额", ...(role === "owner" && !isPO ? ["成本"] : [])].map(
                  (h) => (
                    <th
                      key={h}
                      className="font-mono text-[10px] uppercase text-moss text-left px-4 py-2.5 bg-paper-2 border-b border-line font-semibold last:text-right"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {secs.map((sec) => (
                <SectionRows key={sec.code}>
                  <tr>
                    <td colSpan={role === "owner" && !isPO ? 5 : 4} className="bg-paper px-4 py-2 font-mono text-[10px] uppercase text-moss font-semibold">
                      Section {sec.code} — {sec.name}
                    </td>
                  </tr>
                  {sec.items.map((l, i) => (
                    <tr key={i} className="border-b border-paper-2">
                      <td className="px-4 py-2.5 text-[#8a938e] font-mono text-[12px]">
                        {sec.code}
                        {i + 1}
                      </td>
                      <td className="px-4 py-2.5">{l.description}</td>
                      <td className="px-4 py-2.5 font-mono text-[12px]">{l.qty}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-forest">
                        {rm(l.amount)}
                      </td>
                      {role === "owner" && !isPO && (
                        <td className="px-4 py-2.5 text-right font-mono text-[#8a5a2b]">
                          {rm(l.cost)}
                        </td>
                      )}
                    </tr>
                  ))}
                </SectionRows>
              ))}
              <tr className="border-t-2 border-forest bg-paper font-bold">
                <td colSpan={3} className="px-4 py-3 font-sans">
                  合计 Total
                </td>
                <td className="px-4 py-3 text-right font-mono text-forest text-[15px]">
                  {rm(grand)}
                </td>
                {role === "owner" && !isPO && (
                  <td className="px-4 py-3 text-right font-mono text-[#8a5a2b]">
                    {rm(totalCost)}
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>

        {/* owner margin (non-PO) */}
        {role === "owner" && !isPO && grand > 0 && (
          <div className="rounded-xl p-4 mb-5 text-white bg-gradient-to-br from-forest to-forest-2 flex justify-between items-center">
            <span className="font-mono text-[10px] uppercase text-sage">
              毛利 Margin
            </span>
            <span className="font-mono font-extrabold text-[18px] text-amber">
              {rm(grand - totalCost)}
              <span className="text-[11px] bg-amber/20 px-2 py-0.5 rounded ml-2">
                {grand ? Math.round(((grand - totalCost) / grand) * 100) : 0}%
              </span>
            </span>
          </div>
        )}

        {/* payments (invoice/receipt) */}
        {(doc.type === "invoice" || doc.type === "receipt") && (
          <div className="bg-card border border-line rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-sans font-bold text-[14px]">收款记录 Payments</h3>
              <Btn variant="primary" onClick={() => setPayOpen(true)}>
                + 记录收款
              </Btn>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Info label="应收 Total" value={rm(grand)} />
              <Info label="已收 Paid" value={rm(paid)} />
              <Info label="结余 Balance" value={rm(balance)} accent={balance > 0} />
            </div>
            {payments.length === 0 ? (
              <p className="text-[12px] text-[#9a938a]">还没有收款记录。</p>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left font-mono text-[10px] uppercase text-moss">
                    <th className="py-1.5">日期</th>
                    <th>方式</th>
                    <th>凭证</th>
                    <th>阶段</th>
                    <th className="text-right">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-paper-2">
                      <td className="py-2 font-mono">
                        {new Date(p.paid_at).toLocaleDateString("en-GB")}
                      </td>
                      <td>{p.method ?? "—"}</td>
                      <td className="font-mono text-[#8a938e]">{p.bank_ref ?? "—"}</td>
                      <td>{p.stage_name ?? "—"}</td>
                      <td className="text-right font-mono font-semibold text-ok">
                        {rm(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* record payment modal */}
      {payOpen && (
        <Modal title="记录收款" onClose={() => setPayOpen(false)}>
          <form onSubmit={recordPayment}>
            <Field label="金额 Amount (RM) *">
              <input
                required
                type="number"
                className={inputCls}
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="方式 Method">
                <select
                  className={inputCls}
                  value={payForm.method}
                  onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                >
                  <option>转账</option>
                  <option>现金</option>
                  <option>支票</option>
                  <option>电子钱包</option>
                </select>
              </Field>
              <Field label="阶段 Stage">
                <input
                  className={inputCls}
                  placeholder="订金 / 进度 1…"
                  value={payForm.stage_name}
                  onChange={(e) => setPayForm({ ...payForm, stage_name: e.target.value })}
                />
              </Field>
            </div>
            <Field label="银行凭证 Bank Ref">
              <input
                className={inputCls}
                value={payForm.bank_ref}
                onChange={(e) => setPayForm({ ...payForm, bank_ref: e.target.value })}
              />
            </Field>
            <div className="flex gap-2.5 mt-2">
              <Btn type="button" onClick={() => setPayOpen(false)} className="flex-1 justify-center">
                取消
              </Btn>
              <Btn type="submit" variant="primary" disabled={busy} className="flex-1 justify-center">
                {busy ? "记录中…" : "记录"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* WhatsApp PO text modal */}
      {waOpen && (
        <Modal title="PO WhatsApp 文字（可复制）" onClose={() => setWaOpen(false)}>
          <textarea
            readOnly
            value={waText}
            className="w-full min-h-[280px] border border-line rounded-lg p-3 text-[12.5px] font-mono bg-paper resize-y"
          />
          <Btn
            variant="primary"
            className="w-full justify-center mt-3"
            onClick={() => {
              navigator.clipboard.writeText(waText);
              notify("已复制到剪贴板 ✓");
            }}
          >
            复制文字
          </Btn>
        </Modal>
      )}

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
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-card border border-line rounded-lg p-3">
      <div className="font-mono text-[9.5px] uppercase text-moss mb-1">{label}</div>
      <div className={`font-semibold text-[14px] ${accent ? "text-forest font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function SectionRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
