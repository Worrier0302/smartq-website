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

export default function TermsSettingsPage() {
  const configured = isSupabaseConfigured();
  const [role, setRole] = useState<Role>("owner");
  const [loaded, setLoaded] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [included, setIncluded] = useState("");
  const [excluded, setExcluded] = useState("");
  const [dlp, setDlp] = useState("");
  const [conditions, setConditions] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
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
    const { data: t } = await supabase
      .from("term_templates")
      .select("*")
      .eq("is_default", true)
      .limit(1)
      .maybeSingle();
    if (t) {
      setId(t.id);
      setIncluded(t.included ?? "");
      setExcluded(t.excluded ?? "");
      setDlp(t.dlp ?? "");
      setConditions(t.conditions ?? "");
      const arr = (t.payment_stages as unknown[]) ?? [];
      setStages(
        arr.map((s) => {
          const o = s as { stage_name?: string; pct?: number; condition_text?: string };
          return {
            key: uid(),
            stage_name: o.stage_name ?? "",
            pct: Number(o.pct) || 0,
            condition_text: o.condition_text ?? "",
          };
        })
      );
    }
    setLoaded(true);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!id) return notify("没有可保存的模板");
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("term_templates")
      .update({
        included,
        excluded,
        dlp,
        conditions,
        payment_stages: stages.map((s) => ({
          stage_name: s.stage_name,
          pct: s.pct,
          condition_text: s.condition_text,
        })),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    setSaving(false);
    if (error) return notify("保存失败：" + error.message);
    notify("已保存默认模板 ✓");
  }

  const totalPct = stages.reduce((a, s) => a + (Number(s.pct) || 0), 0);

  if (loaded && role === "staff") {
    return (
      <>
        <Topbar crumb="SETTINGS / TERMS" title="条款默认模板" />
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

  const ta =
    "w-full border border-line rounded-lg px-3 py-2.5 text-[13px] leading-[1.7] bg-paper resize-y text-ink focus:outline-none focus:border-moss focus:bg-white";
  const label =
    "font-mono text-[10px] tracking-wide uppercase text-moss mb-1.5 block mt-4";

  return (
    <>
      <Topbar crumb="SETTINGS / TERMS" title="条款默认模板">
        <Btn variant="primary" onClick={save} disabled={saving || !configured}>
          {saving ? "保存中…" : "保存模板"}
        </Btn>
      </Topbar>

      <div className="px-[30px] pt-[26px] pb-[60px] max-w-[720px]">
        <p className="text-[13px] text-[#6b7570] mb-4">
          这里维护开新报价时自动带出的默认条款与付款时程。改了这里，之后每张新报价都会用新的默认值（已开的单据不受影响）。
        </p>

        <div className="bg-card border border-line rounded-xl p-5 shadow-card">
          <span className={label + " !mt-0"}>付款时程 Payment Schedule</span>
          {stages.map((s, i) => (
            <div
              key={s.key}
              className="grid grid-cols-[1.4fr_60px_1fr_24px] gap-2 items-center mb-2"
            >
              <input
                value={s.stage_name}
                onChange={(e) =>
                  setStages((p) =>
                    p.map((x, j) => (j === i ? { ...x, stage_name: e.target.value } : x))
                  )
                }
                className="px-2.5 py-2 border border-line rounded-md bg-paper text-[13px] focus:outline-none focus:border-moss focus:bg-white"
              />
              <input
                type="number"
                value={s.pct || ""}
                onChange={(e) =>
                  setStages((p) =>
                    p.map((x, j) => (j === i ? { ...x, pct: +e.target.value } : x))
                  )
                }
                className="px-2 py-2 text-center font-mono border border-line rounded-md bg-amber-soft text-[#a8681e] font-semibold text-[13px] focus:outline-none focus:border-moss"
              />
              <input
                value={s.condition_text}
                onChange={(e) =>
                  setStages((p) =>
                    p.map((x, j) => (j === i ? { ...x, condition_text: e.target.value } : x))
                  )
                }
                className="px-2.5 py-2 border border-line rounded-md bg-paper text-[13px] focus:outline-none focus:border-moss focus:bg-white"
              />
              <button
                onClick={() => setStages((p) => p.filter((_, j) => j !== i))}
                className="text-brick/50 hover:text-brick text-[15px]"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button
              onClick={() =>
                setStages((p) => [
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
                totalPct === 100 ? "text-[#8a938e]" : "text-brick"
              }`}
            >
              合计 {totalPct}%{totalPct === 100 ? " ✓" : " ⚠️ 应为 100%"}
            </span>
          </div>

          <span className={label}>✓ 包含 What&apos;s Included</span>
          <textarea className={ta} style={{ minHeight: 90 }} value={included} onChange={(e) => setIncluded(e.target.value)} />

          <span className={label}>✗ 不包含 Not Included</span>
          <textarea className={ta} style={{ minHeight: 90 }} value={excluded} onChange={(e) => setExcluded(e.target.value)} />

          <span className={label}>🛡 DLP 保固期</span>
          <textarea className={ta} style={{ minHeight: 70 }} value={dlp} onChange={(e) => setDlp(e.target.value)} />

          <span className={label}>§ 条款 Terms &amp; Conditions</span>
          <textarea className={ta} style={{ minHeight: 130 }} value={conditions} onChange={(e) => setConditions(e.target.value)} />
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
