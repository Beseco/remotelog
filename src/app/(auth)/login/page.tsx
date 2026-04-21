import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { setupIsOpen } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await setupIsOpen()) {
    redirect("/setup");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f2057 100%)" }}
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
