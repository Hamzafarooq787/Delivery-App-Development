import { createAdminClient } from "@/lib/supabase/admin";
export async function SupportContact({ showName = true }: { showName?: boolean } = {}) {
  const { data, error } = await createAdminClient()
    .from("surge_pricing_settings")
    .select("platform_settings")
    .eq("id", true)
    .single();
  const p = error ? null : data?.platform_settings;
  if (!p || (!p.email && !p.phone)) return null;
  return (
    <div aria-label="Support contact details" className={showName ? "px-4 pt-3 flex flex-wrap gap-3 text-sm text-white" : "flex flex-wrap gap-3 text-sm text-white"}>
      {showName && <span>{p.name} support</span>}
      {p.email && (
        <a className="underline" href={`mailto:${p.email}`}>
          {p.email}
        </a>
      )}
      {p.phone && (
        <a className="underline" href={`tel:${p.phone}`}>
          {p.phone}
        </a>
      )}
    </div>
  );
}
