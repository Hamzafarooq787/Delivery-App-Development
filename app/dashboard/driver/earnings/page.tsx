import { getDriverFinance } from '@/app/actions/driver-operations'
import { DriverFinancePanel } from '@/components/driver/driver-finance-panel'
export const dynamic='force-dynamic'
export default async function Page(){
 const result=await getDriverFinance(1,'all',false)
 if(result.error||!result.data)throw new Error(result.error||'Finance information could not load.')
 return <DriverFinancePanel initial={result.data} payouts={false}/>
}
