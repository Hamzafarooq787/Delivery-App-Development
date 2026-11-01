import "server-only"
export async function googleProxy(endpoint:string,params:URLSearchParams) {
 const key=process.env.GOOGLE_MAPS_KEY
 if(!key)return {error:"Location service unavailable.",status:503} as const
 params.set("key",key)
 try {
  const response=await fetch(`https://maps.googleapis.com/maps/api/${endpoint}?${params}`,{signal:AbortSignal.timeout(10000),cache:"no-store"})
  if(!response.ok)return {error:"Location lookup failed. Please retry.",status:502} as const
  const data=await response.json()
  if(!["OK","ZERO_RESULTS","NOT_FOUND"].includes(data.status))return {error:"Location service unavailable. Please retry.",status:data.status==="OVER_QUERY_LIMIT"?429:data.status==="INVALID_REQUEST"?400:503} as const
  // Do not return provider diagnostic text, which can expose infrastructure details.
  delete data.error_message
  return {data} as const
 }catch{return {error:"Location lookup failed. Please retry.",status:502} as const}
}
export function validCoordinates(lat:unknown,lng:unknown) {
 return typeof lat==="number"&&typeof lng==="number"&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180
}
