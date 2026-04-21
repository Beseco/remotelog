import { Providers } from "@/app/providers";
import "../globals.css";

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-white text-gray-900 p-6 font-mono text-sm">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
