import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Stub – the real session logic lives in middleware.ts directly.
// This file exists only so older compiled chunks can resolve the import.
export async function updateSession(request: NextRequest) {
  return NextResponse.next()
}
