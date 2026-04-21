import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TimerProvider } from "@/lib/timer-context";
import { Providers } from "@/app/providers";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RemoteLog",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#09090b",
};

export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <html lang="de" className={geistSans.variable}>
      <body className="h-dvh overflow-hidden bg-background font-sans antialiased">
        <Providers>
          <TimerProvider>{children}</TimerProvider>
        </Providers>
      </body>
    </html>
  );
}
