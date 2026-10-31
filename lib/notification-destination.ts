/** Only navigate to the recipient's own dashboard routes. Never trust arbitrary URLs. */
export function notificationDestination(value:unknown,role:'customer'|'driver'|'admin'):string|null {
 if(typeof value!=='string'||value.length>300)return null
 const prefix=role==='customer'?'/dashboard/customer/tracking?id=':role==='driver'?'/dashboard/driver/jobs/':null
 if(!prefix||!value.startsWith(prefix))return null
 return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.slice(prefix.length))?value:null
}
