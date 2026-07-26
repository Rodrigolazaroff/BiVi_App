import type { Metadata, Viewport } from "next";
import { Fraunces, Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { AuthProvider } from "@/lib/auth-context";

// Las mismas dos familias que usa la landing, para que app y sitio se lean igual.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

// Atkinson Hyperlegible esta diseñada para baja vision: separa caracteres que
// suelen confundirse (I/l/1, O/0). Por eso es la tipografia de texto.
const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1B75BC",
  // El zoom queda habilitado a proposito. Antes estaba `userScalable: false`,
  // que en una app para adultos mayores les quita el recurso de agrandar texto.
};

export const metadata: Metadata = {
  title: "BiVi",
  description: "Una compañía cuando no hay nadie cerca",
  // El <link rel="manifest"> lo inyecta Next a partir de app/manifest.ts.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BiVi",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${atkinson.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          {children}
          <ServiceWorkerRegister />
        </AuthProvider>
      </body>
    </html>
  );
}
