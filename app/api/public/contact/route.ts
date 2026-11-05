import {createAdminClient} from "@/lib/supabase/admin"
import {boundedFetch} from "@/lib/short-request"
export async function GET(){
 const {data,error}=await createAdminClient(boundedFetch(2500)).from("surge_pricing_settings").select("platform_settings").eq("id",true).maybeSingle()
 if(error)return Response.json({},{status:503,headers:{"Cache-Control":"no-store"}})
 const p=data?.platform_settings??{}
 return Response.json({email:typeof p.email==="string"?p.email.trim():"",phone:typeof p.phone==="string"?p.phone.trim():""},{headers:{"Cache-Control":"public, max-age=30","Vercel-CDN-Cache-Control":"public, s-maxage=30"}})
}
