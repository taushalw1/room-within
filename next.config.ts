import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Where the compiled output goes.
   *
   * `npm run dev` and `next build` both write here, and a build run while the
   * dev server is up overwrites the chunks it's serving — the page then dies
   * with "__webpack_modules__[moduleId] is not a function".
   *
   * So `npm run check` sets NEXT_DIST_DIR to a scratch folder, and a
   * verification build can run at any time without disturbing the preview.
   * Netlify doesn't set the variable, so deploys still build to `.next`.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  images: {
    remotePatterns: [
      // Supabase Storage — public buckets (Tausha's photo, room photos, event images)
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
