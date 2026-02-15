import { NextResponse } from "next/server";
import { readCatalogJson } from "@/lib/blobStorage";

export const revalidate = 3600;

export async function GET() {
  try {
    const cars = await readCatalogJson();
    return NextResponse.json(cars);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/catalog] Error:", message);
    return NextResponse.json([], { status: 200 });
  }
}
