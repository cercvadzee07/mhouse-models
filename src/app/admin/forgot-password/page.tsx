"use client";

import Link from "next/link";
import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { AuthCard } from "@/components/admin/AuthCard";
import { Button, TextInput } from "@/components/admin/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    const { error } = await getBrowserClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/admin/auth/confirm?next=/admin/reset-password`,
    });
    if (error) {
      setError(error.message);
      setState("error");
    } else setState("sent");
  };

  return (
    <AuthCard
      title="Reset password"
      subtitle="Enter your administrator email. If the account exists, you will receive a link to choose a new password."
      footer={
        <Link href="/admin/login" className="underline underline-offset-2 hover:text-black">
          Back to sign in
        </Link>
      }
    >
      {state === "sent" ? (
        <p className="rounded-lg bg-[#4f6b4a]/10 px-3 py-3 text-sm text-[#2f4a2a]">
          The request was accepted. Check your inbox (and spam folder) for the reset link. Open it in this same browser.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <TextInput label="Email" id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          {state === "error" && <p className="rounded-lg bg-[#a4442e]/10 px-3 py-2 text-sm text-[#7d2f1d]">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" loading={state === "sending"}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
