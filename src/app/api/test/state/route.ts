import { NextResponse } from "next/server"
import { isMockBackend } from "@/lib/backends"

/**
 * Test-only endpoint: returns the raw stored contents of every mock file so
 * the end-to-end tests can assert that writes are actually encrypted before
 * being persisted. Returns 404 when the mock backend is not active.
 */
export async function GET() {
  // The build-time constant lets production builds drop the mock code.
  if (process.env.NEXT_PUBLIC_MOCK_BACKEND === '1' && isMockBackend()) {
    const { dumpMockBackend } = await import('@/lib/backends/mock')
    const state = await dumpMockBackend()
    return NextResponse.json(state)
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
