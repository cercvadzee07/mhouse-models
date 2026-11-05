import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdmin } from "@/lib/auth";
import { AuthCard } from "@/components/admin/AuthCard";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; reset?: string }> }) {
  const params = await searchParams;
  if (params.error !== "forbidden" && (await getAdmin())) redirect("/admin");
  const next = params.next && params.next.startsWith("/admin") && !params.next.startsWith("//") ? params.next : "/admin";
  return (
    <AuthCard
      title="Sign in"
      subtitle="Administrator access to the website content."
      footer={
        <Link href="/admin/forgot-password" className="underline underline-offset-2 hover:text-black">
          Forgot your password?
        </Link>
      }
    >
      <LoginForm next={next} forbidden={params.error === "forbidden"} passwordReset={params.reset === "1"} />
    </AuthCard>
  );
}
