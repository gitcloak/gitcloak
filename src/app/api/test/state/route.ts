import { NextResponse } from "next/server"
import { isMockBackend, dumpMockBackend } from "@/lib/backends"

/**
 * Test-only endpoint: returns the raw stored contents of every mock file so
 * the end-to-end tests can assert that writes are actually encrypted before
 * being persisted. Returns 404 when the mock backend is not active.
 */
export async function GET() {
  if (!isMockBackend()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const state = await dumpMockBackend()
  return NextResponse.json(state)
}
