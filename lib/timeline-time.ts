/** Database event timestamps without offsets are UTC; all panels label UK service time. */
export function timelineTime(value:string|null|undefined,timeOnly=false):string {
 if(!value)return 'Time unavailable'
 const timestamp=value.replace(' ','T'),date=new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)?timestamp:timestamp+'Z')
 if(!Number.isFinite(date.getTime()))return 'Time unavailable'
 return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',...(timeOnly?{}:{day:'2-digit',month:'short'}),hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date)+' UK'
}
