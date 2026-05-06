import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vigía — detector de estafas telefónicas",
  description:
    "Vigía analiza audios sospechosos y detecta el cuento del tío, suplantación de banco y otras estafas telefónicas. Pensado para proteger a adultos mayores chilenos.",
  applicationName: "Vigía",
  authors: [{ name: "Claude Impact Lab Chile 2026" }],
  keywords: [
    "vishing",
    "estafa telefónica",
    "adultos mayores",
    "Chile",
    "ciberseguridad",
    "Claude",
  ],
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    title: "Vigía",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // permitimos zoom — accesibilidad WCAG 1.4.4
  themeColor: "#1e3a8a",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CL">
      <body>
        <a href="#contenido-principal" className="skip-link">
          Saltar al contenido principal
        </a>
        {children}
      </body>
    </html>
  );
}
