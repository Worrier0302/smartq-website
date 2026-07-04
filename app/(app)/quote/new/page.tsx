"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { Btn, Modal } from "@/components/ui";
import { QuotePreview } from "@/components/quote-preview";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { rm } from "@/lib/format";
import {
  parseBulkQuote,
  PayStage,
  QuoteSection,
  quoteTotals,
  sectionCode,
} from "@/lib/quote";
import type { Client, Role, Subcontractor } from "@/lib/types";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}
function fmt(d: Date) {
  return d.toLocaleDateString("en-GB"); // dd/mm/yyyy
}
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

type ProjRow = { id: string; name: string; site_address: string | null };

export default function QuoteBuilderPage() {
  const router = useRouter();
  const configured = isSupabaseConfigured();

  const [role, setRole] = useState<Role>("owner");
  const [clients, setClients] = useState<Client[]>([]);
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [projects, setProjects] = useState<ProjRow[]>([]);

  const [clientId, setClientId] = useState("");
  const [projectMode, setProjectMode] = useState<"new" | "existing">("new");
  const [projectId, setProjectId] = useState("");
  const [projName, setProjName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");

  const [sections, setSections] = useState<QuoteSection[]>([
    {
      key: uid(),
      name: "木工 Carpentry",
      items: [
        { key: uid(), description: "", price: 0, cost: 0, subcontractor_id: null },
      ],
    },
  ]);
  const [discount, setDiscount] = useState(0);
  const [pay, setPay] = useState<PayStage[]>([]);
  const [included, setIncluded] = useState("");
  const [excluded, setExcluded] = useState("");
  const [dlp, setDlp] = useState("");
  const [terms, setTerms] = useState("");

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2800);
  };

  function runImport() {
    const parsed = parseBulkQuote(importText);
    if (!parsed.length) return notify("没解析到项目，检查一下格式");
    setSections((prev) => {
      const cleaned = prev.filter((s) =>
        s.items.some((i) => i.description.trim() || i.price)
      );
      return [...cleaned, ...parsed];
    });
    const n = parsed.reduce((a, s) => a + s.items.length, 0);
    setImportOpen(false);
    setImportText("");
    notify(`已导入 ${n} 个项目（${parsed.length} 个工种）`);
  }

  // ---- initial load: role, clients, subs, default template ----
  useEffect(() => {
    if (!configured) return;
    (async () => {
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
        setRole(r);
      }
      const { data: cs } = await supabase
        .from("clients")
        .select("*")
        .order("name");
      setClients((cs as Client[]) ?? []);

      if (r === "owner") {
        const { data: ss } = await supabase
          .from("subcontractors")
          .select("*")
          .order("company_name");
        setSubs((ss as Subcontractor[]) ?? []);
      }

      const { data: tpl } = await supabase
        .from("term_templates")
        .select("*")
        .eq("is_default", true)
        .limit(1)
        .maybeSingle();
      if (tpl) {
        setIncluded(tpl.included ?? "");
        setExcluded(tpl.excluded ?? "");
        setDlp(tpl.dlp ?? "");
        setTerms(tpl.conditions ?? "");
        const stages = (tpl.payment_stages as unknown[]) ?? [];
        setPay(
          stages.map((s) => {
            const o = s as {
              stage_name?: string;
              pct?: number;
              condition_text?: string;
            };
            return {
              key: uid(),
              stage_name: o.stage_name ?? "",
              pct: Number(o.pct) || 0,
              condition_text: o.condition_text ?? "",
            };
          })
        );
      }
    })();
  }, [configured]);

  // ---- load projects when client changes ----
  const loadProjects = useCallback(async (cid: string) => {
    if (!cid) {
      setProjects([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select("id, name, site_address")
      .eq("client_id", cid)
      .order("created_at", { ascending: false });
    setProjects((data as ProjRow[]) ?? []);
  }, []);

  useEffect(() => {
    if (clientId) loadProjects(clientId);
  }, [clientId, loadProjects]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const clientAddress = selectedClient
    ? [selectedClient.address_line1, selectedClient.address_line2]
        .filter(Boolean)
        .join("\n")
    : "";

  const today = useMemo(() => new Date(), []);
  const totals = quoteTotals(sections, discount);
  const payTotalPct = pay.reduce((s, p) => s + (Number(p.pct) || 0), 0);

  // ---- section / line editing ----
  const patch = (fn: (draft: QuoteSection[]) => void) => {
    setSections((prev) => {
      const copy = prev.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) }));
      fn(copy);
      return copy;
    });
  };
  const addSection = () =>
    setSections((p) => [
      ...p,
      {
        key: uid(),
        name: "新工种 New Trade",
        items: [
          { key: uid(), description: "", price: 0, cost: 0, subcontractor_id: null },
        ],
      },
    ]);
  const removeSection = (si: number) =>
    setSections((p) => (p.length <= 1 ? p : p.filter((_, i) => i !== si)));
  const addLine = (si: number) =>
    patch((d) =>
      d[si].items.push({
        key: uid(),
        description: "",
        price: 0,
        cost: 0,
        subcontractor_id: null,
      })
    );
  const removeLine = (si: number, li: number) =>
    patch((d) => {
      d[si].items.splice(li, 1);
      if (!d[si].items.length)
        d[si].items.push({
          key: uid(),
          description: "",
          price: 0,
          cost: 0,
          subcontractor_id: null,
        });
    });

  // ---- save draft ----
  async function saveDraft(openPdf = false) {
    if (!configured) return notify("未连接 Supabase");
    if (!clientId) return notify("请先选择客户");
    if (projectMode === "new" && !projName.trim())
      return notify("请填写工程名称");
    if (projectMode === "existing" && !projectId)
      return notify("请选择工程");

    setSaving(true);
    const supabase = createClient();
    try {
      // 1. project
      let pid = projectId;
      if (projectMode === "new") {
        const { data: code } = await supabase.rpc("next_doc_no", {
          p_prefix: "P",
        });
        const { data: proj, error: pe } = await supabase
          .from("projects")
          .insert({
            code,
            name: projName.trim(),
            client_id: clientId,
            site_address: siteAddress.trim() || null,
            status: "quoting",
          })
          .select("id")
          .single();
        if (pe) throw pe;
        pid = proj.id;
      }

      // 2. document
      const { data: docNo } = await supabase.rpc("next_doc_no", {
        p_prefix: "Q",
      });
      const { data: doc, error: de } = await supabase
        .from("documents")
        .insert({
          doc_no: docNo,
          type: "quotation",
          project_id: pid,
          status: "draft",
          issue_date: iso(today),
          valid_until: iso(addDays(today, 14)),
          discount: discount || 0,
          markup_mode: "manual",
          terms_included: included,
          terms_excluded: excluded,
          terms_dlp: dlp,
          terms_conditions: terms,
        })
        .select("id, doc_no")
        .single();
      if (de) throw de;

      // 3. line_items（不 .select()，避免 staff 被 SELECT policy 挡；成本列由 trigger 处理）
      const rows: Record<string, unknown>[] = [];
      sections.forEach((sec, si) => {
        sec.items.forEach((it, li) => {
          if (!it.description.trim() && !it.price) return;
          rows.push({
            document_id: doc.id,
            section_name: sec.name,
            section_order: si,
            line_order: li,
            description: it.description,
            qty: 1,
            cost: role === "owner" ? it.cost || 0 : 0,
            manual_price: it.price || 0,
            subcontractor_id: role === "owner" ? it.subcontractor_id : null,
          });
        });
      });
      if (rows.length) {
        const { error: le } = await supabase.from("line_items").insert(rows);
        if (le) throw le;
      }

      // 4. payment_schedules
      const payRows = pay.map((p, i) => ({
        document_id: doc.id,
        stage_name: p.stage_name,
        pct: p.pct || 0,
        condition_text: p.condition_text || null,
        stage_order: i,
      }));
      if (payRows.length) {
        const { error: pse } = await supabase
          .from("payment_schedules")
          .insert(payRows);
        if (pse) throw pse;
      }

      if (openPdf) {
        notify(`已保存 ${doc.doc_no}，正在生成 PDF 📄`);
        window.open(`/api/pdf/${doc.id}`, "_blank");
      } else {
        notify(`已保存草稿 ✓ ${doc.doc_no}`);
        setTimeout(() => router.push("/documents"), 900);
      }
    } catch (e) {
      notify("保存失败：" + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const input =
    "w-full px-[9px] py-[7px] border border-line rounded-md bg-paper text-[12.5px] text-ink focus:outline-none focus:border-moss focus:bg-white transition";
  const mini =
    "font-mono text-[9.5px] tracking-tight uppercase text-moss mb-1.5 block mt-3.5";

  return (
    <>
      <Topbar crumb="NEW QUOTATION" title="开新报价 Quotation" />

      <div className="px-[30px] pt-[26px] pb-[60px]">
        {!configured && (
          <div className="mb-5 rounded-xl bg-amber-soft border border-amber/40 px-5 py-4 text-[13px] text-[#a8681e]">
            未连接 Supabase，无法加载客户/保存。
          </div>
        )}

        <div className="grid grid-cols-[1fr_400px] gap-6 items-start max-[1100px]:grid-cols-1">
          {/* ============ LEFT ============ */}
          <div>
            {/* Card 1 */}
            <FormCard n={1} title="客户 & 工程">
              <label className={mini + " !mt-0"}>选择客户 Client</label>
              <select
                className={input}
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setProjectMode("new");
                  setProjectId("");
                }}
              >
                <option value="">— 选择客户 —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {clientId && (
                <>
                  <label className={mini}>工程 Project</label>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setProjectMode("new")}
                      className={`flex-1 py-2 rounded-md text-[12px] font-semibold border transition ${
                        projectMode === "new"
                          ? "bg-forest text-white border-forest"
                          : "bg-paper text-moss border-line"
                      }`}
                    >
                      + 新工程
                    </button>
                    <button
                      onClick={() => setProjectMode("existing")}
                      disabled={!projects.length}
                      className={`flex-1 py-2 rounded-md text-[12px] font-semibold border transition disabled:opacity-40 ${
                        projectMode === "existing"
                          ? "bg-forest text-white border-forest"
                          : "bg-paper text-moss border-line"
                      }`}
                    >
                      选现有 ({projects.length})
                    </button>
                  </div>

                  {projectMode === "new" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={mini + " !mt-0"}>工程名称</label>
                        <input
                          className={input}
                          value={projName}
                          onChange={(e) => setProjName(e.target.value)}
                          placeholder="厨房橱柜工程"
                        />
                      </div>
                      <div>
                        <label className={mini + " !mt-0"}>工地地址</label>
                        <input
                          className={input}
                          value={siteAddress}
                          onChange={(e) => setSiteAddress(e.target.value)}
                          placeholder="Taman Daya…"
                        />
                      </div>
                    </div>
                  ) : (
                    <select
                      className={input}
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                    >
                      <option value="">— 选择工程 —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}
            </FormCard>

            {/* Card 2 — sections */}
            <FormCard n={2} title="报价明细">
              {sections.map((sec, si) => (
                <div key={sec.key} className="mb-1.5">
                  <div className="flex items-center gap-2 my-3">
                    <span className="font-mono text-[11px] font-bold text-white bg-moss w-[22px] h-[22px] rounded-md grid place-items-center flex-none">
                      {sectionCode(si)}
                    </span>
                    <input
                      value={sec.name}
                      onChange={(e) =>
                        patch((d) => (d[si].name = e.target.value))
                      }
                      placeholder="工种名称，如 电工 Electrical"
                      className="flex-1 border border-transparent bg-transparent font-mono text-[12px] tracking-tight uppercase text-moss font-semibold px-2 py-1.5 rounded-md hover:bg-paper-2 focus:outline-none focus:bg-white focus:border-moss focus:text-ink transition"
                    />
                    <button
                      onClick={() => removeSection(si)}
                      title="删除整个 Section"
                      className="text-brick/40 hover:text-brick text-[15px] px-2 flex-none"
                    >
                      🗑
                    </button>
                  </div>

                  {/* line header */}
                  <div
                    className={`grid gap-2 pb-1 font-mono text-[8.5px] tracking-tight uppercase text-[#b0a89a] ${
                      role === "owner"
                        ? "grid-cols-[1fr_80px_80px_110px_24px]"
                        : "grid-cols-[1fr_90px_24px]"
                    }`}
                  >
                    <span>描述</span>
                    <span className="text-right">客户价</span>
                    {role === "owner" && <span className="text-right">成本</span>}
                    {role === "owner" && <span>判包商</span>}
                    <span />
                  </div>

                  {sec.items.map((it, li) => (
                    <div
                      key={it.key}
                      className={`grid gap-2 items-center py-1.5 border-b border-dashed border-paper-2 ${
                        role === "owner"
                          ? "grid-cols-[1fr_80px_80px_110px_24px]"
                          : "grid-cols-[1fr_90px_24px]"
                      }`}
                    >
                      <input
                        value={it.description}
                        onChange={(e) =>
                          patch((d) => (d[si].items[li].description = e.target.value))
                        }
                        placeholder="项目描述"
                        className="px-[9px] py-[7px] text-[12.5px] border border-line rounded-md bg-paper focus:outline-none focus:border-moss focus:bg-white"
                      />
                      <input
                        type="number"
                        value={it.price || ""}
                        onChange={(e) =>
                          patch(
                            (d) => (d[si].items[li].price = +e.target.value)
                          )
                        }
                        placeholder="0"
                        className="px-[9px] py-[7px] text-[12.5px] text-right font-mono text-forest border border-line rounded-md bg-paper focus:outline-none focus:border-moss focus:bg-white"
                      />
                      {role === "owner" && (
                        <input
                          type="number"
                          value={it.cost || ""}
                          onChange={(e) =>
                            patch(
                              (d) => (d[si].items[li].cost = +e.target.value)
                            )
                          }
                          placeholder="0"
                          className="px-[9px] py-[7px] text-[12.5px] text-right font-mono text-[#8a5a2b] border border-line rounded-md bg-amber-soft/40 focus:outline-none focus:border-moss focus:bg-white"
                        />
                      )}
                      {role === "owner" && (
                        <select
                          value={it.subcontractor_id ?? ""}
                          onChange={(e) =>
                            patch(
                              (d) =>
                                (d[si].items[li].subcontractor_id =
                                  e.target.value || null)
                            )
                          }
                          className="px-1.5 py-[7px] text-[11px] border border-line rounded-md bg-white focus:outline-none focus:border-moss"
                        >
                          <option value="">判包商…</option>
                          {subs.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.company_name}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        onClick={() => removeLine(si, li)}
                        className="text-brick/50 hover:text-brick text-[15px]"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => addLine(si)}
                    className="text-[12px] text-moss bg-transparent border border-dashed border-line rounded-md p-2 w-full mt-2.5 font-semibold hover:border-moss hover:bg-paper transition"
                  >
                    + 添加 {sectionCode(si)} 项目
                  </button>
                </div>
              ))}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={addSection}
                  className="flex-1 font-sans text-[12.5px] font-semibold text-forest bg-paper-2 border border-dashed border-moss rounded-lg p-[11px] hover:bg-paper transition flex items-center justify-center gap-2"
                >
                  + 添加新 Section（工种）
                </button>
                <button
                  onClick={() => setImportOpen(true)}
                  className="font-sans text-[12.5px] font-semibold text-moss bg-white border border-line rounded-lg px-4 hover:border-moss transition"
                >
                  📋 批量导入
                </button>
              </div>

              <div className="mt-4.5 mt-[18px]">
                <label className={mini + " !mt-0"}>折扣 Discount (RM)</label>
                <input
                  type="number"
                  value={discount || ""}
                  onChange={(e) => setDiscount(+e.target.value)}
                  placeholder="0"
                  className={input + " max-w-[200px]"}
                />
              </div>
            </FormCard>

            {/* Card 3 — payment + terms */}
            <FormCard n={3} title="付款时程 · 条款 · 保固">
              <span className={mini + " !mt-0"}>
                付款时程 Payment Schedule（% 自动算金额）
              </span>
              {pay.map((p, i) => (
                <div
                  key={p.key}
                  className="grid grid-cols-[1.4fr_60px_1fr_24px] gap-2 items-center mb-2"
                >
                  <input
                    value={p.stage_name}
                    onChange={(e) =>
                      setPay((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, stage_name: e.target.value } : x
                        )
                      )
                    }
                    className="px-[9px] py-[7px] text-[12.5px] border border-line rounded-md bg-paper focus:outline-none focus:border-moss focus:bg-white"
                  />
                  <input
                    type="number"
                    value={p.pct || ""}
                    onChange={(e) =>
                      setPay((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, pct: +e.target.value } : x
                        )
                      )
                    }
                    className="px-[9px] py-[7px] text-center font-mono text-[12.5px] border border-line rounded-md bg-amber-soft text-[#a8681e] font-semibold focus:outline-none focus:border-moss"
                  />
                  <input
                    value={p.condition_text}
                    onChange={(e) =>
                      setPay((prev) =>
                        prev.map((x, j) =>
                          j === i
                            ? { ...x, condition_text: e.target.value }
                            : x
                        )
                      )
                    }
                    className="px-[9px] py-[7px] text-[12.5px] border border-line rounded-md bg-paper focus:outline-none focus:border-moss focus:bg-white"
                  />
                  <button
                    onClick={() =>
                      setPay((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="text-brick/50 hover:text-brick text-[15px]"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <button
                  onClick={() =>
                    setPay((p) => [
                      ...p,
                      { key: uid(), stage_name: "新阶段", pct: 0, condition_text: "" },
                    ])
                  }
                  className="text-[11.5px] text-moss font-semibold hover:text-forest"
                >
                  + 加阶段
                </button>
                <span
                  className={`font-mono text-[11px] ${
                    payTotalPct === 100 ? "text-[#8a938e]" : "text-brick"
                  }`}
                >
                  合计 {payTotalPct}%{payTotalPct === 100 ? " ✓" : " ⚠️ 应为 100%"}
                </span>
              </div>

              <TermArea
                label="✓ 包含 What's Included"
                value={included}
                onChange={setIncluded}
              />
              <TermArea
                label="✗ 不包含 Not Included"
                value={excluded}
                onChange={setExcluded}
              />
              <TermArea
                label="🛡 DLP 保固期"
                value={dlp}
                onChange={setDlp}
                min={60}
              />
              <TermArea
                label="§ 条款 Terms & Conditions"
                value={terms}
                onChange={setTerms}
                min={120}
              />
              <p className="text-[11px] text-[#8a938e] mt-2.5 font-mono">
                💡 这些内容从「默认模板」带出，可只改需要的部分（模板在 PHASE 5
                的设置页维护）。
              </p>
            </FormCard>
          </div>

          {/* ============ RIGHT — preview ============ */}
          <div className="sticky top-[90px] max-[1100px]:static">
            <div className="font-mono text-[10px] tracking-tight uppercase text-moss mb-2 flex justify-between items-center">
              <span>实时预览 · Live Preview</span>
              <span className="font-mono font-semibold text-forest">
                {rm(totals.grand)}
              </span>
            </div>

            <QuotePreview
              docNo="Q-…（保存后生成）"
              clientName={selectedClient?.name ?? "—"}
              clientAddress={clientAddress}
              issueDate={fmt(today)}
              validUntil={fmt(addDays(today, 14))}
              sections={sections}
              discount={discount}
              paySchedule={pay}
              included={included}
              excluded={excluded}
              dlp={dlp}
              terms={terms}
            />

            {/* margin panel / staff lock */}
            {role === "owner" ? (
              <div className="relative overflow-hidden rounded-xl p-5 mt-4 text-white bg-gradient-to-br from-forest to-forest-2">
                <span className="absolute top-3.5 right-4 font-mono text-[9px] tracking-widest text-amber border border-amber/40 px-1.5 py-0.5 rounded">
                  OWNER
                </span>
                <h4 className="font-mono text-[10px] tracking-tight uppercase text-sage mb-3.5">
                  利润分析 · Margin (仅老板可见)
                </h4>
                <Row k="客户报价 Client Price" v={rm(totals.grand)} />
                <Row k="判包成本 Sub-con Cost" v={rm(totals.cost)} />
                <div className="flex justify-between items-center mt-1.5 pt-3">
                  <span className="text-[13px] text-white/70">毛利 Margin</span>
                  <span className="font-mono font-extrabold text-[22px] text-amber">
                    {rm(totals.margin)}
                    <span className="font-mono text-[11px] bg-amber/20 text-amber px-2 py-0.5 rounded ml-2">
                      {totals.marginPct}%
                    </span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-paper-2 border border-dashed border-line rounded-xl p-6 text-center mt-4 text-[#9a938a]">
                <div className="font-sans font-bold text-[13px] mb-1">
                  🔒 成本与利润数据已锁定
                </div>
                <p className="text-[12px]">此栏目仅限老板 (Owner) 查看</p>
              </div>
            )}

            <div className="flex gap-2.5 mt-4">
              <Btn
                onClick={() => saveDraft(false)}
                disabled={saving || !configured}
                className="flex-1 justify-center"
              >
                {saving ? "保存中…" : "保存草稿"}
              </Btn>
              <Btn
                variant="primary"
                onClick={() => saveDraft(true)}
                disabled={saving || !configured}
                className="flex-1 justify-center"
              >
                保存并生成 PDF
              </Btn>
            </div>
          </div>
        </div>
      </div>

      {importOpen && (
        <Modal title="📋 批量导入项目" onClose={() => setImportOpen(false)}>
          <p className="text-[12.5px] text-[#6b7570] mb-3 leading-relaxed">
            从 Excel / 报价单<b>复制整块粘贴</b>。每行一个项目，自动识别
            <b>描述</b>和<b>客户价</b>（每行最后一个纯数字）。没有数字的行会当成
            <b>工种标题</b>，SUBTOTAL / 折扣 / 运费等汇总行自动跳过。
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={
              "木工 Carpentry\nL型上下橱柜 4200mm  6800\n吊柜玻璃门 x4  1900\n石材 Stone\n石英石台面  3200\n\n（也支持：描述,售价 或从 Excel 直接复制）"
            }
            className="w-full min-h-[200px] border border-line rounded-lg px-3 py-2.5 text-[12.5px] font-mono bg-paper resize-y focus:outline-none focus:border-moss focus:bg-white"
          />
          {importText.trim() && (
            <div className="mt-2 text-[11.5px] text-moss font-mono">
              {(() => {
                const p = parseBulkQuote(importText);
                const n = p.reduce((a, s) => a + s.items.length, 0);
                const sum = p.reduce(
                  (a, s) => a + s.items.reduce((b, i) => b + i.price, 0),
                  0
                );
                return `预览：${n} 个项目 · ${p.length} 个工种 · 售价合计 ${rm(sum)}`;
              })()}
            </div>
          )}
          <div className="flex gap-2.5 mt-4">
            <Btn
              type="button"
              onClick={() => setImportOpen(false)}
              className="flex-1 justify-center"
            >
              取消
            </Btn>
            <Btn
              variant="primary"
              onClick={runImport}
              className="flex-1 justify-center"
            >
              导入到表格
            </Btn>
          </div>
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

function FormCard({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-line rounded-xl p-[22px] shadow-card mb-4">
      <h3 className="font-sans text-[14px] font-bold mb-4 pb-3 border-b border-paper-2 flex items-center gap-2">
        <span className="font-mono text-[11px] bg-forest text-white w-5 h-5 rounded-md grid place-items-center">
          {n}
        </span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function TermArea({
  label,
  value,
  onChange,
  min = 80,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
}) {
  return (
    <>
      <span className="font-mono text-[9.5px] tracking-tight uppercase text-moss mb-1.5 block mt-3.5">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ minHeight: min }}
        className="w-full border border-line rounded-lg px-3 py-2.5 text-[12.5px] leading-[1.7] bg-paper resize-y text-ink focus:outline-none focus:border-moss focus:bg-white"
      />
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-[7px] text-[13px] border-b border-white/[.08]">
      <span className="text-white/70">{k}</span>
      <span className="font-mono font-semibold">{v}</span>
    </div>
  );
}
