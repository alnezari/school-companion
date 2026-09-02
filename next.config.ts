import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/api/parse-week": ["./rules/**"], "/api/parse-timetable": ["./rules/**"] },
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
};

export default nextConfig;
