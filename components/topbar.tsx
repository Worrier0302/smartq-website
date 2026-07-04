"use client";

import { useLang } from "@/lib/i18n";

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex bg-paper-2 border border-line rounded-lg overflow-hidden self-center">
      <button
        onClick={() => setLang("zh")}
        className={`px-2.5 py-1.5 text-[12px] font-semibold transition ${
          lang === "zh" ? "bg-forest text-white" : "text-moss"
        }`}
      >
        中
      </button>
      <button
        onClick={() => setLang("en")}
        className={`px-2.5 py-1.5 text-[12px] font-semibold transition ${
          lang === "en" ? "bg-forest text-white" : "text-moss"
        }`}
      >
        EN
      </button>
    </div>
  );
}

export function Topbar({
  crumb,
  title,
  children,
}: {
  crumb: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-[30px] py-[18px] border-b border-line bg-paper sticky top-0 z-20">
      <div>
        <div className="font-mono text-[11px] text-moss tracking-wide mb-0.5 uppercase">
          SMART Q / {crumb}
        </div>
        <h1 className="font-sans font-extrabold text-[21px] tracking-tight">
          {title}
        </h1>
      </div>
      <div className="flex gap-2.5 items-center">
        {children}
        <LangToggle />
      </div>
    </div>
  );
}
