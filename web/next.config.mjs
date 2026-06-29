import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: repoRoot,
  // Compile the shared workspace package from source (no prebuilt dist needed in dev).
  transpilePackages: ["@0xrecipe/shared"],
};

export default nextConfig;
