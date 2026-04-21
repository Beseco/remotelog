import Link from "next/link";

interface Props {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function VerifyPage({ searchParams }: Props) {
  const params = await searchParams;

  if (params.success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">E-Mail bestätigt</h1>
          <p className="mt-2 text-sm text-gray-500">
            Ihr Konto ist jetzt aktiv. Sie können sich jetzt anmelden.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Zur Anmeldung
          </Link>
        </div>
      </div>
    );
  }

  const errorMessages: Record<string, string> = {
    missing: "Der Bestätigungslink ist ungültig.",
    invalid: "Der Bestätigungslink wurde nicht gefunden.",
    expired: "Der Bestätigungslink ist abgelaufen. Bitte registrieren Sie sich erneut.",
  };

  const errorMessage = errorMessages[params.error ?? ""] ?? "Ein unbekannter Fehler ist aufgetreten.";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Bestätigung fehlgeschlagen</h1>
        <p className="mt-2 text-sm text-gray-500">{errorMessage}</p>
        <Link
          href="/register"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Zurück zur Registrierung
        </Link>
      </div>
    </div>
  );
}
