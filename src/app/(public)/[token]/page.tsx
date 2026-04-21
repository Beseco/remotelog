import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DownloadForm } from "./DownloadForm";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function DownloadPage({ params }: Props) {
  const { token: rawToken } = await params;
  const token = rawToken.toUpperCase();

  const org = await prisma.organization.findUnique({
    where: { registrationToken: token },
    select: { id: true, name: true },
  });

  if (!org) return notFound();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 mb-2">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Fernwartung einrichten</h1>
          <p className="text-sm text-gray-500">
            {org.name} · Powered by RemoteLog
          </p>
        </div>

        <DownloadForm orgToken={token} />

        <p className="text-center text-xs text-gray-400">
          Die Software wird automatisch installiert und konfiguriert.<br />
          Es werden keine persönlichen Daten ohne Ihre Kenntnis übertragen.
        </p>
      </div>
    </div>
  );
}
