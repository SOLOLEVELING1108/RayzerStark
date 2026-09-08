import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Search, Plus, Settings2, Trash2, ShieldCheck, FileArchive, RefreshCw, ChevronDown } from "lucide-react";
import { api, resolveImg } from "@/lib/api";
import { useI18n } from "@/i18n";

export default function BypassLibrary() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // NOVA REGRA: Começa mostrando apenas 30 na tela
  const [visibleCount, setVisibleCount] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/bypasses", { params: { search: search || undefined } });
      setItems(data);
    } catch {
      toast.error(t("lib.loadFail"));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => {
    const tm = setTimeout(load, 250);
    return () => clearTimeout(tm);
  }, [load]);

  // Se o usuário pesquisar algo, reseta para mostrar os primeiros 30 resultados da pesquisa
  useEffect(() => {
    setVisibleCount(30);
  }, [search]);

  const del = async (b) => {
    if (!window.confirm(`${t("common.delete")} "${b.title}"?`)) return;
    try {
      await api.delete(`/bypasses/${b.id}`);
      toast.success(t("bypass.removed"));
      load();
    } catch {
      toast.error(t("game.saveFail"));
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    toast.loading("Sincronizando com o GitHub...", { id: "sync-toast" });
    try {
      const { data } = await api.get("/system/force-sync");
      toast.success(data.message || "Sincronização concluída com sucesso!", { id: "sync-toast" });
      load(); // Recarrega a tela com os novos bypasses
    } catch (error) {
      toast.error("Erro ao sincronizar os Bypasses.", { id: "sync-toast" });
    } finally {
      setSyncing(false);
    }
  };

  // Separa apenas a quantidade de itens que devem ser desenhados na tela
  const visibleItems = useMemo(() => {
    return items.slice(0, visibleCount);
  }, [items, visibleCount]);

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight">{t("bypass.title")}</h1>
          <p className="text-slate-400 mt-1 text-sm">{t("bypass.subtitle")}</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* BOTÃO DE SINCRONIZAÇÃO */}
          <button 
            onClick={handleSync} 
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-cyan-500/50 text-cyan-400 font-semibold text-sm hover:bg-cyan-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> 
            {syncing ? "Sincronizando..." : "Sincronizar Bypasses"}
          </button>

          <button data-testid="add-bypass-btn" onClick={() => navigate("/bypass/new")} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors">
            <Plus className="w-4 h-4" /> {t("bypass.add")}
          </button>
        </div>
      </div>

      <div className="glass border border-white/10 rounded-xl p-3 mb-6 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input data-testid="bypass-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("bypass.searchPh")}
            className="w-full bg-[#0b0d14] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-cyan-500/50 text-slate-100 placeholder:text-slate-600" />
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-white/10 rounded-2xl">
          <ShieldCheck className="w-12 h-12 mx-auto text-slate-700" />
          <p className="mt-4 text-slate-400">{t("bypass.empty")}</p>
          <button onClick={() => navigate("/bypass/new")} className="mt-4 text-cyan-400 text-sm font-semibold hover:underline">{t("bypass.addFirst")}</button>
        </div>
      ) : (
        <>
          <div data-testid="bypass-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {visibleItems.map((b) => (
              <div key={b.id} data-testid={`bypass-card-${b.app_id}`} className="group rounded-2xl overflow-hidden border border-white/10 bg-[#10131E] card-glow transition-shadow animate-fade-up">
                <div className="relative aspect-[16/10] overflow-hidden bg-[#0b0d14]">
                  {b.cover_url ? <img src={resolveImg(b.cover_url)} alt={b.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="w-full h-full grid place-items-center text-slate-700"><ShieldCheck className="w-12 h-12" /></div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#10131E] via-transparent to-transparent" />
                  <span className="absolute top-3 left-3 font-mono text-[11px] px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 backdrop-blur">APPID {b.app_id}</span>
                </div>
                <div className="p-4">
                  <h3 className="font-display font-bold text-[15px] truncate">{b.title}</h3>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mt-0.5">{b.category}</p>
                  <div className="flex items-center gap-2 mt-3 text-[11px] font-mono">
                    {b.file && b.file.filename ? <span className="flex items-center gap-1 text-cyan-400"><FileArchive className="w-3.5 h-3.5" />{b.file.filename}</span> : <span className="text-amber-400">{t("bypass.noFile")}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <button data-testid={`bypass-manage-${b.app_id}`} onClick={() => navigate(`/bypass/${b.id}`)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-cyan-500 text-black text-sm font-semibold hover:bg-cyan-400 transition-colors"><Settings2 className="w-4 h-4" /> {t("common.manage")}</button>
                    <button data-testid={`bypass-delete-${b.app_id}`} onClick={() => del(b)} className="p-2 rounded-lg border border-white/10 text-slate-300 hover:text-red-400 hover:border-red-500/40 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* BOTÃO DE CARREGAR MAIS (SÓ APARECE SE TIVER MAIS PARA MOSTRAR) */}
          {visibleCount < items.length && (
            <div className="mt-10 mb-6 flex justify-center">
              <button 
                onClick={() => setVisibleCount(prev => prev + 30)}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#10131E] border border-cyan-500/30 text-cyan-400 font-semibold text-sm hover:bg-cyan-500/10 hover:border-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              >
                <ChevronDown className="w-5 h-5 animate-bounce" />
                Mostrar mais 30 Bypasses (Faltam {items.length - visibleCount})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}