import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows end-to-end tests to run a second dev server with an isolated build
  // directory so it does not clash with a locally running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
