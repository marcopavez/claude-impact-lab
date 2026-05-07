import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Fraunces } from "next/font/google";
import "./globals.css";

// Atkinson Hyperlegible — diseñada por el Braille Institute específicamente
// para baja visión. Sus formas de letra son más diferenciadas que Inter,
// crítico para el target +65. Self-hosteada por next/font, sin requests
// externos a Google.
const fontSans = Atkinson_Hyperlegible({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-sans-vigia",
  display: "swap",
});

// Fraunces — serif variable con personalidad cálida e institucional.
// Usada solo en el headline de verdict y en el H1 del hero, donde el
// peso emocional/jerárquico es necesario. Cargada como variable font
// (sin weight) — los pesos los controla CSS via font-weight estándar.
const fontDisplay = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display-vigia",
  display: "swap",
  axes: ["SOFT", "opsz"],
});

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
    <html lang="es-CL" className={`${fontSans.variable} ${fontDisplay.variable}`}>
      <body>
        <a href="#contenido-principal" className="skip-link">
          Saltar al contenido principal
        </a>
        {children}
      </body>
    </html>
  );
}
