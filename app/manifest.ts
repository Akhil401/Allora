import type { MetadataRoute } from "next";

/**
 * PWA Web App Manifest (served at /manifest.webmanifest). Enables "Add to Home
 * Screen" on Android Chrome so the app launches standalone, full-screen.
 * Replace the placeholder icons in /public with real 192px and 512px PNGs.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Allora — Learn Italian",
    short_name: "Allora",
    description: "Practice spoken Italian with Allora, your adaptive AI tutor.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
