import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Lets phones on the LAN use the dev server, e.g. DEV_ALLOWED_ORIGINS=192.168.1.105
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGINS?.split(",").filter(Boolean),
};

export default nextConfig;
