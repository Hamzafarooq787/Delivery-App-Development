import { NextRequest, NextResponse } from 'next/server'
import { updateMyLocation } from '@/app/actions/tracking'
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.measured_at) return NextResponse.json({ error: 'Fresh GPS timestamp required' }, { status: 400 })
    const result = await updateMyLocation(body)
    return NextResponse.json(result, { status: result.error ? 400 : 200 })
  } catch { return NextResponse.json({ error: 'Invalid location request' }, { status: 400 }) }
}
