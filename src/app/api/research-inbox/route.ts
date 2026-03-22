import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/research-inbox
 *
 * Lists research goals for the authenticated user, filterable by status.
 * Default: pending goals (awaiting approval).
 *
 * Query params:
 *   status  — comma-separated statuses (default: "pending")
 *   limit   — max results (default: 50, max: 100)
 *   offset  — pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const statusParam = searchParams.get("status") ?? "pending";
  const statuses = statusParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const rawLimit = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Number.isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 100);

  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

  let query = supabase
    .from("research_goals")
    .select(
      `
      id,
      title,
      instructions,
      status,
      goal_type,
      confidence,
      run_at,
      result_report_id,
      feedback,
      created_at,
      gap:gap_id (
        id,
        topic,
        gap_description
      )
    `,
      { count: "exact" }
    )
    .eq("user_id", user.id)
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ goals: data ?? [], total: count ?? 0 });
}
