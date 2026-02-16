import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncCatalog } from "@/lib/catalogSync";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Vercel Cron sends GET with Authorization: Bearer {CRON_SECRET}
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncCatalog();
    revalidatePath("/catalog", "page");
    revalidatePath("/", "page");
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/catalog/sync] Cron error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Manual trigger with CATALOG_SYNC_SECRET
  const secret = process.env.CATALOG_SYNC_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncCatalog();
    revalidatePath("/catalog", "page");
    revalidatePath("/", "page");
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/catalog/sync] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
