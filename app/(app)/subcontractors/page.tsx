"use client";

import { useCallback, useEffect, useState } from "react";
import { Topbar } from "@/components/topbar";
import { Btn, Field, inputCls, Modal, EmptyRow } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import type { Subcontractor, Role } from "@/lib/types";

const empty = {
  company_name: "",
  contact_person: "",
  phone: "",
  email: "",
  trade: "",
  address: "",
};

export default function SubcontractorsPage() {
  const [rows, setRows] = useState<Subcontractor[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Subcontractor | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
    const { data, error } = await supabase
      .from("subcontractors")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    else setRows(data as Subcontractor[]);
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  }
  function openEdit(s: Subcontractor) {
    setEditing(s);
    setForm({
      company_name: s.company_name ?? "",
      contact_person: s.contact_person ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      trade: s.trade ?? "",
      address: s.address ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const supabase = createClient();
    const payload = {
      company_name: form.company_name.trim(),
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      trade: form.trade.trim() || null,
      address: form.address.trim() || null,
    };
    const { error } = editing
      ? await supabase
          .from("subcontractors")
          .update(payload)
          .eq("id", editing.id)
      : await supabase.from("subcontractors").insert(payload);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setOpen(false);
    load();
  }

  async function remove(s: Subcontractor) {
    if (!confirm(`删除判包商「${s.company_name}」？`)) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("subcontractors")
      .delete()
      .eq("id", s.id);
    if (error) {
      alert("删除失败：" + error.message);
      return;
    }
    load();
  }

  // staff 直接被 RLS 挡在门外；UI 也给出明确锁定提示
  if (configured && role === "staff") {
    return (
      <>
        <Topbar crumb="SUB-CONTRACTORS" title="判包商" />
        <div className="px-[30px] pt-[26px] pb-[60px]">
          <div className="bg-paper-2 border border-dashed border-line rounded-xl p-10 text-center text-[#9a938a]">
            <div className="font-sans font-bold text-[15px] mb-1">
              此页面仅限老板 (Owner) 查看
            </div>
            <p className="text-[13px]">判包商是成本来源，属机密数据。</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar crumb="SUB-CONTRACTORS" title="判包商">
        <span className="font-mono text-[10px] bg-amber-soft text-amber px-2 py-1 rounded self-center">
          含成本 · OWNER
        </span>
        <Btn variant="primary" onClick={openNew} disabled={!configured}>
          + 新增判包商
        </Btn>
      </Topbar>

      <div className="px-[30px] pt-[26px] pb-[60px]">
        {!configured && (
          <div className="mb-5 rounded-xl bg-amber-soft border border-amber/40 px-5 py-4 text-[13px] leading-relaxed text-[#a8681e]">
            <b className="font-mono text-[11px]">未连接</b> — 配置 Supabase
            并跑 schema.sql 后可用。
          </div>
        )}
        {err && (
          <div className="mb-4 text-[13px] text-brick font-medium">
            出错：{err}
          </div>
        )}

        <div className="bg-card border border-line rounded-xl overflow-hidden shadow-card">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {["公司 / 联系人", "专长", "电话", "邮箱", ""].map((h, i) => (
                  <th
                    key={i}
                    className="font-mono text-[10px] tracking-wide uppercase text-moss text-left px-4 py-3 bg-paper-2 border-b border-line font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <EmptyRow colSpan={5} text="加载中…" />
              ) : rows.length === 0 ? (
                <EmptyRow
                  colSpan={5}
                  text={configured ? "还没有判包商，点右上角新增。" : "接上 Supabase 后显示数据。"}
                />
              ) : (
                rows.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-paper-2 last:border-0 hover:bg-paper transition"
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold block">
                        {s.company_name}
                      </span>
                      {s.contact_person && (
                        <span className="text-[#8a938e] text-[12px]">
                          {s.contact_person}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#8a938e] text-[12px]">
                      {s.trade || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#8a938e] font-mono text-[12px]">
                      {s.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#8a938e] text-[12px]">
                      {s.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(s)}
                        className="font-mono text-[11px] text-moss hover:text-forest mr-3"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => remove(s)}
                        className="font-mono text-[11px] text-brick/70 hover:text-brick"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <Modal
          title={editing ? "编辑判包商" : "新增判包商"}
          onClose={() => setOpen(false)}
        >
          <form onSubmit={save}>
            <Field label="公司名称 Company *">
              <input
                required
                className={inputCls}
                value={form.company_name}
                onChange={(e) =>
                  setForm({ ...form, company_name: e.target.value })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="联系人 Contact">
                <input
                  className={inputCls}
                  value={form.contact_person}
                  onChange={(e) =>
                    setForm({ ...form, contact_person: e.target.value })
                  }
                />
              </Field>
              <Field label="专长 Trade">
                <input
                  className={inputCls}
                  placeholder="木工 / 石材 / 电工…"
                  value={form.trade}
                  onChange={(e) => setForm({ ...form, trade: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="电话 Phone">
                <input
                  className={inputCls}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="邮箱 Email">
                <input
                  className={inputCls}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
            </div>
            <Field label="地址 Address">
              <textarea
                className={inputCls + " min-h-[60px] resize-y"}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <div className="flex gap-2.5 mt-2">
              <Btn
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 justify-center"
              >
                取消
              </Btn>
              <Btn
                type="submit"
                variant="primary"
                disabled={saving}
                className="flex-1 justify-center"
              >
                {saving ? "保存中…" : "保存"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
