import { NextResponse } from "next/server";

function deprecatedResponse() {
  return NextResponse.json(
    {
      error:
        "Auth.js API route is deprecated in this project. Use Supabase auth endpoints.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return deprecatedResponse();
}

export async function POST() {
  return deprecatedResponse();
}
