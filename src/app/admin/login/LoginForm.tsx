"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Button, TextInput } from "@/components/admin/ui";

export function LoginForm({ next, forbidden, passwordReset }: { next: string; forbidden: boolean; passwordReset: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(forbidden ? "This account does not have administrator access." : null);
  const [loading, setLoading] = useState(false);

  // An account without a CMS role must not stay signed in.
  useEffect(() => {
    if (forbidden) getBrowserClient().auth.signOut();
  }, [forbidden]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await getBrowserClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      setError(/invalid/i.test(error.message) ? "Incorrect email or password." : error.message);
      return;
    }
    router.replace(next);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {passwordReset && !error && <p className="rounded-lg bg-[#4f6b4a]/10 px-3 py-2 text-sm text-[#2f4a2a]">Your password was changed. Please sign in.</p>}
      <TextInput label="Email" id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextInput label="Password" id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && (
        <p role="alert" className="rounded-lg bg-[#a4442e]/10 px-3 py-2 text-sm text-[#7d2f1d]">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" loading={loading} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
