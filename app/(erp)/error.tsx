"use client";

/**
 * Route error boundary for the whole ERP section. Next.js renders this in
 * place of the page when a child throws during render — the sidebar and topbar
 * (owned by the layout) stay put, so the user keeps their bearings and can
 * navigate away or retry instead of facing a blank screen.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ERPError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Surface to the console (and any logging you wire up later).
    console.error("[ERP] A page failed to render:", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        minHeight: "60vh",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "50%",
          background: "rgba(186,26,26,0.1)",
          border: "1px solid rgba(186,26,26,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "24px",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "#ba1a1a" }}>
          error
        </span>
      </div>

      <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#333333", marginBottom: "8px" }}>
        Something went wrong
      </h1>
      <p style={{ fontSize: "14px", color: "#666666", maxWidth: "440px", lineHeight: 1.6, marginBottom: "8px" }}>
        This page hit an unexpected error and couldn&apos;t finish loading. Your other data is
        safe — you can try again or head back to the dashboard.
      </p>
      {error.digest && (
        <p style={{ fontSize: "11px", color: "#999999", marginBottom: "24px", fontFamily: "monospace" }}>
          Reference: {error.digest}
        </p>
      )}

      <div style={{ display: "flex", gap: "12px", marginTop: error.digest ? 0 : "16px" }}>
        <button
          onClick={() => reset()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 20px",
            border: "none",
            borderRadius: "8px",
            background: "#e30613",
            color: "white",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>refresh</span>
          Try again
        </button>
        <button
          onClick={() => router.push("/dashboard")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 20px",
            border: "1px solid #e4e2e1",
            borderRadius: "8px",
            background: "white",
            color: "#333333",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>home</span>
          Go to dashboard
        </button>
      </div>
    </div>
  );
}
