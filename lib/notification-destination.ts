/** Accept only a recipient's own dashboard routes and validated record IDs. */
export function notificationDestination(value:unknown,role:'customer'|'driver'|'admin'):string|null {
 if(typeof value!=='string'||value.length>300||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return null
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
 const url=new URL(value,'https://godrop.invalid');if(url.origin!=='https://godrop.invalid'||url.hash)return null
 if(url.pathname===`/dashboard/${role}/support`){const keys=[...url.searchParams.keys()];if(!keys.length)return value;return keys.length===1&&keys[0]==='ticket'&&uuid.test(url.searchParams.get('ticket')??'')?value:null}
 if(role==='driver'&&['/dashboard/driver/verification','/dashboard/driver/active-jobs'].includes(url.pathname)&&!url.search)return value
 if(role==='driver'&&url.pathname==='/dashboard/driver/jobs/available'){const keys=[...url.searchParams.keys()];return keys.length===1&&keys[0]==='job'&&uuid.test(url.searchParams.get('job')??'')?value:null}
 if(role==='customer'&&url.pathname==='/dashboard/customer/tracking'){const keys=[...url.searchParams.keys()];return keys.length===1&&keys[0]==='id'&&uuid.test(url.searchParams.get('id')??'')?value:null}
 const prefix=role==='driver'?'/dashboard/driver/jobs/':role==='admin'?'/dashboard/admin/orders/':null
 return prefix&&!url.search&&url.pathname.startsWith(prefix)&&uuid.test(url.pathname.slice(prefix.length))?value:null
}
