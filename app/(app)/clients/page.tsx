"use client";

import { useCallback, useEffect, useState } from "react";
import { Topbar } from "@/components/topbar";
import { Btn, Field, inputCls, Modal, EmptyRow } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import type { Client } from "@/lib/types";

const empty = {
  name: "",
  phone: "",
  email: "",
  address_line1: "",
  address_line2: "",
  notes: "",
};

export default function ClientsPage() {
  const [rows, setRows] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
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
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    else setRows(data as Client[]);
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
  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      name: c.name ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      address_line1: c.address_line1 ?? "",
      address_line2: c.address_line2 ?? "",
      notes: c.notes ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const supabase = createClient();
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address_line1: form.address_line1.trim() || null,
      address_line2: form.address_line2.trim() || null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from("clients").update(payload).eq("id", editing.id)
      : await supabase.from("clients").insert(payload);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setOpen(false);
    load();
  }

  async function remove(c: Client) {
    if (!confirm(`删除客户「${c.name}」？（已关联工程会被数据库拦截）`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("clients").delete().eq("id", c.id);
    if (error) {
      alert("删除失败：" + error.message);
      return;
    }
    load();
  }

  return (
    <>
      <Topbar crumb="CLIENTS" title="客户资料库">
        <Btn variant="primary" onClick={openNew} disabled={!configured}>
          + 新增客户
        </Btn>
      </Topbar>

      <div className="px-[30px] pt-[26px] pb-[60px]">
        {!configured && <SetupNote />}
        {err && (
          <div className="mb-4 text-[13px] text-brick font-medium">
            出错：{err}
          </div>
        )}

        <div className="bg-card border border-line rounded-xl overflow-hidden shadow-card">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {["客户", "电话", "邮箱", "地址", "备注", ""].map((h, i) => (
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
                <EmptyRow colSpan={6} text="加载中…" />
              ) : rows.length === 0 ? (
                <EmptyRow
                  colSpan={6}
                  text={configured ? "还没有客户，点右上角新增。" : "接上 Supabase 后显示数据。"}
                />
              ) : (
                rows.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-paper-2 last:border-0 hover:bg-paper transition"
                  >
                    <td className="px-4 py-3 font-semibold">{c.name}</td>
                    <td className="px-4 py-3 text-[#8a938e] font-mono text-[12px]">
                      {c.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#8a938e] text-[12px]">
                      {c.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#8a938e] text-[12px]">
                      {[c.address_line1, c.address_line2]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#8a938e] text-[12px] max-w-[160px] truncate">
                      {c.notes || "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(c)}
                        className="font-mono text-[11px] text-moss hover:text-forest mr-3"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => remove(c)}
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
          title={editing ? "编辑客户" : "新增客户"}
          onClose={() => setOpen(false)}
        >
          <form onSubmit={save}>
            <Field label="姓名 Name *">
              <input
                required
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
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
            <Field label="地址 1 Address Line 1">
              <input
                className={inputCls}
                value={form.address_line1}
                onChange={(e) =>
                  setForm({ ...form, address_line1: e.target.value })
                }
              />
            </Field>
            <Field label="地址 2 Address Line 2">
              <input
                className={inputCls}
                value={form.address_line2}
                onChange={(e) =>
                  setForm({ ...form, address_line2: e.target.value })
                }
              />
            </Field>
            <Field label="备注 Notes">
              <textarea
                className={inputCls + " min-h-[70px] resize-y"}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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

function SetupNote() {
  return (
    <div className="mb-5 rounded-xl bg-amber-soft border border-amber/40 px-5 py-4 text-[13px] leading-relaxed text-[#a8681e]">
      <b className="font-mono text-[11px] tracking-wider">未连接</b> — 先在{" "}
      <code>.env.local</code> 配置 Supabase 并跑{" "}
      <code>supabase/schema.sql</code>，此页即可增删改查。
    </div>
  );
}
