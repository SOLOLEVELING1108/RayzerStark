import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Save, Terminal, Download, Loader2, QrCode } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
import { api } from "@/lib/api";

const PIX_TYPES = ["CPF", "CNPJ", "Celular", "E-mail", "Aleatória"];

export default function Settings() {
  const [pix, setPix] = useState({ pix_type: "CPF", pix_key: "", pix_holder: "" });
  const [saving, setSaving] = useState(false);
  const [build, setBuild] = useState({ available: false });
  const [adminBuild, setAdminBuild] = useState({ available: false });

  useEffect(() => {
    api.get("/settings").then(({ data }) => setPix({ pix_type: data.pix_type || "CPF", pix_key: data.pix_key || "", pix_holder: data.pix_holder || "" }));
    api.get("/client-build/info").then(({ data }) => setBuild(data)).catch(() => {});
    api.get("/admin-build/info").then(({ data }) => setAdminBuild(data)).catch(() => {});
  }, []);

  const mb = build.size ? (build.size / 1048576).toFixed(0) : 0;
  const adminMb = adminBuild.size ? (adminBuild.size / 1048576).toFixed(0) : 0;

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", pix);
      toast.success("Pix settings saved");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const card = "rounded-2xl border border-white/10 bg-[#10131E] p-6";
  const input = "w-full bg-[#0b0d14] border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan-500/50 text-slate-100";
  const label = "text-xs font-mono uppercase tracking-widest text-slate-400 mb-1.5 block";

  return (
    <div className="max-w-3xl space-y-6">
      <div><h1 className="font-display text-3xl font-black tracking-tight">Settings</h1><p className="text-slate-400 mt-1 text-sm">Pix payment details and client build info.</p></div>

      <div className={card}>
        <div className="flex items-center gap-2 mb-4"><QrCode className="w-5 h-5 text-cyan-400" /><h2 className="font-display text-lg font-bold">Pix (shown in the customer Store)</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={label}>Type</label>
            <select data-testid="pix-type-input" className={input} value={pix.pix_type} onChange={(e) => setPix({ ...pix, pix_type: e.target.value })}>
              {PIX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Pix Key</label>
            <input data-testid="pix-key-input" className={`${input} font-mono`} value={pix.pix_key} onChange={(e) => setPix({ ...pix, pix_key: e.target.value })} placeholder="08624582504" />
          </div>
        </div>
        <div className="mt-4">
          <label className={label}>Account Holder</label>
          <input data-testid="pix-holder-input" className={input} value={pix.pix_holder} onChange={(e) => setPix({ ...pix, pix_holder: e.target.value })} placeholder="Full name" />
        </div>
        <button data-testid="save-pix-btn" onClick={save} disabled={saving} className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 disabled:opacity-60 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Pix
        </button>
      </div>

      <div className={card}>
        <div className="flex items-center gap-2 mb-4"><Download className="w-5 h-5 text-cyan-400" /><h2 className="font-display text-lg font-bold">Baixar o app Admin (Windows)</h2></div>
        <p className="text-sm text-slate-400 leading-relaxed mb-4">
          Este mesmo painel como aplicativo desktop. Baixe, extraia e rode <code className="font-mono">Config Patcher Admin.exe</code>. Precisa de internet (conecta no servidor).
        </p>
        {adminBuild.available ? (
          <a
            data-testid="download-admin-btn"
            href={`${BACKEND_URL}/api/admin-build/download`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            <Download className="w-4 h-4" /> Baixar .zip do Admin ({adminMb} MB)
          </a>
        ) : (
          <p className="text-sm text-amber-300">Build ainda não disponível.</p>
        )}
      </div>

      <div className={card}>
        <div className="flex items-center gap-2 mb-4"><Download className="w-5 h-5 text-emerald-400" /><h2 className="font-display text-lg font-bold">Baixar o app do cliente (Windows)</h2></div>
        <p className="text-sm text-slate-400 leading-relaxed mb-4">
          Versão portátil já compilada (.exe dentro de um .zip). Baixe, extraia a pasta no Windows e rode <code className="font-mono">Steam Config Patcher.exe</code>. Não precisa instalar nada.
        </p>
        {build.available ? (
          <a
            data-testid="download-client-btn"
            href={`${BACKEND_URL}/api/client-build/download`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors"
          >
            <Download className="w-4 h-4" /> Baixar .zip do cliente ({mb} MB)
          </a>
        ) : (
          <p className="text-sm text-amber-300">Build ainda não disponível.</p>
        )}
      </div>

      <div className={card}>
        <div className="flex items-center gap-2 mb-4"><Terminal className="w-5 h-5 text-cyan-400" /><h2 className="font-display text-lg font-bold">Customer Desktop Client (build manual)</h2></div>
        <p className="text-sm text-slate-400 leading-relaxed mb-4">
          The customer's Electron app has <span className="text-cyan-300">Library</span>, <span className="text-cyan-300">Store</span> and <span className="text-cyan-300">Settings</span> (Install dependencies · Delete all games). It connects to this same server.
        </p>
        <div className="rounded-xl bg-[#0b0d14] border border-white/10 p-4">
          <div className="flex items-center gap-2 text-slate-300 text-xs font-mono uppercase tracking-widest mb-3"><Terminal className="w-3.5 h-3.5" /> Build the client app</div>
          <pre className="text-[12px] font-mono text-cyan-200 whitespace-pre-wrap leading-relaxed">{`cd desktop
npm install
# config.json -> "apiBase" already points to this server
npm start            # dev
npm run build:win    # Windows .exe (dist/)`}</pre>
        </div>
        <div className="mt-4">
          <label className={label}>Server URL (apiBase)</label>
          <input data-testid="api-base-input" readOnly value={BACKEND_URL} className={`${input} font-mono text-cyan-300`} />
        </div>
      </div>

      <div className={card}>
        <div className="flex items-center gap-2 mb-2"><KeyRound className="w-5 h-5 text-amber-400" /><h2 className="font-display text-lg font-bold">Storage</h2></div>
        <p className="text-sm text-slate-400">Games, files and receipts are stored in your <span className="text-amber-300">Supabase</span> project (Postgres + Storage bucket <code className="font-mono">game-files</code>).</p>
      </div>
    </div>
  );
}
