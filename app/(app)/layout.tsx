import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let fullName = "未连接 Supabase";
  let role: "owner" | "staff" = "owner";

  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    fullName = user.email ?? "User";
    // profiles 表在 PHASE 1 建；建好前查询失败就用默认值
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();
    if (profile) {
      fullName = profile.full_name ?? fullName;
      role = profile.role === "staff" ? "staff" : "owner";
    }
  }

  return (
    <div className="grid grid-cols-[230px_1fr] min-h-screen">
      <Sidebar fullName={fullName} role={role} />
      <div className="overflow-x-hidden">{children}</div>
    </div>
  );
}
