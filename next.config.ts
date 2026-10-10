import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // A school's certificate design is uploaded through a server action: up to 8 MB (see
    // certificate-design-core.ts), plus room for the form around it. Everything else is far smaller.
    serverActions: { bodySizeLimit: "9mb" },
  },
};

export default nextConfig;
