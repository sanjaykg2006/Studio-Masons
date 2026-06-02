/**
 * Friendly 404 shown for any unmatched route. Server component — no client
 * JS needed, just a link back into the app.
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        minHeight: "100vh",
        padding: "24px",
        background: "#ffffff",
        color: "#333333",
      }}
    >
      <p style={{ fontSize: "64px", fontWeight: 700, color: "#e30613", lineHeight: 1, marginBottom: "8px" }}>
        404
      </p>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>Page not found</h1>
      <p style={{ fontSize: "14px", color: "#666666", maxWidth: "400px", lineHeight: 1.6, marginBottom: "24px" }}>
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Link
        href="/dashboard"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "10px 20px",
          borderRadius: "8px",
          background: "#e30613",
          color: "white",
          fontSize: "13px",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>home</span>
        Back to dashboard
      </Link>
    </div>
  );
}
