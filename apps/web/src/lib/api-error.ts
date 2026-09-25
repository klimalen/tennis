import { NextResponse } from 'next/server'

/** Log the database error and return a message that does not describe the schema. */
export function apiError(status: number, message: string, cause?: unknown) {
  if (cause !== undefined) console.error(message, cause)
  return NextResponse.json({ error: message }, { status })
}
