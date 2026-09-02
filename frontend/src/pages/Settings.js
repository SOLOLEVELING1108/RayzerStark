import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Download, Loader2, QrCode, Languages } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n, LANGS } from "@/i18n";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const PIX_TYPES = ["CPF", "CNPJ", "Celular", "E-mail", "Aleatória"];

export default function Settings() {
  const { t, lang, changeLang } = useI18n();
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
    try { await api.put("/settings", pix); toast.success(t("settings.pixSaved")); }
    catch { toast.error(t("game.saveFail")); }
    finally { setSaving(false); }
  };

  const card = "rounded-2xl border border-white/10 bg-[#10131E] p-6";
  const input = "w-full bg-[#0b0d14] border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan-500/50 text-slate-100";
  const label = "text-xs font-mono uppercase tracking-widest text-slate-400 mb-1.5 block";

  return (
    <div className="max-w-3xl space-y-6">
      <div><h1 className="font-display text-3xl font-black tracking-tight">{t("settings.title")}</h1><p className="text-slate-400 mt-1 text-sm">{t("settings.subtitle")}</p></div>

      <div className={card}>
        <div className="flex items-center gap-2 mb-4"><Languages className="w-5 h-5 text-cyan-400" /><h2 className="font-display text-lg font-bold">{t("settings.lang")}</h2></div>
        <p className="text-sm text-slate-400 mb-4">{t("settings.langDesc")}</p>
        <div className="flex gap-2 flex-wrap">
          {LANGS.map((l) => (
            <button key={l.code} data-testid={`lang-${l.code}`} onClick={() => changeLang(l.code)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${lang === l.code ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40" : "text-slate-300 border border-white/10 hover:text-slate-100"}`}>
              <span className="text-base">{l.flag}</span> {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className={card}>
        <div className="flex items-center gap-2 mb-4"><QrCode className="w-5 h-5 text-cyan-400" /><h2 className="font-display text-lg font-bold">{t("settings.pix")}</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={label}>{t("settings.pixType")}</label>
            <select data-testid="pix-type-input" className={input} value={pix.pix_type} onChange={(e) => setPix({ ...pix, pix_type: e.target.value })}>
              {PIX_TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>{t("settings.pixKey")}</label>
            <input data-testid="pix-key-input" className={`${input} font-mono`} value={pix.pix_key} onChange={(e) => setPix({ ...pix, pix_key: e.target.value })} />
          </div>
        </div>
        <div className="mt-4">
          <label className={label}>{t("settings.pixHolder")}</label>
          <input data-testid="pix-holder-input" className={input} value={pix.pix_holder} onChange={(e) => setPix({ ...pix, pix_holder: e.target.value })} />
        </div>
        <button data-testid="save-pix-btn" onClick={save} disabled={saving} className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 disabled:opacity-60 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("settings.savePix")}
        </button>
      </div>

      <div className={card}>
        <div className="flex items-center gap-2 mb-4"><Download className="w-5 h-5 text-cyan-400" /><h2 className="font-display text-lg font-bold">{t("settings.adminApp")}</h2></div>
        <p className="text-sm text-slate-400 leading-relaxed mb-4">{t("settings.adminDesc")}</p>
        {adminBuild.available ? (
          <a data-testid="download-admin-btn" href={`${BACKEND_URL}/api/admin-build/download`} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors">
            <Download className="w-4 h-4" /> {t("settings.download")} .zip ({adminMb} MB)
          </a>
        ) : <p className="text-sm text-amber-300">{t("settings.buildNA")}</p>}
      </div>

      <div className={card}>
        <div className="flex items-center gap-2 mb-4"><Download className="w-5 h-5 text-emerald-400" /><h2 className="font-display text-lg font-bold">{t("settings.clientApp")}</h2></div>
        <p className="text-sm text-slate-400 leading-relaxed mb-4">{t("settings.clientDesc")}</p>
        {build.available ? (
          <a data-testid="download-client-btn" href={`${BACKEND_URL}/api/client-build/download`} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors">
            <Download className="w-4 h-4" /> {t("settings.download")} .zip ({mb} MB)
          </a>
        ) : <p className="text-sm text-amber-300">{t("settings.buildNA")}</p>}
      </div>
    </div>
  );
}
