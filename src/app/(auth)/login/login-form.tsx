"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, MonitorDot } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort ist erforderlich"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error.includes("Zu viele Versuche")) {
          setError(result.error);
        } else {
          setError("Ungültige E-Mail-Adresse oder Passwort.");
        }
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
    }
  };

  return (
    <div className="w-full max-w-[26rem]">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2.5 mb-8">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#1a56db]">
          <MonitorDot className="h-5 w-5 text-white" />
        </div>
        <span className="text-2xl font-bold text-white tracking-tight">RemoteLog</span>
      </div>

      {/* Card — always white, independent of theme */}
      <div
        className="rounded-xl p-10 space-y-6"
        style={{
          background: "#fff",
          color: "#1e293b",
          boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#1e293b" }}>Anmelden</h1>
          <p className="text-sm mt-1" style={{ color: "#64748b" }}>
            Melde dich mit deinen Zugangsdaten an.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium" style={{ color: "#1e293b" }}>
              E-Mail
            </label>
            {(() => {
              const { onBlur: rhfOnBlur, ...emailRest } = register("email");
              return (
                <input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  autoComplete="email"
                  autoFocus
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-shadow"
                  style={{ border: "1px solid #e2e8f0", color: "#1e293b", background: "#fff" }}
                  onFocus={e => (e.currentTarget.style.boxShadow = "0 0 0 3px rgba(26,86,219,0.12)")}
                  onBlur={e => { e.currentTarget.style.boxShadow = "none"; return rhfOnBlur(e); }}
                  {...emailRest}
                />
              );
            })()}
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium" style={{ color: "#1e293b" }}>
              Passwort
            </label>
            {(() => {
              const { onBlur: rhfOnBlur, ...passwordRest } = register("password");
              return (
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-shadow"
                  style={{ border: "1px solid #e2e8f0", color: "#1e293b", background: "#fff" }}
                  onFocus={e => (e.currentTarget.style.boxShadow = "0 0 0 3px rgba(26,86,219,0.12)")}
                  onBlur={e => { e.currentTarget.style.boxShadow = "none"; return rhfOnBlur(e); }}
                  {...passwordRest}
                />
              );
            })()}
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2.5 text-sm" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg py-3 text-sm font-bold text-white transition-colors flex items-center justify-center gap-2"
            style={{
              background: isSubmitting ? "#93c5fd" : "#1a56db",
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
            onMouseEnter={e => { if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.background = "#1d4ed8"; }}
            onMouseLeave={e => { if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.background = "#1a56db"; }}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Anmelden
          </button>
        </form>
      </div>
    </div>
  );
}
