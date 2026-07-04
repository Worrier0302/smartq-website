"use client";

import { useCallback, useEffect, useState } from "react";
import { Topbar } from "@/components/topbar";
import { Btn } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import type { Role } from "@/lib/types";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type Stage = { key: string; stage_name: string; pct: number; condition_text: string };
type Tpl = {
  id: string;
  name: string;
  included: string;
  excluded: string;
  dlp: string;
  conditions: string;
  stages: Stage[];
  is_default: boolean;
};

function parseStages(raw: unknown): Stage[] {
  const arr = (raw as unknown[]) ?? [];
  return arr.map((s) => {
    const o = s as { stage_name?: string; pct?: number; condition_text?: string };
    return {
      key: uid(),
      stage_name: o.stage_name ?? "",
      pct: Number(o.pct) || 0,
      condition_text: o.condition_text ?? "",
    };
  });
}

export default function TermsSettingsPage() {
  const configured = isSupabaseConfigured();
  const [role, setRole] = useState<Role>("owner");
  const [loaded, setLoaded] = useState(false);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [selId, setSelId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  const load = useCallback(async () => {
    if (!configured) return setLoaded(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setRole((p?.role as Role) ?? "staff");
    }
    const { data } = await supabase
      .from("term_templates")
      .select("*")
      .order("is_default", { ascending: false })
      .order("name");
    const list: Tpl[] = (data ?? []).map((t) => ({
      id: t.id,
      name: t.name ?? "未命名",
      included: t.included ?? "",
      excluded: t.excluded ?? "",
      dlp: t.dlp ?? "",
      conditions: t.conditions ?? "",
      stages: parseStages(t.payment_stages),
      is_default: !!t.is_default,
    }));
    setTpls(list);
    setSelId(list[0]?.id ?? "");
    setLoaded(true);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  const sel = tpls.find((t) => t.id === selId);
  const patch = (fn: (t: Tpl) => void) =>
    setTpls((prev) =>
      prev.map((t) => {
        if (t.id !== selId) return t;
        const copy = { ...t, stages: t.stages.map((s) => ({ ...s })) };
        fn(copy);
        return copy;
      })
    );

  async function addTemplate() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("term_templates")
      .insert({
        name: "新模板",
        included: "",
        excluded: "",
        dlp: "",
        conditions: "",
        payment_stages: [],
        is_default: false,
      })
      .select("*")
      .single();
    if (error) return notify("新建失败：" + error.message);
    const t: Tpl = {
      id: data.id,
      name: data.name,
      included: "",
      excluded: "",
      dlp: "",
      conditions: "",
      stages: [],
      is_default: false,
    };
    setTpls((p) => [...p, t]);
    setSelId(t.id);
    notify("已新建模板，改好名字和内容后记得保存");
  }

  async function saveTemplate() {
    if (!sel) return;
    setSaving(true);
    const supabase = createClient();
    // 若设为默认，先把其它取消默认
    if (sel.is_default) {
      await supabase
        .from("term_templates")
        .update({ is_default: false })
        .neq("id", sel.id);
    }
    const { error } = await supabase
      .from("term_templates")
      .update({
        name: sel.name.trim() || "未命名",
        included: sel.included,
        excluded: sel.excluded,
        dlp: sel.dlp,
        conditions: sel.conditions,
        is_default: sel.is_default,
        payment_stages: sel.stages.map((s) => ({
          stage_name: s.stage_name,
          pct: s.pct,
          condition_text: s.condition_text,
        })),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sel.id);
    setSaving(false);
    if (error) return notify("保存失败：" + error.message);
    notify(`已保存「${sel.name}」✓`);
    load();
  }

  async function deleteTemplate() {
    if (!sel) return;
    if (tpls.length <= 1) return notify("至少保留一个模板");
    if (!confirm(`删除模板「${sel.name}」？`)) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("term_templates")
      .delete()
      .eq("id", sel.id);
    if (error) return notify("删除失败：" + error.message);
    const rest = tpls.filter((t) => t.id !== sel.id);
    setTpls(rest);
    setSelId(rest[0]?.id ?? "");
    notify("已删除");
  }

  if (loaded && role === "staff") {
    return (
      <>
        <Topbar crumb="SETTINGS / TERMS" title="条款模板" />
        <div className="px-[30px] pt-[26px]">
          <div className="bg-paper-2 border border-dashed border-line rounded-xl p-10 text-center text-[#9a938a]">
            <div className="font-sans font-bold text-[15px] mb-1">
              🔒 仅限老板 (Owner) 编辑
            </div>
          </div>
        </div>
      </>
    );
  }

  const totalPct = sel ? sel.stages.reduce((a, s) => a + (Number(s.pct) || 0), 0) : 0;
  const ta =
    "w-full border border-line rounded-lg px-3 py-2.5 text-[13px] leading-[1.7] bg-paper resize-y text-ink focus:outline-none focus:border-moss focus:bg-white";
  const label =
    "font-mono text-[10px] tracking-wide uppercase text-moss mb-1.5 block mt-4";

  return (
    <>
      <Topbar crumb="SETTINGS / TERMS" title="条款模板">
        <Btn variant="primary" onClick={saveTemplate} disabled={saving || !sel}>
          {saving ? "保存中…" : "保存模板"}
        </Btn>
      </Topbar>

      <div className="px-[30px] pt-[26px] pb-[60px] max-w-[760px]">
        <p className="text-[13px] text-[#6b7570] mb-4">
          建立多个条款模板（例如 木工 / 水电 / 智能家居），开新报价时勾选要套用的模板即可。改了这里只影响之后开的新报价。
        </p>

        {/* 模板选择器 */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {tpls.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelId(t.id)}
              className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold border transition ${
                t.id === selId
                  ? "bg-forest text-white border-forest"
                  : "bg-card text-moss border-line hover:border-moss"
              }`}
            >
              {t.name}
              {t.is_default && (
                <span className="ml-1.5 text-[9px] opacity-80">默认</span>
              )}
            </button>
          ))}
          <button
            onClick={addTemplate}
            className="px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold border border-dashed border-moss text-forest bg-paper-2 hover:bg-paper"
          >
            + 新建模板
          </button>
        </div>

        {!sel ? (
          <div className="text-[13px] text-[#9a938a]">
            {configured ? "还没有模板，点「+ 新建模板」。" : "接上 Supabase 后显示。"}
          </div>
        ) : (
          <div className="bg-card border border-line rounded-xl p-5 shadow-card">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <span className={label + " !mt-0"}>模板名称</span>
                <input
                  className={ta.replace("resize-y", "")}
                  value={sel.name}
                  onChange={(e) => patch((t) => (t.name = e.target.value))}
                  placeholder="例如：木工模板"
                />
              </div>
              <label className="flex items-center gap-2 text-[12.5px] text-ink pb-2.5">
                <input
                  type="checkbox"
                  checked={sel.is_default}
                  onChange={(e) => patch((t) => (t.is_default = e.target.checked))}
                  className="accent-[var(--forest)] w-4 h-4"
                />
                设为默认
              </label>
              <button
                onClick={deleteTemplate}
                className="text-[12px] text-brick/70 hover:text-brick pb-2.5"
              >
                删除此模板
              </button>
            </div>

            <span className={label}>付款时程 Payment Schedule</span>
            {sel.stages.map((s, i) => (
              <div
                key={s.key}
                className="grid grid-cols-[1.4fr_60px_1fr_24px] gap-2 items-center mb-2"
              >
                <input
                  value={s.stage_name}
                  onChange={(e) =>
                    patch((t) => (t.stages[i].stage_name = e.target.value))
                  }
                  className="px-2.5 py-2 border border-line rounded-md bg-paper text-[13px] focus:outline-none focus:border-moss focus:bg-white"
                />
                <input
                  type="number"
                  value={s.pct || ""}
                  onChange={(e) => patch((t) => (t.stages[i].pct = +e.target.value))}
                  className="px-2 py-2 text-center font-mono border border-line rounded-md bg-amber-soft text-[#a8681e] font-semibold text-[13px] focus:outline-none focus:border-moss"
                />
                <input
                  value={s.condition_text}
                  onChange={(e) =>
                    patch((t) => (t.stages[i].condition_text = e.target.value))
                  }
                  className="px-2.5 py-2 border border-line rounded-md bg-paper text-[13px] focus:outline-none focus:border-moss focus:bg-white"
                />
                <button
                  onClick={() =>
                    patch((t) => t.stages.splice(i, 1))
                  }
                  className="text-brick/50 hover:text-brick text-[15px]"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <button
                onClick={() =>
                  patch((t) =>
                    t.stages.push({
                      key: uid(),
                      stage_name: "新阶段",
                      pct: 0,
                      condition_text: "",
                    })
                  )
                }
                className="text-[11.5px] text-moss font-semibold hover:text-forest"
              >
                + 加阶段
              </button>
              <span
                className={`font-mono text-[11px] ${
                  totalPct === 100 ? "text-[#8a938e]" : "text-brick"
                }`}
              >
                合计 {totalPct}%{totalPct === 100 ? " ✓" : ""}
              </span>
            </div>

            <span className={label}>✓ 包含 What&apos;s Included</span>
            <textarea
              className={ta}
              style={{ minHeight: 80 }}
              value={sel.included}
              onChange={(e) => patch((t) => (t.included = e.target.value))}
            />
            <span className={label}>✗ 不包含 Not Included</span>
            <textarea
              className={ta}
              style={{ minHeight: 80 }}
              value={sel.excluded}
              onChange={(e) => patch((t) => (t.excluded = e.target.value))}
            />
            <span className={label}>🛡 DLP 保固期</span>
            <textarea
              className={ta}
              style={{ minHeight: 60 }}
              value={sel.dlp}
              onChange={(e) => patch((t) => (t.dlp = e.target.value))}
            />
            <span className={label}>§ 条款 Terms &amp; Conditions</span>
            <textarea
              className={ta}
              style={{ minHeight: 120 }}
              value={sel.conditions}
              onChange={(e) => patch((t) => (t.conditions = e.target.value))}
            />
            <p className="text-[11px] text-[#8a938e] mt-3 font-mono">
              💡 一行一条。开报价时每条会变成可勾选项，勾了才进报价。
            </p>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-forest text-white px-5 py-3 rounded-lg text-[13px] font-semibold shadow-doc z-50">
          {toast}
        </div>
      )}
    </>
  );
}
