"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useRealAuth } from "@/lib/auth/authGateway";
import { signInUser } from "@/lib/auth/session";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";

type RoleOption = "adult" | "child";

type RegisterResponse = {
  ok?: true;
  userId?: string;
  familyId?: string;
  familyName?: string;
  error?: string;
};

type FamilyMode = "join-existing" | "create-new";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { families, createFamily } = useAuthAndFamilyStore();
  const hasExistingFamilies = families.length > 0;
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<RoleOption>("adult");
  const [familyMode, setFamilyMode] = useState<FamilyMode>("join-existing");
  const effectiveFamilyMode = familyMode === "join-existing" && hasExistingFamilies ? "join-existing" : "create-new";
  const [familyId, setFamilyId] = useState<string>(families[0]?.id ?? "");
  const [familyName, setFamilyName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = useMemo(() => {
    const target = searchParams.get("redirectTo");
    if (target?.startsWith("/")) return target;
    return "/planner";
  }, [searchParams]);

  const handleRegister = async () => {
    const normalizedUserId = userId.trim().toLowerCase();
    const trimmedName = name.trim();
    const trimmedFamilyId = familyId.trim();
    const trimmedFamilyName = familyName.trim();
    const usingJoinMode = effectiveFamilyMode === "join-existing";

    if (!normalizedUserId) {
      setErrorMessage("Please choose a username.");
      return;
    }
    if (!trimmedName) {
      setErrorMessage("Please enter your name.");
      return;
    }
    if (!password) {
      setErrorMessage("Please choose a password.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    if (usingJoinMode && !trimmedFamilyId) {
      setErrorMessage("Please choose a family.");
      return;
    }
    if (!usingJoinMode && !trimmedFamilyName) {
      setErrorMessage("Please provide a family name.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: normalizedUserId,
          name: trimmedName,
          role,
          password,
          ...(usingJoinMode
            ? { familyMode: "join", familyId: trimmedFamilyId }
            : { familyMode: "create", familyName: trimmedFamilyName }),
        } satisfies {
          userId: string;
          name: string;
          role: RoleOption;
          password: string;
          familyMode?: "create" | "join";
          familyId?: string;
          familyName?: string;
        }),
      });
      const payload = (await response.json().catch(() => null)) as RegisterResponse | null;
      if (!response.ok) {
        setErrorMessage(`Registration failed: ${payload?.error ?? "unknown_error"}`);
        return;
      }
      if (!payload?.ok) {
        setErrorMessage("Registration failed.");
        return;
      }
      if (!usingJoinMode) {
        createFamily(trimmedFamilyName, undefined, payload.familyId);
      }

      setSuccessMessage("Account created successfully. Signing you in...");
      await signInUser(normalizedUserId, password);
      router.push(redirectTo);
    } catch (error) {
      if (error instanceof Error && error.message === "Unable to complete sign in") {
        setErrorMessage("Account created. Please sign in to continue.");
      } else {
        setErrorMessage("Registration failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!useRealAuth) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Registration unavailable</h2>
        <p className="text-sm text-slate-400">
          Registration is only available when real authentication is enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">Create account</h2>
      <p className="text-sm text-slate-400">Create a real account to sign in.</p>

      {errorMessage ? (
        <p className="rounded-md border border-rose-500/50 bg-rose-500/10 p-2 text-xs text-rose-200">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="rounded-md border border-emerald-500/50 bg-emerald-500/10 p-2 text-xs text-emerald-200">
          {successMessage}
        </p>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-xs text-slate-400">Username</span>
        <input
          type="text"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
          autoComplete="username"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-slate-400">Display name</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
          autoComplete="name"
        />
      </label>

      <div className="space-y-2">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Family setup</span>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-300">
            <label className="flex items-center gap-2">
            <input
                type="radio"
              checked={effectiveFamilyMode === "join-existing"}
                onChange={() => setFamilyMode("join-existing")}
              disabled={!hasExistingFamilies}
              />
              <span>Join existing family</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={familyMode === "create-new"}
                onChange={() => setFamilyMode("create-new")}
              />
              <span>Create new family</span>
            </label>
          </div>
        </label>
          {effectiveFamilyMode === "join-existing" ? (
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Family</span>
            <select
              value={familyId}
              onChange={(event) => setFamilyId(event.target.value)}
              className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            >
              <option value="">Select family</option>
              {families.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name} ({family.id})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Family name</span>
            <input
              type="text"
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
              placeholder="Family name"
              className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
          </label>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-slate-400">Role</span>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as RoleOption)}
          className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
        >
          <option value="adult">Adult</option>
          <option value="child">Child</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-slate-400">Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
          autoComplete="new-password"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-slate-400">Confirm password</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
          autoComplete="new-password"
        />
      </label>

      <button
        type="button"
        onClick={handleRegister}
        disabled={isSubmitting}
        className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-600"
      >
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>

      <p className="text-xs text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="text-emerald-300 hover:text-emerald-200">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<p className="text-xs text-slate-400">Loading registration…</p>}>
      <RegisterPageContent />
    </Suspense>
  );
}
