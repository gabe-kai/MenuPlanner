"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { getSessionActor } from "@/lib/auth/actors";
import { useRealAuth } from "@/lib/auth/authGateway";
import {
  getActiveSession,
  hydrateSessionFromStorage,
  signInUser,
  signOutUser,
} from "@/lib/auth/session";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";

export function SiteShell({ children }: { children: ReactNode }) {
  const { users, currentUserId, currentFamilyId, isAuthenticated } =
    useAuthAndFamilyStore();

  useEffect(() => {
    void hydrateSessionFromStorage();
  }, []);

  const actor = useMemo(() => getSessionActor(), [
    users,
    currentUserId,
    currentFamilyId,
    isAuthenticated,
  ]);

  const session = getActiveSession();

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">MenuPlanner</h1>
          <p className="text-[11px] text-slate-500">
            Phase 3.5 – Auth foundation and migration hook
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            href="/planner"
            className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:bg-slate-800"
          >
            Planner
          </Link>
          <Link
            href="/recipes"
            className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:bg-slate-800"
          >
            Recipes
          </Link>
          <Link
            href="/school-lunch/child"
            className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:bg-slate-800"
          >
            School Lunch
          </Link>
          <Link
            href="/school-lunch/adult"
            className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:bg-slate-800"
          >
            School Lunch Review
          </Link>
        {actor?.isAdult ? (
          <Link
            href="/school-lunch/adult/policies"
            className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:bg-slate-800"
          >
            Policy controls
          </Link>
        ) : null}

          {!useRealAuth ? (
            <select
              aria-label="Current user"
              value={session.userId ?? ""}
              onChange={(event) => {
                if (!event.target.value) {
                  void signOutUser();
                  return;
                }
                void signInUser(event.target.value);
              }}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Guest</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          ) : null}
          {session.isAuthenticated ? (
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="rounded-full border border-rose-500 px-3 py-1 text-slate-200 hover:bg-rose-500/20"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-emerald-500 px-3 py-1 text-emerald-200 hover:bg-emerald-500/20"
            >
              Sign in
            </Link>
          )}
          {!session.isAuthenticated && useRealAuth ? (
            <Link
              href="/register"
              className="rounded-full border border-blue-500 px-3 py-1 text-blue-200 hover:bg-blue-500/20"
            >
              Register
            </Link>
          ) : null}
        </div>
        {actor && (
          <p className="w-full text-[11px] text-slate-500">
            Active session: {actor.user.name} ({actor.user.role}) in {actor.family.name}
          </p>
        )}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
