import { NextRequest, NextResponse } from "next/server";
import { googleProxy } from "@/lib/google-proxy";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("latlng") ?? "";
  if (!/^-?\d{1,3}(\.\d{1,12})?,-?\d{1,3}(\.\d{1,12})?$/.test(raw))
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  const [lat, lng] = raw.split(",").map(Number);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  const type = req.nextUrl.searchParams.get("result_type");
  if (
    type &&
    !["street_address", "postal_code", "premise", "route", "country"].includes(
      type,
    )
  )
    return NextResponse.json({ error: "Invalid result type" }, { status: 400 });
  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key)
    return NextResponse.json(
      { error: "Location service unavailable" },
      { status: 503 },
    );
  const ip = req.headers.get("x-real-ip") ?? "unknown";
  const hash = createHash("sha256")
    .update(key + ":" + ip)
    .digest("hex");
  const { data, error } = await createAdminClient().rpc(
    "claim_public_geocode",
    { p_key: hash },
  );
  if (error)
    return NextResponse.json(
      { error: "Location service unavailable" },
      { status: 503 },
    );
  if (!data)
    return NextResponse.json(
      { error: "Please wait before trying again" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  const params = new URLSearchParams({ latlng: raw, key });
  if (type) params.set("result_type", type);
  const result = await googleProxy("geocode/json",params);
  return "error" in result ? NextResponse.json({error:result.error},{status:result.status}) : NextResponse.json(result.data);
}
