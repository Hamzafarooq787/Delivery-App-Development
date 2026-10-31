import Link from 'next/link'
export function DriverPageControls({path,page,count,q=''}:{path:string;page:number;count:number;q?:string}){
 const href=(p:number)=>`${path}?${new URLSearchParams({page:String(p),q})}`
 return <div className="space-y-3 p-3 text-sm text-white"><form action={path} className="flex gap-2"><input name="q" defaultValue={q} placeholder="Search your jobs or tracking IDs" className="min-w-0 flex-1 rounded-lg border border-white/20 bg-[var(--brand-panel)] p-3"/><button className="rounded-lg bg-[var(--brand-strong)] px-4 text-[var(--brand-ink)]">Search</button></form><div className="flex justify-between">{page>1?<Link href={href(page-1)}>Previous</Link>:<span/>}<span>Page {page} of {Math.max(1,Math.ceil(count/20))} · {count} jobs</span>{page*20<count?<Link href={href(page+1)}>Next</Link>:<span/>}</div></div>
}
