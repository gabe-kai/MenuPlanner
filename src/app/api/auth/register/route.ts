import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { registerAuthIdentity } from "@/lib/auth/authIdentity.server";

type RegisterPayload = {
  userId: string;
  name: string;
  role: "adult" | "child";
  password: string;
  familyId?: string;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as RegisterPayload | null;
  const allowedKeys = ["userId", "name", "role", "password", "familyId"];
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const unexpectedKeys = Object.keys(payload).filter((key) => !allowedKeys.includes(key));
    if (unexpectedKeys.length > 0) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }
  }
  if (
    !payload ||
    typeof payload.userId !== "string" ||
    typeof payload.name !== "string" ||
    typeof payload.role !== "string" ||
    typeof payload.password !== "string"
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const trimmedUserId = payload.userId.trim();
  if (trimmedUserId.length === 0) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (payload.role !== "adult" && payload.role !== "child") {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }
  if (payload.password.length === 0) {
    return NextResponse.json({ error: "password required" }, { status: 400 });
  }

  const normalizedUserId = trimmedUserId.toLowerCase();
  const result = await registerAuthIdentity({
    userId: normalizedUserId,
    name: payload.name.trim(),
    role: payload.role,
    password: payload.password,
    ...(typeof payload.familyId === "string" ? { familyId: payload.familyId } : {}),
  });

  if (!result.ok) {
    const status = result.reason === "already_exists" ? 409 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({ ok: true, userId: result.userId });
}

