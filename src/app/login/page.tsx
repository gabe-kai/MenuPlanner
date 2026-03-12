"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useRealAuth } from "@/lib/auth/authGateway";
import { DEMO_AUTH_PASSWORD } from "@/lib/auth/demoIdentity";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";
import { signInUser } from "@/lib/auth/session";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { users, isAuthenticated } = useAuthAndFamilyStore();
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const [username, setUsername] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState(DEMO_AUTH_PASSWORD);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId),
    [users, selectedUserId],
  );

  const handleSignIn = async () => {
    const targetUserId = useRealAuth ? username.trim().toLowerCase() : selectedUser?.id;
    if (!targetUserId) {
      setErrorMessage("Sign in failed. Please provide a username.");
      return;
    }
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const session = useRealAuth
        ? await signInUser(targetUserId, password)
        : await signInUser(targetUserId);
      if (!session) {
        throw new Error("Unable to complete sign in");
      }
      const redirectTo = searchParams.get("redirectTo");
      router.push(redirectTo && redirectTo.startsWith("/") ? redirectTo : "/planner");
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message === "Unable to complete sign in"
          ? "Sign in failed. Please check your account settings and try again."
          : "Sign in failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthenticated) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          You are already signed in
        </h2>
        <p className="text-sm text-slate-400">
          Go to <Link href="/planner">planner</Link> to continue.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">Sign in</h2>
      <p className="text-sm text-slate-400">
        {useRealAuth
          ? "Enter your credentials to sign in."
          : "This mock login lets you switch user context for development."}
      </p>
      {errorMessage ? (
        <p className="rounded-md border border-rose-500/50 bg-rose-500/10 p-2 text-xs text-rose-200">
          {errorMessage}
        </p>
      ) : null}

      {useRealAuth ? (
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Username</span>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="username"
            className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
          />
        </label>
      ) : (
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">User</span>
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.role})
              </option>
            ))}
          </select>
        </label>
      )}
      {useRealAuth ? (
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
          />
        </label>
      ) : null}

      <button
        type="button"
        onClick={handleSignIn}
        disabled={isSubmitting}
        className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-600"
      >
        Sign in
      </button>
      {useRealAuth ? (
        <p className="text-xs text-slate-500">
          New user?{" "}
          <Link href="/register" className="text-emerald-300 hover:text-emerald-200">
            create an account
          </Link>
        </p>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-xs text-slate-400">Loading login...</p>}>
      <LoginPageContent />
    </Suspense>
  );
}
