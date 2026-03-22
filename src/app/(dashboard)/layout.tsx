import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LayoutClient } from "./layout-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const { data: initialChats } = await supabase
    .from("chats")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (
    <LayoutClient initialChats={initialChats || []}>
      {children}
    </LayoutClient>
  );
}
