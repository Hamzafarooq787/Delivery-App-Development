import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kinetic Void — Premium Logistics",
    short_name: "Kinetic Void",
    description:
      "Experience precision-engineered delivery solutions. Real-time tracking, instant dispatch, zero compromise.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e0e0e",
    theme_color: "#0e0e0e",
    categories: ["logistics", "delivery", "transportation"],
    icons: [
      {
        src: "/icons/icon-72.png",
        sizes: "72x72",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-96.png",
        sizes: "96x96",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-128.png",
        sizes: "128x128",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-144.png",
        sizes: "144x144",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-152.png",
        sizes: "152x152",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-384.png",
        sizes: "384x384",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Customer Dashboard",
        url: "/dashboard/customer",
        description: "Track your deliveries",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }],
      },
      {
        name: "Driver Dashboard",
        url: "/dashboard/driver",
        description: "Manage your jobs",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }],
      },
    ],
    screenshots: [],
  }
}
