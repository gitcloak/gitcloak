import type { NextConfig } from "next";

const useMockBackend = process.env.FILE_BACKEND?.trim().toLowerCase() === "mock";

const nextConfig: NextConfig = {
  // Allows end-to-end tests to run a second dev server with an isolated build
  // directory so it does not clash with a locally running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Expose the backend selection to client components so they can behave
  // sensibly when running against the mock backend (no real OAuth).
  env: {
    NEXT_PUBLIC_MOCK_BACKEND: useMockBackend ? "1" : "0",
  },
};

export default nextConfig;
