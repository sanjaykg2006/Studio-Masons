"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // The invite link must have created a session via /auth/callback.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login?error=Invite+link+expired");
      } else {
        setReady(true);
      }
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8] text-[#666666]">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8] p-6">
      <div className="w-full max-w-[28rem] bg-white border border-[#e4e2e1] rounded-xl shadow-sm overflow-hidden">
        <div className="px-8 py-8 border-b border-[#e4e2e1] text-center">
          <div className="w-12 h-12 rounded bg-[#e30613] flex items-center justify-center text-white font-bold text-[18px] mx-auto mb-4">
            SM
          </div>
          <h1 className="text-[24px] font-bold text-[#333333]">Set your password</h1>
          <p className="text-[#666666] text-[14px] mt-1">Choose a password to finish setting up your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-[#e30613]/10 border border-[#e30613]/20 text-[#ba1a1a] text-[13px] rounded p-3">
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>error</span>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-bold text-[#e30613] uppercase">New Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="bg-white border border-[#e4e2e1] rounded p-3 text-[15px] focus:outline-none focus:border-[#e30613] transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-bold text-[#e30613] uppercase">Confirm Password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              className="bg-white border border-[#e4e2e1] rounded p-3 text-[15px] focus:outline-none focus:border-[#e30613] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#e30613] text-white py-3 rounded font-bold text-[14px] hover:opacity-90 shadow-sm transition-all disabled:opacity-50"
          >
            {loading ? "SAVING…" : "SET PASSWORD & CONTINUE"}
          </button>
        </form>
      </div>
    </div>
  );
}
