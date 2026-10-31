import {createAdminClient} from '@/lib/supabase/admin'
import {normaliseOperations,openingError,zoneError} from '@/lib/admin-operations'
export async function bookingAvailability(userId:string,service:string,from:{lat:number;lng:number},to:{lat:number;lng:number}){
 const db=createAdminClient();const [settings,account]=await Promise.all([db.from('surge_pricing_settings').select('operational_settings').eq('id',true).single(),db.from('users').select('account_status').eq('id',userId).maybeSingle()]);if(settings.error||account.error||!account.data)return 'Booking settings could not load. Please retry.'
 if(account.data.account_status!=='active')return 'Your account cannot place new bookings. Please contact support.'
 const ops=normaliseOperations(settings.data.operational_settings),closed=openingError(ops,service);if(closed)return closed
 for(const point of [from,to]){
  const area=zoneError(ops,point.lat,point.lng);if(area)return area
  if(ops.excludedPostcodes.length){
   if(!process.env.GOOGLE_MAPS_KEY)return 'Service-area checks are unavailable. Please retry.'
   try{const url=new URL('https://maps.googleapis.com/maps/api/geocode/json');url.searchParams.set('latlng',`${point.lat},${point.lng}`);url.searchParams.set('key',process.env.GOOGLE_MAPS_KEY);const response=await fetch(url,{cache:'no-store'});const data=await response.json();const postcode=data.results?.flatMap((r:any)=>r.address_components??[]).find((c:any)=>c.types?.includes('postal_code'))?.long_name;if(data.status!=='OK'||!postcode)return 'This postcode could not be verified. Please choose a full address.';const excluded=zoneError(ops,point.lat,point.lng,postcode);if(excluded)return excluded}catch{return 'Service-area checks are unavailable. Please retry.'}
  }
 }
 return null
}
