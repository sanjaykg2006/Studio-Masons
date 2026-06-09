"use client";
import { useNavigation } from "@/contexts/NavigationContext";

// Loading overlay shown over the main content area while a sidebar navigation
// is in flight, so the user isn't left staring at the previous page.
export default function NavLoadingOverlay() {
  const { pending } = useNavigation();
  if (!pending) return null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-white/70 backdrop-blur-sm">
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
      <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#666666" }}>
        Loading…
      </p>
    </div>
  );
}
