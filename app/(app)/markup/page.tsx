"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { Btn, Modal } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { rm } from "@/lib/format";
import { sectionCode } from "@/lib/quote";
import {
  MarkupMode,
  MarkupSection,
  markupTotals,
  parseBulkMarkup,
  priceOf,
} from "@/lib/markup";
import type { Client, Role, Subcontractor } from "@/lib/types";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const emptyLine = () => ({
  key: uid(),
  description: "",
  subcontractor_id: null,
  cost: 0,
  markupPct: 35,
  manualPrice: null,
});

type ProjRow = { id: string; name: string };

export default function MarkupPage() {
  const router = useRouter();
  const configured = isSupabaseConfigured();

  const [role, setRole] = useState<Role>("owner");
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [projects, setProjects] = useState<ProjRow[]>([]);

  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [newProjName, setNewProjName] = useState("");

  const [mode, setMode] = useState<MarkupMode>("global");
  const [globalPct, setGlobalPct] = useState(35);
  const [sections, setSections] = useState<MarkupSection[]>([
    { key: uid(), name: "木工 Carpentry", items: [emptyLine()] },
  ]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importSub, setImportSub] = useState("");
  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  function runImport() {
    const parsed = parseBulkMarkup(importText, globalPct);
    if (!parsed.length) return notify("没解析到项目，检查一下格式");
    const withSub = parsed.map((s) => ({
      ...s,
      items: s.items.map((it) => ({
        ...it,
        subcontractor_id: importSub || null,
      })),
    }));
    setSections((prev) => {
      // 去掉开头那个还没填的空 section
      const cleaned = prev.filter((s) =>
        s.items.some((i) => i.description.trim() || i.cost)
      );
      return [...cleaned, ...withSub];
    });
    const n = parsed.reduce((a, s) => a + s.items.length, 0);
    setImportOpen(false);
    setImportText("");
    notify(`已导入 ${n} 个项目（${parsed.length} 个工种）`);
  }

  useEffect(() => {
    if (!configured) {
      setRoleLoaded(true);
      return;
    }
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
      }
      setRole(r);
      setRoleLoaded(true);
      if (r !== "owner") return;

      const [{ data: cs }, { data: ss }] = await Promise.all([
        supabase.from("clients").select("*").order("name"),
        supabase.from("subcontractors").select("*").order("company_name"),
      ]);
      setClients((cs as Client[]) ?? []);
      setSubs((ss as Subcontractor[]) ?? []);
    })();
  }, [configured]);

  const loadProjects = useCallback(async (cid: string) => {
    if (!cid) return setProjects([]);
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .eq("client_id", cid)
      .order("created_at", { ascending: false });
    setProjects((data as ProjRow[]) ?? []);
  }, []);

  useEffect(() => {
    if (clientId) loadProjects(clientId);
  }, [clientId, loadProjects]);

  const totals = markupTotals(sections, mode, globalPct);
  const subById = (id: string | null) =>
    subs.find((s) => s.id === id)?.company_name ?? null;

  const patch = (fn: (d: MarkupSection[]) => void) =>
    setSections((prev) => {
      const copy = prev.map((s) => ({
        ...s,
        items: s.items.map((i) => ({ ...i })),
      }));
      fn(copy);
      return copy;
    });

  // ---- PO grouping (flatten by subcontractor) ----
  const groups = new Map<
    string,
    { name: string; lines: { d: string; cost: number }[]; total: number }
  >();
  sections.forEach((sec) =>
    sec.items.forEach((it) => {
      if (!it.subcontractor_id) return;
      const name = subById(it.subcontractor_id) ?? "未指定";
      const g = groups.get(it.subcontractor_id) ?? {
        name,
        lines: [],
        total: 0,
      };
      g.lines.push({ d: it.description || "（未命名）", cost: it.cost || 0 });
      g.total += it.cost || 0;
      groups.set(it.subcontractor_id, g);
    })
  );

  async function ensureProject(): Promise<string> {
    if (projectId) return projectId;
    const supabase = createClient();
    const { data: code } = await supabase.rpc("next_doc_no", { p_prefix: "P" });
    const { data: proj, error } = await supabase
      .from("projects")
      .insert({
        code,
        name: newProjName.trim() || "未命名工程",
        client_id: clientId,
        status: "quoting",
      })
      .select("id")
      .single();
    if (error) throw error;
    setProjectId(proj.id);
    return proj.id;
  }

  // ---- 转成客户报价 ----
  async function toQuotation() {
    if (!clientId) return notify("请先选择客户");
    if (!projectId && !newProjName.trim()) return notify("请选择或填写工程");
    setSaving(true);
    const supabase = createClient();
    try {
      const pid = await ensureProject();
      const { data: qno } = await supabase.rpc("next_doc_no", { p_prefix: "Q" });
      const { data: doc, error: de } = await supabase
        .from("documents")
        .insert({
          doc_no: qno,
          type: "quotation",
          project_id: pid,
          status: "draft",
          markup_mode: mode,
          global_markup_pct: globalPct,
        })
        .select("id, doc_no")
        .single();
      if (de) throw de;

      const rows: Record<string, unknown>[] = [];
      sections.forEach((sec, si) =>
        sec.items.forEach((it, li) => {
          if (!it.description.trim() && !it.cost) return;
          rows.push({
            document_id: doc.id,
            section_name: sec.name,
            section_order: si,
            line_order: li,
            description: it.description,
            qty: 1,
            cost: it.cost || 0,
            markup_pct: mode === "line" ? it.markupPct : null,
            manual_price:
              mode === "manual" ? priceOf(it, mode, globalPct) : null,
            subcontractor_id: it.subcontractor_id,
          });
        })
      );
      if (rows.length) {
        const { error } = await supabase.from("line_items").insert(rows);
        if (error) throw error;
      }
      notify(`已生成客户报价 ${doc.doc_no}（PDF 不含成本）✓`);
      setTimeout(() => router.push(`/api/pdf/${doc.id}`), 700);
    } catch (e) {
      notify("失败：" + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ---- 生成单个判包商 PO ----
  async function generatePO(subId: string) {
    if (!clientId) return notify("请先选择客户");
    if (!projectId && !newProjName.trim()) return notify("请选择或填写工程");
    setSaving(true);
    const supabase = createClient();
    try {
      const pid = await ensureProject();
      const { data: pono } = await supabase.rpc("next_doc_no", {
        p_prefix: "PO",
      });
      const { data: doc, error: de } = await supabase
        .from("documents")
        .insert({
          doc_no: pono,
          type: "purchase_order",
          project_id: pid,
          subcontractor_id: subId,
          status: "draft",
        })
        .select("id, doc_no")
        .single();
      if (de) throw de;

      const rows: Record<string, unknown>[] = [];
      sections.forEach((sec, si) =>
        sec.items.forEach((it, li) => {
          if (it.subcontractor_id !== subId) return;
          rows.push({
            document_id: doc.id,
            section_name: sec.name,
            section_order: si,
            line_order: li,
            description: it.description,
            qty: 1,
            cost: it.cost || 0,
            manual_price: it.cost || 0, // PO 金额=成本
            subcontractor_id: subId,
          });
        })
      );
      if (rows.length) {
        const { error } = await supabase.from("line_items").insert(rows);
        if (error) throw error;
      }
      notify(`已生成 ${subById(subId)} 的 ${doc.doc_no}（原始成本）📋`);
    } catch (e) {
      notify("失败：" + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ---- staff / loading guards ----
  if (roleLoaded && role === "staff") {
    return (
      <>
        <Topbar crumb="MARKUP WORKBENCH" title="判包报价 → 加成" />
        <div className="px-[30px] pt-[26px] pb-[60px]">
          <div className="bg-paper-2 border border-dashed border-line rounded-xl p-12 text-center text-[#9a938a]">
            <div className="font-sans font-bold text-[15px] mb-1">
              🔒 此页面仅限老板 (Owner) 查看
            </div>
            <p className="text-[13px]">判包成本与加成属机密数据。</p>
          </div>
        </div>
      </>
    );
  }

  const cellCost =
    "w-full px-2 py-1.5 border border-line rounded-md bg-amber-soft/50 text-right font-mono text-[13px] text-[#8a5a2b] font-semibold focus:outline-none focus:border-moss focus:bg-white";

  return (
    <>
      <Topbar crumb="MARKUP WORKBENCH" title="判包报价 → 加成" />

      <div className="px-[30px] pt-[26px] pb-[60px]">
        {!configured && (
          <div className="mb-5 rounded-xl bg-amber-soft border border-amber/40 px-5 py-4 text-[13px] text-[#a8681e]">
            未连接 Supabase。
          </div>
        )}

        {/* intro */}
        <div className="rounded-xl p-[18px_22px] mb-5 flex items-center gap-4 text-white bg-gradient-to-br from-forest to-forest-2">
          <div className="w-11 h-11 rounded-lg grid place-items-center flex-none bg-amber/20 border border-amber/40 text-amber text-xl font-mono">
            $
          </div>
          <div>
            <b className="font-sans text-[14px] block mb-0.5">
              判包报价加成工作台 · Sub-con Cost → Client Price
            </b>
            <p className="text-[12px] text-sage leading-snug">
              输入判包商给你的成本，设定加成，系统自动算客户价 +
              每行毛利。可一键转客户版 Quotation（PDF 不含成本），或按判包商自动拆
              PO。
            </p>
          </div>
        </div>

        {/* context */}
        <div className="grid grid-cols-[1.3fr_1.3fr_1fr] gap-0 bg-card border border-line rounded-xl overflow-hidden mb-4.5 mb-[18px] max-[900px]:grid-cols-2">
          <div className="p-[14px_18px] border-r border-paper-2">
            <label className="block font-mono text-[9.5px] tracking-tight uppercase text-moss mb-1.5">
              客户 Client
            </label>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setProjectId("");
              }}
              className="w-full px-2.5 py-2 border border-line rounded-md bg-paper text-[13.5px] focus:outline-none focus:border-moss focus:bg-white"
            >
              <option value="">— 选择 —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="p-[14px_18px] border-r border-paper-2">
            <label className="block font-mono text-[9.5px] tracking-tight uppercase text-moss mb-1.5">
              工程 Project
            </label>
            {projects.length > 0 ? (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-2.5 py-2 border border-line rounded-md bg-paper text-[13.5px] focus:outline-none focus:border-moss focus:bg-white"
              >
                <option value="">+ 新工程（下方填名）</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={newProjName}
                onChange={(e) => setNewProjName(e.target.value)}
                placeholder="新工程名称"
                className="w-full px-2.5 py-2 border border-line rounded-md bg-paper text-[13.5px] focus:outline-none focus:border-moss focus:bg-white"
              />
            )}
            {projects.length > 0 && !projectId && (
              <input
                value={newProjName}
                onChange={(e) => setNewProjName(e.target.value)}
                placeholder="新工程名称"
                className="w-full mt-1.5 px-2.5 py-2 border border-line rounded-md bg-paper text-[13px] focus:outline-none focus:border-moss focus:bg-white"
              />
            )}
          </div>
          <div className="p-[14px_18px] flex flex-col justify-center bg-forest text-white">
            <span className="font-mono text-[9px] text-sage tracking-tight">
              这批成本归属
            </span>
            <span className="font-sans font-bold text-[13px]">
              {clients.find((c) => c.id === clientId)?.name ?? "—"} ·{" "}
              {projects.find((p) => p.id === projectId)?.name ||
                newProjName ||
                "—"}
            </span>
          </div>
        </div>

        {/* controls */}
        <div className="flex gap-3 items-center bg-card border border-line rounded-xl p-[14px_18px] mb-4 flex-wrap">
          <span className="font-mono text-[10px] tracking-tight uppercase text-moss">
            加成方式：
          </span>
          <div className="flex bg-paper border border-line rounded-lg overflow-hidden">
            {(
              [
                ["global", "整单统一 %"],
                ["line", "逐行不同 %"],
                ["manual", "手动定价"],
              ] as [MarkupMode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3.5 py-2 font-sans text-[12.5px] font-semibold transition ${
                  mode === m ? "bg-forest text-white" : "text-[#7a8580]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "global" && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase text-moss">
                全部加成
              </span>
              <span className="font-mono text-moss">×</span>
              <input
                type="number"
                value={globalPct}
                step={5}
                onChange={(e) => setGlobalPct(+e.target.value)}
                className="w-[70px] px-2.5 py-2 border border-line rounded-md font-mono text-[14px] font-semibold text-center bg-amber-soft text-[#a8681e] focus:outline-none focus:border-moss"
              />
              <span className="font-mono text-moss">%</span>
            </div>
          )}
          <div className="flex-1" />
          <Btn onClick={() => setImportOpen(true)}>📋 批量导入</Btn>
          <Btn
            variant="amber"
            onClick={toQuotation}
            disabled={saving || !configured}
          >
            转成客户报价 →
          </Btn>
        </div>

        {/* table */}
        <div className="bg-card border border-line rounded-xl overflow-hidden shadow-card">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {[
                  ["#", "left", "w-8"],
                  ["项目描述", "left", ""],
                  ["判包商", "left", ""],
                  ["判包成本", "right", ""],
                  ["加成 %", "right", ""],
                  ["客户价", "right", ""],
                  ["毛利", "right", ""],
                ].map(([h, align, w], i) => (
                  <th
                    key={i}
                    className={`font-mono text-[9.5px] tracking-tight uppercase text-moss px-3.5 py-2.5 bg-paper-2 border-b border-line font-semibold text-${align} ${w}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((sec, si) => (
                <SectionRows key={sec.key}>
                  <tr>
                    <td
                      colSpan={7}
                      className="bg-paper px-3.5 py-2 border-b border-paper-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-white bg-moss w-5 h-5 rounded grid place-items-center flex-none">
                          {sectionCode(si)}
                        </span>
                        <input
                          value={sec.name}
                          onChange={(e) =>
                            patch((d) => (d[si].name = e.target.value))
                          }
                          className="bg-transparent font-mono text-[10px] tracking-tight uppercase text-moss font-semibold px-1.5 py-1 rounded hover:bg-paper-2 focus:outline-none focus:bg-white focus:text-ink"
                        />
                        <button
                          onClick={() =>
                            setSections((p) =>
                              p.length <= 1 ? p : p.filter((_, i) => i !== si)
                            )
                          }
                          className="text-brick/40 hover:text-brick text-[13px]"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                  {sec.items.map((it, li) => {
                    const price = priceOf(it, mode, globalPct);
                    const profit = price - (it.cost || 0);
                    return (
                      <tr key={it.key} className="border-b border-paper-2">
                        <td className="px-3.5 py-2.5 text-[#8a938e] text-[12px]">
                          {li + 1}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <input
                            value={it.description}
                            onChange={(e) =>
                              patch(
                                (d) =>
                                  (d[si].items[li].description = e.target.value)
                              )
                            }
                            placeholder="项目描述"
                            className="w-full px-2 py-1.5 border border-line rounded-md bg-paper text-[13px] focus:outline-none focus:border-moss focus:bg-white"
                          />
                        </td>
                        <td className="px-3.5 py-2.5">
                          <select
                            value={it.subcontractor_id ?? ""}
                            onChange={(e) =>
                              patch(
                                (d) =>
                                  (d[si].items[li].subcontractor_id =
                                    e.target.value || null)
                              )
                            }
                            className="min-w-[130px] px-2 py-1.5 text-[11.5px] border border-line rounded-md bg-white focus:outline-none focus:border-moss"
                          >
                            <option value="">判包商…</option>
                            {subs.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.company_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <input
                            type="number"
                            value={it.cost || ""}
                            onChange={(e) =>
                              patch(
                                (d) => (d[si].items[li].cost = +e.target.value)
                              )
                            }
                            placeholder="0"
                            className={cellCost}
                          />
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          {mode === "global" ? (
                            <span className="font-mono text-[#b0a89a]">
                              {globalPct}%
                            </span>
                          ) : mode === "line" ? (
                            <input
                              type="number"
                              value={it.markupPct}
                              onChange={(e) =>
                                patch(
                                  (d) =>
                                    (d[si].items[li].markupPct =
                                      +e.target.value)
                                )
                              }
                              className="w-16 px-2 py-1.5 border border-line rounded-md font-mono text-[13px] text-center bg-amber-soft text-[#a8681e] font-semibold focus:outline-none focus:border-moss"
                            />
                          ) : (
                            <span className="font-mono text-[11px] text-[#b0a89a]">
                              {it.cost
                                ? Math.round((profit / it.cost) * 100)
                                : 0}
                              %
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          {mode === "manual" ? (
                            <input
                              type="number"
                              value={
                                it.manualPrice != null ? it.manualPrice : price
                              }
                              onChange={(e) =>
                                patch(
                                  (d) =>
                                    (d[si].items[li].manualPrice =
                                      +e.target.value)
                                )
                              }
                              className="w-[90px] px-2 py-1.5 border border-moss rounded-md font-mono text-[13px] text-right font-semibold text-forest bg-white focus:outline-none"
                            />
                          ) : (
                            <span className="font-mono font-bold text-forest text-[14px]">
                              {rm(price)}
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-ok font-semibold text-[12px]">
                          +{rm(profit)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={7} className="px-3.5 py-2">
                      <button
                        onClick={() =>
                          patch((d) => d[si].items.push(emptyLine()))
                        }
                        className="text-[12px] text-moss font-semibold hover:text-forest"
                      >
                        + 添加 {sectionCode(si)} 项目
                      </button>
                    </td>
                  </tr>
                </SectionRows>
              ))}
              <tr className="border-t-2 border-forest bg-paper font-bold">
                <td />
                <td className="px-3.5 py-3.5 font-sans font-bold">合计 Total</td>
                <td />
                <td className="px-3.5 py-3.5 text-right font-mono text-[#8a5a2b]">
                  {rm(totals.cost)}
                </td>
                <td />
                <td className="px-3.5 py-3.5 text-right">
                  <span className="font-mono text-forest font-bold text-[17px]">
                    {rm(totals.price)}
                  </span>
                </td>
                <td className="px-3.5 py-3.5 text-right">
                  <span className="font-sans font-extrabold text-forest text-[15px]">
                    +{rm(totals.margin)}
                    <span className="font-mono text-[11px] bg-forest text-amber px-2 py-0.5 rounded ml-1.5">
                      {totals.marginPct}%
                    </span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <button
          onClick={() =>
            setSections((p) => [
              ...p,
              { key: uid(), name: "新工种 New Trade", items: [emptyLine()] },
            ])
          }
          className="font-sans text-[12.5px] font-semibold text-forest bg-paper-2 border border-dashed border-moss rounded-lg p-[11px] w-full mt-3 hover:bg-paper transition"
        >
          + 添加新 Section（工种）
        </button>

        {/* PO split */}
        <div className="bg-card border border-line rounded-xl p-[18px_20px] mt-4.5 mt-[18px]">
          <h4 className="font-sans text-[13px] font-bold mb-1 flex items-center gap-2">
            <span className="text-brick">▲</span> 自动拆分：给判包商的采购单 (PO)
          </h4>
          <p className="text-[11.5px] text-[#8a938e] mb-3.5">
            按 subcon 归属自动分组——每个判包商各生成一张 PO，只含他负责的项目 +
            原始成本（不含加成）。
          </p>
          {groups.size === 0 ? (
            <p className="text-[12px] text-[#9a938a] font-mono">
              给上面的行选好判包商后，这里会自动出现每个判包商的 PO 卡片。
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
              {[...groups.entries()].map(([id, g]) => (
                <div
                  key={id}
                  className="relative border border-line rounded-lg p-[13px_15px] bg-paper"
                >
                  <button
                    onClick={() => generatePO(id)}
                    disabled={saving}
                    className="absolute top-3 right-3 font-mono text-[9px] text-moss border border-line px-1.5 py-0.5 rounded bg-white hover:border-moss"
                  >
                    生成 PO →
                  </button>
                  <div className="font-sans font-bold text-[13px] flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full bg-moss" />
                    {g.name}
                  </div>
                  <div className="text-[11.5px] text-[#6b7570] leading-[1.7]">
                    {g.lines.map((l, i) => (
                      <div key={i}>• {l.d}</div>
                    ))}
                  </div>
                  <div className="font-mono font-bold text-[#8a5a2b] mt-2.5 pt-2.5 border-t border-dashed border-line flex justify-between text-[13px]">
                    <span>PO 成本</span>
                    <span>{rm(g.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {importOpen && (
        <Modal title="📋 批量导入项目" onClose={() => setImportOpen(false)}>
          <p className="text-[12.5px] text-[#6b7570] mb-3 leading-relaxed">
            从判包商的 Excel / 报价单直接
            <b>复制整块粘贴</b>到下面。每行一个项目，系统自动识别
            <b>描述</b>和<b>成本</b>（取每行最后一个纯数字）。没有数字的行会当成
            <b>工种标题</b>。
          </p>

          <label className="font-mono text-[10px] uppercase text-moss mb-1.5 block">
            这批来自哪个判包商（可选，套用到全部行）
          </label>
          <select
            value={importSub}
            onChange={(e) => setImportSub(e.target.value)}
            className="w-full px-2.5 py-2 border border-line rounded-md bg-paper text-[13px] mb-3 focus:outline-none focus:border-moss"
          >
            <option value="">— 不指定 —</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.company_name}
              </option>
            ))}
          </select>

          <label className="font-mono text-[10px] uppercase text-moss mb-1.5 block">
            粘贴内容
          </label>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={
              "干厨房\n鞋柜 2400mm  3360\n中岛 1800mm  2400\n湿厨房\n上下橱柜  9450\n\n（也支持：描述,成本 或从 Excel 直接复制）"
            }
            className="w-full min-h-[200px] border border-line rounded-lg px-3 py-2.5 text-[12.5px] font-mono bg-paper resize-y focus:outline-none focus:border-moss focus:bg-white"
          />

          {importText.trim() && (
            <div className="mt-2 text-[11.5px] text-moss font-mono">
              {(() => {
                const p = parseBulkMarkup(importText, globalPct);
                const n = p.reduce((a, s) => a + s.items.length, 0);
                const cost = p.reduce(
                  (a, s) => a + s.items.reduce((b, i) => b + i.cost, 0),
                  0
                );
                return `预览：${n} 个项目 · ${p.length} 个工种 · 成本合计 ${rm(cost)}`;
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

function SectionRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
