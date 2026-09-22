import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The interview modules moved under /ibm-interview
    return [
      { source: "/interview", destination: "/ibm-interview/readiness", permanent: false },
      { source: "/dutch-interview", destination: "/ibm-interview/public-sector", permanent: false },
    ];
  },
};

export default nextConfig;
