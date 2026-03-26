import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LayoutClient } from "./layout-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  let initialChats: any[] = [];

  try {
    const supabase = await createClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    user = authUser;

    if (user) {
      const { data } = await supabase
        .from("chats")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      initialChats = data || [];
    }
  } catch {
    // Supabase unreachable — treat as unauthenticated
  }

  if (!user) {
    return redirect("/login");
  }

  return (
    <LayoutClient initialChats={initialChats || []}>
      {children}
    </LayoutClient>
  );
}
