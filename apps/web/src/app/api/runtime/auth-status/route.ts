import { NextResponse } from 'next/server';

export function GET() {
  const mystiraConfigured = Boolean(
    process.env.MYSTIRA_IDENTITY_WELL_KNOWN &&
      process.env.MYSTIRA_IDENTITY_CLIENT_ID &&
      process.env.MYSTIRA_IDENTITY_CLIENT_SECRET
  );

  return NextResponse.json({
    mystiraConfigured,
  });
}
