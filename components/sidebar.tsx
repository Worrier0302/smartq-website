"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  ownerOnly?: boolean;
};

const mainNav: NavItem[] = [
  {
    href: "/",
    label: "仪表板",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/documents",
    label: "所有单据",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h5" />
      </svg>
    ),
  },
  {
    href: "/projects",
    label: "工程 Projects",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M2 20h20M4 20V8l8-5 8 5v12M9 20v-6h6v6" />
      </svg>
    ),
  },
  {
    href: "/markup",
    label: "判包报价 → 加成",
    ownerOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    href: "/quote/new",
    label: "开新报价",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
];

const dataNav: NavItem[] = [
  {
    href: "/clients",
    label: "客户",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    ),
  },
  {
    href: "/subcontractors",
    label: "判包商",
    ownerOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M2 20h20M4 20V8l8-5 8 5v12M9 20v-6h6v6" />
      </svg>
    ),
  },
];

export function Sidebar({
  fullName,
  role,
}: {
  fullName: string;
  role: "owner" | "staff";
}) {
  const pathname = usePathname();
  const router = useRouter();

  const initials =
    fullName
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SQ";

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function renderItem(item: NavItem) {
    if (item.ownerOnly && role !== "owner") return null;
    const active =
      item.href === "/"
        ? pathname === "/"
        : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-[11px] px-[11px] py-[9px] rounded-lg text-[13.5px] font-medium transition border ${
          active
            ? "bg-forest-2 text-white border-sage/25 [&_svg]:text-amber"
            : "text-paper/70 border-transparent hover:bg-white/5 hover:text-white"
        }`}
      >
        <span className="w-[17px] h-[17px] flex-none [&_svg]:w-full [&_svg]:h-full [&_svg]:[stroke-width:1.8]">
          {item.icon}
        </span>
        {item.label}
      </Link>
    );
  }

  return (
    <aside className="bg-forest text-paper py-[22px] px-4 flex flex-col gap-1.5 sticky top-0 h-screen">
      {/* 品牌 */}
      <div className="flex items-center gap-2.5 px-2 pb-5 border-b border-white/10 mb-3.5">
        <div className="w-[34px] h-[34px] rounded-[7px] bg-amber text-ink grid place-items-center font-narrow font-bold text-lg tracking-tight">
          SQ
        </div>
        <div>
          <b className="block font-sans font-extrabold text-base tracking-tight text-white">
            Smart&nbsp;Q
          </b>
          <span className="font-mono text-[9.5px] tracking-[1px] text-sage uppercase">
            Admin System
          </span>
        </div>
      </div>

      <div className="font-mono text-[9.5px] tracking-[1.5px] text-sage uppercase pt-3.5 pb-1.5 px-2.5">
        主菜单
      </div>
      {mainNav.map(renderItem)}

      <div className="font-mono text-[9.5px] tracking-[1.5px] text-sage uppercase pt-3.5 pb-1.5 px-2.5">
        资料库
      </div>
      {dataNav.map(renderItem)}

      {role === "owner" && (
        <>
          <div className="font-mono text-[9.5px] tracking-[1.5px] text-sage uppercase pt-3.5 pb-1.5 px-2.5">
            设置
          </div>
          {renderItem({
            href: "/settings/terms",
            label: "条款模板",
            ownerOnly: true,
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            ),
          })}
        </>
      )}

      <div className="flex-1" />

      {/* 用户信息 */}
      <div className="flex items-center gap-2.5 p-2.5 rounded-[9px] bg-black/20">
        <div className="w-[30px] h-[30px] rounded-full bg-sage text-forest grid place-items-center font-bold text-[13px] flex-none">
          {initials}
        </div>
        <div className="min-w-0">
          <b className="block text-[12.5px] text-white font-semibold truncate">
            {fullName}
          </b>
          <small className="block text-[11px] text-sage font-mono uppercase">
            {role}
          </small>
        </div>
      </div>
      <button
        onClick={signOut}
        className="mt-2 font-mono text-[10px] tracking-wide text-sage border border-sage/30 rounded-[5px] px-2 py-1 hover:border-amber hover:text-amber transition self-start"
      >
        登出 SIGN OUT ↩
      </button>
    </aside>
  );
}
