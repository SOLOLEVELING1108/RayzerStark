import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, Loader2, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n";

export default function Login() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isAff = email.trim().toUpperCase().startsWith("AFF-");
      const body = isAff ? { affiliate_key: email.trim().toUpperCase() } : { email, password };
      const { data } = await api.post("/auth/login", body);
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("role", data.role || "admin");
      localStorage.setItem("principal_name", data.name || "Admin");
      toast.success(t("login.welcome"));
      navigate(data.role === "affiliate" ? "/keys" : "/");
    } catch (err) {
      toast.error(err.response?.data?.detail || t("login.fail"));
    } finally {
      setLoading(false);
    }
  };
  const affMode = email.trim().toUpperCase().startsWith("AFF-");

  return (
    <div className="min-h-screen bg-[#08090E] bg-grid flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src="/logo.png" alt="Rayzer" className="w-11 h-11 rounded-xl border border-cyan-500/30" />
          <div className="leading-tight">
            <div className="font-display font-extrabold tracking-tight text-lg">RAYZER STARK</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{t("app.tag")}</div>
          </div>
        </div>

        <form onSubmit={submit} className="glass border border-white/10 rounded-2xl p-7">
          <h1 className="font-display text-2xl font-black mb-1">{t("login.title")}</h1>
          <p className="text-slate-400 text-sm mb-6">{t("login.subtitle")}</p>

          <label className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1.5 block">{t("login.email")} / KEY</label>
          <div className="relative mb-4">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input data-testid="login-email" type="text" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0b0d14] border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-cyan-500/50 text-slate-100" placeholder="voce@email.com  ·  AFF-XXXX-XXXX-XXXX" required />
          </div>

          {!affMode && (
          <>
          <label className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1.5 block">{t("login.password")}</label>
          <div className="relative mb-6">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0b0d14] border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-cyan-500/50 text-slate-100" placeholder="••••••••" />
          </div>
          </>
          )}
          {affMode && <p className="text-[12px] text-cyan-400 mb-6 -mt-1">{t("login.affHint")}</p>}

          <button data-testid="login-submit" type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 disabled:opacity-60 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {t("login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
