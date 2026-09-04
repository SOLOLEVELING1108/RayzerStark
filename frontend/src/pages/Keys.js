import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Plus, Copy, Trash2, RefreshCw, Cpu, Loader2, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n";

export default function Keys() {
  const { t } = useI18n();
  const role = localStorage.getItem("role") || "admin";
  const isAdmin = role === "admin";
  const [keys, setKeys] = useState([]);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [gen, setGen] = useState(false);
  // admin-only
  const [affiliates, setAffiliates] = useState([]);
  const [affName, setAffName] = useState("");
  const [affGen, setAffGen] = useState(false);
  const [filter, setFilter] = useState("");

  const load = () => {
    setLoading(true);
    const q = isAdmin && filter ? `?affiliate_id=${filter}` : "";
    api.get(`/keys${q}`).then(({ data }) => setKeys(data)).catch(() => {}).finally(() => setLoading(false));
  };
  const loadAff = () => { if (isAdmin) api.get("/affiliates").then(({ data }) => setAffiliates(data)).catch(() => {}); };
  useEffect(() => { loadAff(); }, []);
  useEffect(load, [filter]);

  const generate = async () => {
    if (!form.full_name || !form.email || !form.phone) { toast.error(t("keys.needFields")); return; }
    setGen(true);
    try { await api.post("/keys", form); toast.success(t("keys.generated")); setForm({ full_name: "", email: "", phone: "" }); load(); }
    catch (e) { toast.error(e.response?.data?.detail || t("game.saveFail")); }
    finally { setGen(false); }
  };
  const genAffiliate = async () => {
    if (!affName.trim()) { toast.error(t("aff.needName")); return; }
    setAffGen(true);
    try { const { data } = await api.post("/affiliates", { name: affName.trim() }); toast.success(`${t("aff.created")}: ${data.key}`); setAffName(""); loadAff(); }
    catch (e) { toast.error(e.response?.data?.detail || t("game.saveFail")); }
    finally { setAffGen(false); }
  };
  const delAffiliate = async (id) => { if (!window.confirm(t("aff.confirmDel"))) return; try { await api.delete(`/affiliates/${id}`); loadAff(); } catch { toast.error(t("game.saveFail")); } };
  const copy = (k) => { navigator.clipboard.writeText(k).then(() => toast.success(t("keys.copied"))).catch(() => {}); };
  const del = async (id) => { if (!window.confirm(t("keys.confirmDel"))) return; try { await api.delete(`/keys/${id}`); load(); } catch { toast.error(t("game.saveFail")); } };
  const reset = async (id) => { try { await api.post(`/keys/${id}/reset`); toast.success(t("keys.reset") + " ✓"); load(); } catch { toast.error(t("game.saveFail")); } };

  const input = "bg-[#0b0d14] border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan-500/50 text-slate-100";

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-1"><KeyRound className="w-6 h-6 text-cyan-400" /><h1 className="font-display text-3xl font-black tracking-tight">{t("keys.title")}</h1></div>
      <p className="text-slate-400 text-sm mb-6">{isAdmin ? t("keys.subtitle") : t("aff.subtitle")}</p>

      {isAdmin && (
        <div data-testid="affiliates-section" className="glass border border-cyan-500/25 bg-cyan-500/[0.04] rounded-xl p-4 mb-8">
          <div className="flex items-center gap-2 mb-3"><Users className="w-5 h-5 text-cyan-400" /><h2 className="font-display text-lg font-bold">{t("aff.title")}</h2></div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input data-testid="affiliate-name-input" className={input} placeholder={t("aff.name")} value={affName} onChange={(e) => setAffName(e.target.value)} />
            <button data-testid="create-affiliate-btn" onClick={genAffiliate} disabled={affGen} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 disabled:opacity-60 transition-colors">
              {affGen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("aff.gen")}
            </button>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#10131E] divide-y divide-white/5">
            {affiliates.length === 0 ? <p className="p-4 text-center text-slate-500 text-sm">{t("aff.empty")}</p>
              : affiliates.map((a) => (
                <div key={a.id} data-testid={`affiliate-row-${a.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm flex-wrap">
                  <Users className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="font-semibold">{a.name}</span>
                  <span className="font-mono text-cyan-200">{a.key}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <button data-testid={`copy-affiliate-${a.id}`} onClick={() => copy(a.key)} className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/5" title={t("keys.copy")}><Copy className="w-4 h-4" /></button>
                    <button data-testid={`del-affiliate-${a.id}`} onClick={() => delAffiliate(a.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10" title={t("aff.del")}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="glass border border-white/10 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input data-testid="key-name-input" className={input} placeholder={t("keys.name")} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <input data-testid="key-email-input" className={input} placeholder={t("keys.email")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input data-testid="key-phone-input" className={input} placeholder={t("keys.phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <button data-testid="generate-key-btn" onClick={generate} disabled={gen} className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 disabled:opacity-60 transition-colors">
          {gen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("keys.gen")}
        </button>
      </div>

      {isAdmin && affiliates.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-slate-400">{t("aff.filter")}:</span>
          <select data-testid="affiliate-filter" className={input + " py-1.5"} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">{t("aff.filterAll")}</option>
            <option value="__none__" disabled>──────</option>
            {affiliates.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-[#10131E] divide-y divide-white/5">
        {loading ? <p className="p-6 text-center text-slate-500 text-sm">{t("common.loading")}</p>
          : keys.length === 0 ? <p className="p-6 text-center text-slate-500 text-sm">{t("keys.empty")}</p>
          : keys.map((k) => (
            <div key={k.id} data-testid={`key-row-${k.id}`} className="px-4 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <KeyRound className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="font-mono text-sm text-cyan-200">{k.key}</span>
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${k.hwid ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" : "text-slate-400 border-white/10"}`}>
                  {k.hwid ? <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> {t("keys.bound")}: {k.hwid}</span> : t("keys.unused")}
                </span>
                {isAdmin && k.affiliate_name && <span className="text-[11px] px-2 py-0.5 rounded border border-cyan-500/30 text-cyan-300 flex items-center gap-1"><Users className="w-3 h-3" />{k.affiliate_name}</span>}
                <div className="ml-auto flex items-center gap-2">
                  <button data-testid={`copy-key-${k.id}`} onClick={() => copy(k.key)} className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/5" title={t("keys.copy")}><Copy className="w-4 h-4" /></button>
                  {k.hwid && <button data-testid={`reset-key-${k.id}`} onClick={() => reset(k.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-white/5" title={t("keys.reset")}><RefreshCw className="w-4 h-4" /></button>}
                  <button data-testid={`del-key-${k.id}`} onClick={() => del(k.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10" title={t("keys.revoke")}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="mt-1.5 ml-7 text-[12px] text-slate-400 flex flex-wrap gap-x-4 gap-y-0.5">
                {k.full_name && <span className="text-slate-200">{k.full_name}</span>}
                {k.email && <span className="font-mono">✉ {k.email}</span>}
                {k.phone && <span className="font-mono">☎ {k.phone}</span>}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
