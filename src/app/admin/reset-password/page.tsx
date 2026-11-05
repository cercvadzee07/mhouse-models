"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { AuthCard } from "@/components/admin/AuthCard";
import { Button, TextInput } from "@/components/admin/ui";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getBrowserClient()
      .auth.getUser()
      .then(({ data }) => setHasSession(!!data.user));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 10) return setError("Use at least 10 characters.");
    if (password !== confirm) return setError("The passwords do not match.");
    setLoading(true);
    const sb = getBrowserClient();
    const { error } = await sb.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      return setError(error.message);
    }
    await sb.auth.signOut();
    router.replace("/admin/login?reset=1");
  };

  if (hasSession === false) {
    return (
      <AuthCard title="Link expired" subtitle="This password reset link is invalid or has expired.">
        <Button variant="primary" className="w-full" onClick={() => router.push("/admin/forgot-password")}>
          Request a new link
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="At least 10 characters. A passphrase is a good choice.">
      <form onSubmit={submit} className="space-y-4">
        <TextInput label="New password" id="pw" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <TextInput label="Repeat password" id="pw2" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p className="rounded-lg bg-[#a4442e]/10 px-3 py-2 text-sm text-[#7d2f1d]">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" loading={loading} disabled={hasSession === null}>
          Save new password
        </Button>
      </form>
    </AuthCard>
  );
}
