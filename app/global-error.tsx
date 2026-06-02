"use client";

/**
 * Last-resort boundary for errors thrown in the root layout itself (where the
 * normal (erp)/error.tsx can't reach). It must render its own <html>/<body>
 * because it replaces the entire document. Kept dependency-free and inline-styled
 * so it works even if the app's providers or styles failed to load.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global] The application shell crashed:", error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ fontFamily: "'DM Sans', system-ui, sans-serif", margin: 0, background: "#ffffff", color: "#333333" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            minHeight: "100vh",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "rgba(186,26,26,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "24px",
              fontSize: "36px",
              color: "#ba1a1a",
            }}
          >
            ⚠
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
            Studio Masons ERP couldn&apos;t start
          </h1>
          <p style={{ fontSize: "14px", color: "#666666", maxWidth: "440px", lineHeight: 1.6, marginBottom: "24px" }}>
            A critical error stopped the app from loading. Please reload — if this keeps
            happening, contact your administrator.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 24px",
              border: "none",
              borderRadius: "8px",
              background: "#e30613",
              color: "white",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload app
          </button>
          {error.digest && (
            <p style={{ fontSize: "11px", color: "#999999", marginTop: "16px", fontFamily: "monospace" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
