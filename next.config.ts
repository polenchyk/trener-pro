import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 блокує dev-ресурси з інших origin (телефон за IP у Wi‑Fi)
  allowedDevOrigins: ["192.168.10.123", "192.168.*.*"],
};

export default nextConfig;
