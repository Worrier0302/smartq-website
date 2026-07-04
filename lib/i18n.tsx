"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Lang = "zh" | "en";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "zh",
  setLang: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");
  useEffect(() => {
    try {
      const s = localStorage.getItem("lang");
      if (s === "en" || s === "zh") setLangState(s);
    } catch {}
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {}
  };
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

// t("中文", "English") -> 按当前语言返回
export function useLang() {
  const { lang, setLang } = useContext(Ctx);
  const t = (zh: string, en: string) => (lang === "en" ? en : zh);
  return { lang, setLang, t };
}
