"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error"));
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8] p-6">
      <div className="w-full max-w-[28rem] bg-white border border-[#e4e2e1] rounded-xl shadow-sm overflow-hidden">
        <div className="px-8 py-8 border-b border-[#e4e2e1] bg-white text-center">
          <div className="w-12 h-12 rounded bg-[#e30613] flex items-center justify-center text-white font-bold text-[18px] mx-auto mb-4">
            SM
          </div>
          <h1 className="text-[24px] font-bold text-[#333333]">Studio Masons ERP</h1>
          <p className="text-[#666666] text-[14px] mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-[#e30613]/10 border border-[#e30613]/20 text-[#ba1a1a] text-[13px] rounded p-3">
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>error</span>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-bold text-[#e30613] uppercase">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studiomasons.in"
              className="bg-white border border-[#e4e2e1] rounded p-3 text-[15px] focus:outline-none focus:border-[#e30613] transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-bold text-[#e30613] uppercase">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-white border border-[#e4e2e1] rounded p-3 text-[15px] focus:outline-none focus:border-[#e30613] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#e30613] text-white py-3 rounded font-bold text-[14px] hover:opacity-90 shadow-sm transition-all disabled:opacity-50"
          >
            {loading ? "SIGNING IN…" : "SIGN IN"}
          </button>

          <p className="text-center text-[12px] text-[#999999]">
            Accounts are created by invitation. Contact your administrator for access.
          </p>
        </form>
      </div>
    </div>
  );
}
