"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOutUser } from "@/lib/auth/session";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      await signOutUser();
      router.replace("/login");
    })();
  }, [router]);

  return (
    <div className="text-sm text-slate-400">
      Signing you out and returning to login.
    </div>
  );
}
