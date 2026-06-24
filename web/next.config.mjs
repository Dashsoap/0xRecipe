/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the shared workspace package from source (no prebuilt dist needed in dev).
  transpilePackages: ["@0xrecipe/shared"],
};

export default nextConfig;
