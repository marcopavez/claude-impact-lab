import type { MetadataRoute } from "next";

// PWA manifest — Vigía installable.
// Usamos el favicon existente como ícono "any". Para producción se agregarán
// ícons 192/512 en `public/icons/` (V2). El display=standalone hace que en
// Add-to-Home-Screen la app se vea sin chrome del navegador.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vigía — detector de estafas telefónicas",
    short_name: "Vigía",
    description:
      "Sube un audio sospechoso y Vigía te dice si es estafa. Pensado para proteger a adultos mayores chilenos.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1e3a8a",
    lang: "es-CL",
    dir: "ltr",
    categories: ["security", "utilities", "social"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
