import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Plus, Copy, Trash2, RefreshCw, Cpu, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n";

export default function Keys() {
  const { t } = useI18n();
  const [keys, setKeys] = useState([]);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [gen, setGen] = useState(false);

  const load = () => { setLoading(true); api.get("/keys").then(({ data }) => setKeys(data)).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []);

  const generate = async () => {
    setGen(true);
    try { await api.post("/keys", { label }); toast.success(t("keys.generated")); setLabel(""); load(); }
    catch { toast.error(t("game.saveFail")); }
    finally { setGen(false); }
  };
  const copy = (k) => { navigator.clipboard.writeText(k).then(() => toast.success(t("keys.copied"))).catch(() => {}); };
  const del = async (id) => { try { await api.delete(`/keys/${id}`); load(); } catch { toast.error(t("game.saveFail")); } };
  const reset = async (id) => { try { await api.post(`/keys/${id}/reset`); toast.success(t("keys.reset") + " ✓"); load(); } catch { toast.error(t("game.saveFail")); } };

  const input = "bg-[#0b0d14] border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan-500/50 text-slate-100";

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-1"><KeyRound className="w-6 h-6 text-cyan-400" /><h1 className="font-display text-3xl font-black tracking-tight">{t("keys.title")}</h1></div>
      <p className="text-slate-400 text-sm mb-6">{t("keys.subtitle")}</p>

      <div className="glass border border-white/10 rounded-xl p-3 mb-6 flex flex-wrap items-center gap-3">
        <input data-testid="key-label-input" className={`${input} flex-1 min-w-[220px]`} placeholder={t("keys.label")} value={label} onChange={(e) => setLabel(e.target.value)} />
        <button data-testid="generate-key-btn" onClick={generate} disabled={gen} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 disabled:opacity-60 transition-colors">
          {gen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("keys.gen")}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#10131E] divide-y divide-white/5">
        {loading ? <p className="p-6 text-center text-slate-500 text-sm">{t("common.loading")}</p>
          : keys.length === 0 ? <p className="p-6 text-center text-slate-500 text-sm">{t("keys.empty")}</p>
          : keys.map((k) => (
            <div key={k.id} data-testid={`key-row-${k.id}`} className="flex items-center gap-3 px-4 py-3 flex-wrap">
              <KeyRound className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="font-mono text-sm text-cyan-200">{k.key}</span>
              {k.label && <span className="text-xs text-slate-400">· {k.label}</span>}
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${k.hwid ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" : "text-slate-400 border-white/10"}`}>
                {k.hwid ? <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> {t("keys.bound")}: {k.hwid}</span> : t("keys.unused")}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button data-testid={`copy-key-${k.id}`} onClick={() => copy(k.key)} className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/5" title={t("keys.copy")}><Copy className="w-4 h-4" /></button>
                {k.hwid && <button data-testid={`reset-key-${k.id}`} onClick={() => reset(k.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-white/5" title={t("keys.reset")}><RefreshCw className="w-4 h-4" /></button>}
                <button data-testid={`del-key-${k.id}`} onClick={() => del(k.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10" title={t("keys.revoke")}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
