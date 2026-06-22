import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Prisma client is generated to a custom folder; force Next.js file
  // tracing to copy the query-engine binary into the serverless bundles,
  // otherwise Prisma can't start on Vercel (engine-not-found).
  outputFileTracingIncludes: {
    "/**": ["./app/generated/prisma/**/*"],
  },
  experimental: {
    // Document uploads (budget BOQ workbooks, PO/invoice scans) go through Server
    // Actions, whose request body defaults to a 1 MB cap — too small for real
    // multi-MB BOQs. Raise it to match the 20 MB limit enforced in documents.ts.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
