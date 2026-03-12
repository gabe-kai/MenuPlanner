"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";

type ApiError = {
  error?: string;
};

type AccountProfile = {
  userId: string;
  name: string;
  familyId: string;
  role: "adult" | "child";
  editPolicy?: "free" | "approval_required" | "no_edit";
};

type MessageKind = "idle" | "error" | "success";

type MessageState = {
  kind: MessageKind;
  text: string;
};

function initialMessage(): MessageState {
  return { kind: "idle", text: "" };
}

function extractErrorMessage(payload: unknown, fallback: string) {
  const fallbackPayload = payload as ApiError;
  return typeof fallbackPayload?.error === "string" ? fallbackPayload.error : fallback;
}

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [profileMessage, setProfileMessage] = useState<MessageState>(initialMessage());
  const [passwordMessage, setPasswordMessage] = useState<MessageState>(initialMessage());
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function loadProfile() {
    setLoading(true);
    setProfileMessage(initialMessage());
    setPasswordMessage(initialMessage());
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (response.status === 401) {
        const redirectTo = encodeURIComponent("/account");
        router.push(`/login?redirectTo=${redirectTo}`);
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiError | null;
        setProfileMessage({ kind: "error", text: extractErrorMessage(payload, "Unable to load account.") });
        return;
      }

      const payload = (await response.json()) as AccountProfile;
      setProfile(payload);
      setDisplayName(payload.name);
    } catch {
      setProfileMessage({ kind: "error", text: "Unable to load account." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function handleProfileUpdate(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;

    const name = displayName.trim();
    if (!name) {
      setProfileMessage({ kind: "error", text: "Display name cannot be blank." });
      return;
    }

    setIsSavingProfile(true);
    setProfileMessage(initialMessage());
    try {
      const response = await fetch("/api/auth/me", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json().catch(() => null)) as ApiError & { ok?: true };
      if (!response.ok) {
        setProfileMessage({
          kind: "error",
          text: extractErrorMessage(payload, "Update failed."),
        });
        return;
      }
      if (payload.ok) {
        setProfile((previous) =>
          previous === null ? previous : { ...previous, name },
        );
        useAuthAndFamilyStore.getState().upsertUserContext({
          userId: profile.userId,
          familyId: profile.familyId,
          name,
        });
        setProfileMessage({ kind: "success", text: "Profile updated." });
      } else {
        setProfileMessage({ kind: "error", text: "Update failed." });
      }
    } catch {
      setProfileMessage({ kind: "error", text: "Update failed." });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordChange(event: FormEvent) {
    event.preventDefault();
    if (nextPassword !== confirmPassword) {
      setPasswordMessage({ kind: "error", text: "New passwords do not match." });
      return;
    }
    if (nextPassword.length < 6) {
      setPasswordMessage({
        kind: "error",
        text: "Password must be at least 6 characters.",
      });
      return;
    }
    if (!currentPassword) {
      setPasswordMessage({ kind: "error", text: "Current password is required." });
      return;
    }

    setIsSavingPassword(true);
    setPasswordMessage(initialMessage());
    try {
      const response = await fetch("/api/auth/me/password", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          nextPassword,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiError & { ok?: true };
      if (!response.ok) {
        setPasswordMessage({
          kind: "error",
          text: extractErrorMessage(payload, "Password update failed."),
        });
        return;
      }
      if (payload.ok) {
        setPasswordMessage({ kind: "success", text: "Password changed." });
        setCurrentPassword("");
        setNextPassword("");
        setConfirmPassword("");
      } else {
        setPasswordMessage({ kind: "error", text: "Password update failed." });
      }
    } catch {
      setPasswordMessage({ kind: "error", text: "Password update failed." });
    } finally {
      setIsSavingPassword(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading account settings...</p>;
  }

  if (!profile) {
    return <p className="text-sm text-rose-300">Unable to load account details.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Account settings</h2>
        <p className="text-sm text-slate-400">
          Manage your profile and account-level options.
        </p>
      </section>

      <section className="rounded-lg border border-slate-700 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
          Profile
        </h3>
        <form className="space-y-3" onSubmit={handleProfileUpdate}>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">User ID</span>
            <input
              type="text"
              value={profile.userId}
              readOnly
              className="w-full max-w-sm rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-400"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Display name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="w-full max-w-sm rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Role</span>
            <input
              type="text"
              value={profile.role}
              readOnly
              className="w-full max-w-sm rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-400"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Family ID</span>
            <input
              type="text"
              value={profile.familyId}
              readOnly
              className="w-full max-w-sm rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-400"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Child edit policy</span>
            <input
              type="text"
              value={profile.editPolicy ?? "n/a"}
              readOnly
              className="w-full max-w-sm rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-400"
            />
          </label>
          <button
            type="submit"
            disabled={isSavingProfile}
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-600"
          >
            {isSavingProfile ? "Saving..." : "Save profile"}
          </button>
        </form>
        {profileMessage.text ? (
          <p
            className={`mt-3 rounded-md border px-3 py-2 text-xs ${
              profileMessage.kind === "error"
                ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
                : "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {profileMessage.text}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-700 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
          Password
        </h3>
        <form className="space-y-3" onSubmit={handlePasswordChange}>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              className="w-full max-w-sm rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">New password</span>
            <input
              type="password"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              autoComplete="new-password"
              className="w-full max-w-sm rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              className="w-full max-w-sm rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
          </label>
          <button
            type="submit"
            disabled={isSavingPassword}
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-600"
          >
            {isSavingPassword ? "Changing..." : "Change password"}
          </button>
        </form>
        {passwordMessage.text ? (
          <p
            className={`mt-3 rounded-md border px-3 py-2 text-xs ${
              passwordMessage.kind === "error"
                ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
                : "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {passwordMessage.text}
          </p>
        ) : null}
      </section>

      <Link
        href="/planner"
        className="inline-block text-xs text-emerald-300 hover:text-emerald-200"
      >
        Back to planner
      </Link>
    </div>
  );
}

