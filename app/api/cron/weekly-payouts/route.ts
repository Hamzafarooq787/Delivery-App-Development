import { NextRequest, NextResponse } from 'next/server'
import { runWeeklyPayouts } from '@/lib/weekly-payouts'
export async function GET(request: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 })
  if (process.env.GODROP_WEEKLY_PAYOUTS_ENABLED !== 'true')
    return NextResponse.json(
      { error: 'Weekly payouts await launch verification' },
      { status: 503 },
    )
  try {
    return NextResponse.json(await runWeeklyPayouts())
  } catch {
    return NextResponse.json(
      { error: 'Payout run failed; inspect reconciliation logs' },
      { status: 500 },
    )
  }
}
