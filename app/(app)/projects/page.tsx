"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { EmptyRow } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { PROJECT_STATUS } from "@/lib/projectmeta";

type ProjRow = {
  id: string;
  code: string | null;
  name: string;
  status: string;
  site_address: string | null;
  client: { name: string } | null;
  docCount: number;
};

export default function ProjectsPage() {
  const configured = isSupabaseConfigured();
  const [rows, setRows] = useState<ProjRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!configured) return setLoading(false);
    setLoading(true);
    const supabase = createClient();
    const { data: projs } = await supabase
      .from("projects")
      .select("id, code, name, status, site_address, client:clients(name)")
      .order("created_at", { ascending: false });

    const list = (projs ?? []) as unknown as Omit<ProjRow, "docCount">[];
    // doc counts
    const counts = new Map<string, number>();
    if (list.length) {
      const { data: docs } = await supabase
        .from("documents")
        .select("project_id")
        .in(
          "project_id",
          list.map((p) => p.id)
        );
      (docs ?? []).forEach((d) => {
        if (d.project_id)
          counts.set(d.project_id, (counts.get(d.project_id) ?? 0) + 1);
      });
    }
    setRows(list.map((p) => ({ ...p, docCount: counts.get(p.id) ?? 0 })));
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Topbar crumb="PROJECTS" title="工程 Projects" />
      <div className="px-[30px] pt-[26px] pb-[60px]">
        {!configured && (
          <div className="mb-5 rounded-xl bg-amber-soft border border-amber/40 px-5 py-4 text-[13px] text-[#a8681e]">
            未连接 Supabase。
          </div>
        )}
        <div className="bg-card border border-line rounded-xl overflow-hidden shadow-card">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {["工程编号", "工程名称", "客户", "工地", "单据数", "状态"].map(
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
                <EmptyRow colSpan={6} text="加载中…" />
              ) : rows.length === 0 ? (
                <EmptyRow
                  colSpan={6}
                  text={
                    configured
                      ? "还没有工程 —— 开一张报价会自动创建工程。"
                      : "接上 Supabase 后显示。"
                  }
                />
              ) : (
                rows.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-paper-2 last:border-0 hover:bg-paper transition"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/projects/${p.id}`}
                        className="font-mono font-semibold text-forest hover:underline"
                      >
                        {p.code ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold">{p.name}</td>
                    <td className="px-4 py-3 text-[#6b7570]">
                      {p.client?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[#8a938e] text-[12px]">
                      {p.site_address ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px]">
                      {p.docCount}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] px-2 py-1 rounded bg-paper-2 text-moss">
                        {PROJECT_STATUS[p.status] ?? p.status}
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
