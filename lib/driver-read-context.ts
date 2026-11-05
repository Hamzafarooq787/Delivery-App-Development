import "server-only"
import { cache } from "react"
import { boundedFetch } from "@/lib/short-request"
import { createAdminClient } from "@/lib/supabase/admin"

export const getDriverReadProfile = cache(async (driverId: string) =>
  createAdminClient(boundedFetch(3500)).from("driver_profiles")
    .select("status,is_online,verification_submitted_at,declined_jobs").eq("id", driverId).maybeSingle())

export const getDriverActiveJobs = cache(async (driverId: string) =>
  createAdminClient(boundedFetch(3500)).from("delivery_requests")
    .select("id,status,pickup_address,delivery_address,item_description,price,driver_earning_quote,package_size,service_type,shop_name,created_at")
    .eq("driver_id", driverId).in("status", ["accepted","collected","picked_up","in_transit"])
    .order("created_at", { ascending: false }).limit(20))
