import { NextResponse } from "next/server"
import { isMockBackend, resetMockFileBackend } from "@/lib/backends"

/**
 * Test-only endpoint: resets the in-memory mock backend to its seed state.
 * Returns 404 whenever the mock backend is not active so it can never be
 * reached in production.
 */
export async function POST() {
  if (!isMockBackend()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await resetMockFileBackend()
  return NextResponse.json({ ok: true })
}
