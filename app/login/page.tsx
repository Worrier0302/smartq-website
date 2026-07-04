"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/logo";

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseConfigured) {
      setError("尚未配置 Supabase 环境变量（.env.local）");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError("登录失败：邮箱或密码不正确");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-[380px]">
        {/* 品牌 */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <LogoMark size={44} variant="dark" />
          <div>
            <b className="block font-sans font-extrabold text-xl tracking-tight text-ink">
              Smart&nbsp;Q
            </b>
            <span className="font-mono text-[10px] tracking-widest text-moss uppercase">
              Admin System
            </span>
          </div>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-card border border-line rounded-xl p-7 shadow-card"
        >
          <h1 className="font-sans font-bold text-base mb-1">
            登录 Sign In
          </h1>
          <p className="text-xs text-moss mb-6">
            Smart HQME Solution Enterprise 内部系统
          </p>

          {!supabaseConfigured && (
            <div className="mb-5 rounded-lg bg-amber-soft border border-amber/40 px-4 py-3 text-xs leading-relaxed text-[#a8681e]">
              <b className="font-mono">SETUP</b> — 还没接上
              Supabase。请在项目根目录建 <code>.env.local</code>{" "}
              填入环境变量（见 <code>.env.local.example</code>），重启 dev
              server 后此提示消失。
            </div>
          )}

          <div className="mb-4">
            <label className="block font-mono text-[11px] tracking-wide uppercase text-moss mb-1.5">
              邮箱 Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-line rounded-lg bg-paper text-sm text-ink focus:outline-none focus:border-moss focus:bg-white focus:ring-[3px] focus:ring-moss/10 transition"
              placeholder="you@smartq.com"
            />
          </div>
          <div className="mb-6">
            <label className="block font-mono text-[11px] tracking-wide uppercase text-moss mb-1.5">
              密码 Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-line rounded-lg bg-paper text-sm text-ink focus:outline-none focus:border-moss focus:bg-white focus:ring-[3px] focus:ring-moss/10 transition"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="mb-4 text-xs text-brick font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-forest text-white font-sans font-semibold text-sm hover:bg-forest-2 transition disabled:opacity-60"
          >
            {loading ? "登录中…" : "登录"}
          </button>
        </form>

        <p className="mt-6 text-center font-mono text-[10px] tracking-wider text-sage uppercase">
          Reg 202403276597 (JM1013409-A)
        </p>
      </div>
    </div>
  );
}
