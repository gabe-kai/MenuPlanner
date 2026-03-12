import { NextResponse } from "next/server";

const NEXT_AUTH_COOKIES = [
  "mp.session",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
  "__Host-next-auth.csrf-token",
  "next-auth.csrf-token",
  "__Secure-next-auth.callback-url",
  "next-auth.callback-url",
];

export async function POST() {
  const response = NextResponse.json({ ok: true });
  NEXT_AUTH_COOKIES.forEach((name) => {
    response.cookies.set({
      name,
      value: "",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 0,
      sameSite: "lax",
    });
  });
  return response;
}
