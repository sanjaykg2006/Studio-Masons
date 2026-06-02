/**
 * Shown automatically while a page in the ERP section is loading (navigation
 * or suspense). Keeps the user informed instead of leaving the main area blank.
 */

export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        minHeight: "60vh",
        color: "#666666",
      }}
    >
      <style>{`@keyframes erp-spin{to{transform:rotate(360deg)}}`}</style>
      <div
        style={{
          width: "36px",
          height: "36px",
          border: "3px solid #e4e2e1",
          borderTopColor: "#e30613",
          borderRadius: "50%",
          animation: "erp-spin 0.7s linear infinite",
        }}
      />
      <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        Loading…
      </p>
    </div>
  );
}
