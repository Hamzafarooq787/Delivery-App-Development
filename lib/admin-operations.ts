import { z } from 'zod'
export const ADMIN_SCOPES = ['operations','finance','support','settings','marketing'] as const
export type AdminScope = typeof ADMIN_SCOPES[number]
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
export const operationsSchema=z.object({
 bookingEnabled:z.boolean(), deliveryEnabled:z.boolean(), shoppingEnabled:z.boolean(),
 hours:z.array(z.object({enabled:z.boolean(),open:time,close:time}).strict()).length(7),
 holidays:z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value})).max(366),
 zones:z.array(z.object({name:z.string().trim().min(1).max(80),lat:z.number().finite().min(-90).max(90),lng:z.number().finite().min(-180).max(180),miles:z.number().positive().max(500),exclude:z.boolean()}).strict()).max(50),
 excludedPostcodes:z.array(z.string().trim().toUpperCase().regex(/^[A-Z0-9 ]{2,8}$/)).max(200),
 driverPerMile:z.number().finite().min(0).max(20),driverPerMinute:z.number().finite().min(0).max(10),vanDriverExtra:z.number().finite().min(0).max(100),
 cancellationBeforePickup:z.enum(['full_refund','review']),
 cancellationAfterPickup:z.enum(['review','return_to_pickup']),
 requireAdminMfa:z.boolean(),
}).strict()
export type OperationsSettings=z.infer<typeof operationsSchema>
export const DEFAULT_OPERATIONS:OperationsSettings={bookingEnabled:true,deliveryEnabled:true,shoppingEnabled:true,hours:Array.from({length:7},()=>({enabled:true,open:'00:00',close:'00:00'})),holidays:[],zones:[],excludedPostcodes:[],driverPerMile:0,driverPerMinute:0,vanDriverExtra:0,cancellationBeforePickup:'full_refund',cancellationAfterPickup:'review',requireAdminMfa:false}
export function normaliseOperations(value:unknown):OperationsSettings {
 const parsed=operationsSchema.safeParse({...DEFAULT_OPERATIONS,...(value&&typeof value==='object'?value:{})})
 if(!parsed.success)throw new Error('Operational settings are unavailable. Please retry.')
 return parsed.data
}
export function openingError(settings:OperationsSettings,service:string,now=new Date()):string|null {
 if(!settings.bookingEnabled||service==='buy_for_me'&&!settings.shoppingEnabled||service!=='buy_for_me'&&!settings.deliveryEnabled)return 'This service is temporarily paused. Please try again later.'
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now)
 const get=(t:string)=>parts.find(p=>p.type===t)?.value??''
 if(settings.holidays.includes(`${get('year')}-${get('month')}-${get('day')}`))return 'Bookings are closed for a scheduled holiday.'
 const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday')),minutes=Number(get('hour'))*60+Number(get('minute'))
 const toMinutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3))
 const current=settings.hours[day],previous=settings.hours[(day+6)%7]
 const start=toMinutes(current.open),end=toMinutes(current.close),priorStart=toMinutes(previous.open),priorEnd=toMinutes(previous.close)
 const open=current.enabled&&(start===end||start<end&&minutes>=start&&minutes<end||start>end&&minutes>=start)||previous.enabled&&priorStart>priorEnd&&minutes<priorEnd
 return open?null:'Bookings are outside our opening hours. Please return during service hours.'
}
export function zoneError(settings:OperationsSettings,lat:number,lng:number,postcode?:string):string|null {
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return 'Choose a valid location.'
 const rad=Math.PI/180
 const inside=(z:OperationsSettings['zones'][number])=>{const a=Math.sin((lat-z.lat)*rad/2)**2+Math.cos(lat*rad)*Math.cos(z.lat*rad)*Math.sin((lng-z.lng)*rad/2)**2;return 3958.7613*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))<=z.miles}
 const allow=settings.zones.filter(z=>!z.exclude)
 if(settings.zones.some(z=>z.exclude&&inside(z))||allow.length&&!allow.some(inside))return 'This location is outside our service area.'
 if(postcode&&settings.excludedPostcodes.some(p=>postcode.toUpperCase().replaceAll(' ','').startsWith(p.replaceAll(' ',''))))return 'This postcode is outside our service area.'
 return null
}
export function parseAdminDate(value:string|undefined,end=false):string|undefined {
 if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return undefined
 const date=new Date(value+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)return undefined
 // Report boundaries are UTC instants; labels explicitly state this.
 if(end)date.setUTCDate(date.getUTCDate()+1)
 return date.toISOString()
}
export function asUtc(value:string):string{return /(?:Z|[+-]\d{2}:?\d{2})$/.test(value)?value:value+'Z'}
export function ukDate(value:string|null|undefined):string{return value?new Date(asUtc(value)).toLocaleString('en-GB',{timeZone:'Europe/London'}):'—'}
export function csvCell(value:unknown):string{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'}
