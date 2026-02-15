import { NextRequest, NextResponse } from "next/server";
import { syncCatalog } from "@/lib/catalogSync";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // Auth check
  const secret = process.env.CATALOG_SYNC_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncCatalog();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/catalog/sync] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
