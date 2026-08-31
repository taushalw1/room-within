import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/**
 * What a phone needs to treat the site as an app.
 *
 * Once this exists and a service worker is registered, "Add to Home Screen"
 * gives a real icon that opens full-screen with no browser chrome. There is no
 * app store involved, nothing to install, and nothing to review.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.shortName,
    description:
      "Book a room, see what's on, join a class, and keep track of what you owe — Room Within Community, Grassy Lake.",
    start_url: "/",

    // Standalone is what removes the address bar. The site keeps working in an
    // ordinary browser tab either way.
    display: "standalone",
    orientation: "portrait",

    // Parchment behind the app while it loads, cream once it has — the same
    // two tones the site opens with, so there is no white flash.
    background_color: "#f3eee0",
    theme_color: "#5e6e45",

    lang: "en-CA",
    categories: ["education", "lifestyle"],

    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Android crops these to whatever shape it likes, so the artwork inside
      // is inset well clear of the edge.
      {
        src: "/icons/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],

    // Long-press the home-screen icon to jump straight to one of these.
    shortcuts: [
      {
        name: "What's on",
        short_name: "Calendar",
        url: "/calendar",
      },
      {
        name: "Classes",
        short_name: "Classes",
        url: "/classes",
      },
      {
        name: "Book a room",
        short_name: "Book",
        url: "/book",
      },
    ],
  };
}
