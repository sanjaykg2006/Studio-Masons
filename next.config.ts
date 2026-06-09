import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Prisma client is generated to a custom folder; force Next.js file
  // tracing to copy the query-engine binary into the serverless bundles,
  // otherwise Prisma can't start on Vercel (engine-not-found).
  outputFileTracingIncludes: {
    "/**": ["./app/generated/prisma/**/*"],
  },
};

export default nextConfig;
