import { NextResponse } from "next/server"
import { isMockBackend } from "@/lib/backends"

/**
 * Test-only endpoint: resets the in-memory mock backend to its seed state.
 * Returns 404 whenever the mock backend is not active so it can never be
 * reached in production.
 */
export async function POST() {
  // The build-time constant lets production builds drop the mock code.
  if (process.env.NEXT_PUBLIC_MOCK_BACKEND === '1' && isMockBackend()) {
    const { resetMockFileBackend } = await import('@/lib/backends/mock')
    await resetMockFileBackend()
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
