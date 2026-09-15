import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Save, Upload, FileCode2, Trash2, Loader2, ImagePlus, Globe, ShoppingCart, Link2, Search, ListPlus, Download, RefreshCw } from "lucide-react";
import { api, resolveImg } from "@/lib/api";
import { useI18n } from "@/i18n";

// 🔴 O NOVO MOTOR BLINDADO COM ROTAÇÃO DE PROXIES 🔴
const fetchGameInfo = async (appId) => {
  let capa = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`; 
  
  const endpoints = [
    `https://store.steampowered.com/api/appdetails?appids=${appId}&l=brazilian`,
    `https://steamspy.com/api.php?request=appdetails&appid=${appId}`
  ];

  // Três servidores diferentes para disfarçar a conexão
  const proxies = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${url}`
  ];

  for (const endpoint of endpoints) {
    for (const proxy of proxies) {
      try {
        const res = await fetch(proxy(endpoint));
        const data = await res.json();
        
        // Se a Steam Oficial responder
        if (data[appId] && data[appId].success) {
          const jogo = data[appId].data;
          return { success: true, titulo: jogo.name, categoria: jogo.genres?.[0]?.description || "Outros", capa };
        }
        // Se o SteamSpy responder
        else if (data && data.name) {
          return { success: true, titulo: data.name, categoria: "Outros", capa };
        }
      } catch (e) {
        // Se der erro de bloqueio, tenta o próximo túnel silenciosamente
        continue;
      }
    }
  }
  return { success: false };
};

function Toggle({ checked, onChange, testid, label, icon: Icon }) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-colors ${
        checked ? "border-cyan-500/40 bg-cyan-500/10" : "border-white/10 bg-[#0b0d14]"
      }`}
    >
      <Icon className={`w-4 h-4 ${checked ? "text-cyan-300" : "text-slate-500"}`} />
      <span className={`text-sm font-medium ${checked ? "text-cyan-200" : "text-slate-300"}`}>{label}</span>
      <span className={`ml-auto w-10 h-5 rounded-full relative transition-colors ${checked ? "bg-cyan-500" : "bg-slate-700"}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export default function GameManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const editing = Boolean(id);

  const [form, setForm] = useState({ title: "", app_id: "", category: "", description: "", cover_url: "", is_public: false, in_store: false, price: 0 });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [game, setGame] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bypasses, setBypasses] = useState([]);
  
  const luaRef = useRef();
  const bulkRef = useRef();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkIds, setBulkIds] = useState("");

  useEffect(() => { api.get("/bypasses").then(({ data }) => setBypasses(data)).catch(() => {}); }, []);
  const norm = (s) => (s == null ? "" : String(s)).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const matchedBp = bypasses.find((b) => (norm(b.title) && norm(b.title) === norm(form.title)) || (form.app_id && String(b.app_id) === String(form.app_id)));

  useEffect(() => {
    if (!editing) return;
    api.get(`/games/${id}`).then(({ data }) => {
      setGame(data);
      setForm({
        title: data.title, app_id: data.app_id, category: data.category, description: data.description || "",
        cover_url: data.cover_url?.startsWith("http") ? data.cover_url : "",
        is_public: !!data.is_public, in_store: !!data.in_store, price: Number(data.price) || 0,
      });
      setCoverPreview(resolveImg(data.cover_url));
    }).catch(() => toast.error("Game not found"));
  }, [id, editing]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setVal = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const fetchSteamData = async () => {
    if (!form.app_id) {
      toast.error("Digite o App ID primeiro!");
      return;
    }
    const loadToast = toast.loading("Buscando na Steam...");
    const info = await fetchGameInfo(form.app_id);

    if (info.success && info.titulo) {
      setForm(f => ({ ...f, title: info.titulo, category: info.categoria, cover_url: info.capa }));
      setCoverPreview(info.capa);
      setCoverFile(null);
      toast.success("Nome do jogo encontrado com sucesso!", { id: loadToast });
    } else {
      toast.error("Não foi possível encontrar o nome desse jogo. Verifique o ID.", { id: loadToast });
    }
  };

  const processBulkIds = async () => {
    const rawIds = bulkIds.split(/[\n,]+/).map(id => id.trim()).filter(Boolean);
    if (!rawIds.length) return;

    setBulkBusy(true);
    const loadToast = toast.loading(`Analisando ${rawIds.length} IDs no banco de dados...`);

    try {
      const { data: existingGames } = await api.get("/games");
      const existingAppIds = new Set(existingGames.map(g => String(g.app_id)));

      const newIds = [];
      let skipped = 0;
      
      for (const id of rawIds) {
        if (existingAppIds.has(String(id))) {
          skipped++; 
        } else {
          newIds.push(id); 
        }
      }

      if (newIds.length === 0) {
        setBulkBusy(false);
        toast.success(`Nenhum jogo novo. Todos os ${skipped} já estavam na sua biblioteca!`, { id: loadToast });
        return;
      }

      let ok = 0, fail = 0;

      for (let i = 0; i < newIds.length; i++) {
        const appId = newIds[i];
        toast.loading(`Baixando ${i + 1} de ${newIds.length} jogos... (${skipped} ignorados)`, { id: loadToast });

        const info = await fetchGameInfo(appId);

        if (info.success && info.titulo) {
          try {
            const fd = new FormData();
            fd.append("title", info.titulo);
            fd.append("app_id", String(appId));
            fd.append("category", info.categoria);
            fd.append("description", "");
            fd.append("is_public", "true");
            fd.append("in_store", "false");
            fd.append("price", "0");
            fd.append("cover_url", info.capa);

            await api.post("/games", fd);
            ok++;
          } catch (e) {
            fail++; 
          }
        } else {
          fail++; 
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      setBulkIds(""); 
      if (fail > 0) {
        toast.error(`${ok} Salvos, ${fail} Erros. Recarregando...`, { id: loadToast });
      } else {
        toast.success(`TUDO CERTO! ${ok} Salvos. Recarregando...`, { id: loadToast });
      }
      setTimeout(() => { window.location.href = "/"; }, 2500);
    } catch (error) {
      toast.error("Erro crítico ao verificar a biblioteca.", { id: loadToast });
    } finally {
      setBulkBusy(false);
    }
  };

  // 🔴 ROBÔ CORRETOR SUPREMO: Limpa a sujeira do Banco de Dados 🔴
  const fixBuggedGames = async () => {
    setBulkBusy(true);
    const loadToast = toast.loading("Mapeando biblioteca...");
    
    try {
      const { data: allGames } = await api.get("/games");
      // Mapeia literalmente qualquer título que comece com "jogo " (ex: "Jogo 39210")
      const buggedGames = allGames.filter(g => g.title && g.title.toLowerCase().startsWith("jogo "));

      if (buggedGames.length === 0) {
        toast.success("Nenhum nome bugado encontrado! A biblioteca está limpa.", { id: loadToast });
        setBulkBusy(false);
        return;
      }

      toast.loading(`Encontrados ${buggedGames.length} jogos bugados. Iniciando varredura lenta...`, { id: loadToast });
      let fixed = 0, failed = 0;

      for (let i = 0; i < buggedGames.length; i++) {
        const game = buggedGames[i];
        toast.loading(`Corrigindo ${i + 1}/${buggedGames.length}: APPID ${game.app_id}...`, { id: loadToast });

        const info = await fetchGameInfo(game.app_id);
        
        if (info.success && info.titulo) {
          try {
            await api.put(`/games/${game.id}`, {
              title: info.titulo,
              app_id: game.app_id,
              category: info.categoria || game.category || "Outros",
              description: game.description || "",
              cover_url: info.capa || game.cover_url,
              is_public: !!game.is_public,
              in_store: !!game.in_store,
              price: Number(game.price) || 0
            });
            fixed++;
          } catch (e) {
            failed++;
          }
        } else {
          failed++;
        }

        // Freio longo de 3 segundos pra Steam deixar o robô trabalhar em paz!
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      toast.success(`Faxina Concluída! ${fixed} Nomes corrigidos, ${failed} falhas de bloqueio. Recarregando...`, { id: loadToast });
      setTimeout(() => { window.location.href = "/"; }, 2500);

    } catch (e) {
      toast.error("Falha ao se conectar com o banco de dados.", { id: loadToast });
    } finally {
      setBulkBusy(false);
    }
  };

  const importBulk = async () => {
    const files = Array.from(bulkRef.current?.files || []);
    if (!files.length) return;
    setBulkBusy(true); setBulkResult(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const { data } = await api.post("/games/bulk-lua", fd);
      setBulkResult(data);
      toast.success(`${data.count} ${t("game.bulkDone")}`);
      if (bulkRef.current) bulkRef.current.value = "";
    } catch (e) {
      toast.error(e.response?.data?.detail || t("game.saveFail"));
    } finally { setBulkBusy(false); }
  };

  const onCover = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverPreview(URL.createObjectURL(file));
    if (editing) {
      try {
        const fd = new FormData();
        fd.append("cover", file);
        const { data } = await api.post(`/games/${id}/cover`, fd);
        setGame(data);
        toast.success(t("game.coverUpdated"));
      } catch {
        toast.error(t("game.saveFail"));
      }
    } else {
      setCoverFile(file);
    }
  };

  const save = async () => {
    if (!form.title || !form.app_id) { toast.error(t("game.needFields")); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/games/${id}`, {
          title: form.title, app_id: form.app_id, category: form.category, description: form.description,
          cover_url: form.cover_url || undefined, is_public: form.is_public, in_store: form.in_store, price: Number(form.price),
        });
        toast.success(t("game.updated"));
        navigate("/");
      } else {
        const fd = new FormData();
        fd.append("title", form.title);
        fd.append("app_id", form.app_id);
        fd.append("category", form.category || "Uncategorized");
        fd.append("description", form.description);
        fd.append("is_public", form.is_public);
        fd.append("in_store", form.in_store);
        fd.append("price", Number(form.price));
        if (coverFile) fd.append("cover", coverFile);
        else fd.append("cover_url", form.cover_url);
        const { data } = await api.post("/games", fd);
        toast.success(t("game.created"));
        navigate(`/games/${data.id}`);
      }
    } catch {
      toast.error(t("game.saveFail"));
    } finally {
      setSaving(false);
    }
  };

  const deleteGame = async () => {
    if (!window.confirm("ATENÇÃO: Tem certeza que deseja excluir este jogo permanentemente da biblioteca?")) return;
    
    try {
      await api.delete(`/games/${id}`);
      toast.success("Jogo excluído com sucesso!");
      navigate("/");
    } catch (error) {
      toast.error("Erro ao excluir o jogo. Tente novamente.");
    }
  };

  const uploadLua = async () => {
    const files = Array.from(luaRef.current?.files || []);
    if (!files.length) return;
    setUploading(true);
    let ok = 0, fail = 0, latest = game;
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post(`/games/${id}/lua`, fd);
        latest = data; ok++;
      } catch { fail++; }
    }
    setGame(latest);
    if (luaRef.current) luaRef.current.value = "";
    setUploading(false);
    if (fail) toast.error(`${ok} ${t("game.fileAdded")}, ${fail} ✕`);
    else toast.success(`${ok} × ${t("game.fileAdded")}`);
  };

  const removeLua = async (fileId) => {
    try {
      const { data } = await api.delete(`/games/${id}/lua/${fileId}`);
      setGame(data);
      toast.success("File removed");
    } catch {
      toast.error("Remove failed");
    }
  };

  const input = "w-full bg-[#0b0d14] border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan-500/50 text-slate-100 placeholder:text-slate-600";
  const label = "text-xs font-mono uppercase tracking-widest text-slate-400 mb-1.5 block";

  return (
    <div className="max-w-4xl">
      <button data-testid="back-btn" onClick={() => navigate("/")} className="flex items-center gap-2 text-slate-400 hover:text-slate-100 text-sm mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("common.back")}
      </button>
      <h1 className="font-display text-3xl font-black tracking-tight mb-6">{editing ? t("game.manage") : t("game.add")}</h1>

      {!editing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          
          <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.04] p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-2"><ListPlus className="w-5 h-5 text-cyan-400" /><h2 className="font-display text-lg font-bold">Puxar Vários IDs (Steam)</h2></div>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">Cole os App IDs. O sistema salvará TODOS os jogos como <strong>Público</strong>.</p>
            <textarea 
              className={`${input} h-28 mb-3 resize-none`} 
              placeholder={`Ex:\n1971870\n1888930\n1086940`} 
              value={bulkIds} 
              onChange={(e) => setBulkIds(e.target.value)} 
            />
            
            <div className="mt-auto flex flex-col gap-2">
              <button 
                onClick={processBulkIds} 
                disabled={bulkBusy || !bulkIds.trim()} 
                className="w-full flex justify-center items-center gap-2 px-4 py-2.5 rounded-lg border border-cyan-500/40 text-sm font-semibold transition-colors disabled:opacity-50 text-cyan-300 hover:bg-cyan-500/10"
              >
                {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {bulkBusy ? "Processando..." : "Adicionar Jogos"}
              </button>

              <button 
                onClick={fixBuggedGames} 
                disabled={bulkBusy} 
                className="w-full flex justify-center items-center gap-2 px-4 py-2 rounded-lg border border-orange-500/40 text-xs font-semibold transition-colors disabled:opacity-50 text-orange-400 hover:bg-orange-500/10"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Corrigir Nomes Genéricos (Auto-Fix)
              </button>
            </div>
          </div>

          <div data-testid="bulk-import-card" className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-2"><FileCode2 className="w-5 h-5 text-emerald-400" /><h2 className="font-display text-lg font-bold">{t("game.bulkTitle")}</h2></div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">{t("game.bulkDesc")}</p>
            <div className="flex flex-col gap-3 mb-4">
              <label className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-emerald-500/40 text-sm font-semibold cursor-pointer transition-colors ${bulkBusy ? "opacity-60 pointer-events-none" : "text-emerald-300 hover:bg-emerald-500/10"}`}>
                {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Selecionar arquivos .lua
                <input ref={bulkRef} data-testid="bulk-lua-input" type="file" accept=".lua" multiple className="hidden" onChange={importBulk} />
              </label>
              <span className="text-[11px] text-slate-500 text-center">{t("game.bulkHint")}</span>
            </div>
            
            {bulkResult && (
              <div className="mt-auto rounded-xl border border-white/10 bg-[#10131E] divide-y divide-white/5 max-h-32 overflow-y-auto">
                {bulkResult.created.map((g) => (
                  <div key={g.id} data-testid={`bulk-row-${g.app_id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="font-mono text-emerald-300">{g.app_id}</span>
                    <span className="truncate flex-1 text-slate-300">{g.title}</span>
                    <button onClick={() => navigate(`/games/${g.id}`)} className="text-[11px] text-emerald-400 hover:underline whitespace-nowrap">{t("game.bulkEdit")}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!editing && <div className="mb-8 flex items-center gap-3 text-[10px] uppercase tracking-widest text-slate-600"><div className="h-px flex-1 bg-white/10" />OU ADICIONAR UM JOGO MANUALMENTE<div className="h-px flex-1 bg-white/10" /></div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <label className={label}>{t("game.cover")}</label>
          <div className="aspect-[16/10] rounded-xl overflow-hidden border border-white/10 bg-[#0b0d14] relative">
            {coverPreview ? <img src={coverPreview} alt="cover" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-slate-700"><ImagePlus className="w-10 h-10" /></div>}
          </div>
          <label className="mt-2 flex items-center justify-center gap-2 py-2 rounded-lg border border-white/10 text-xs text-slate-300 hover:border-cyan-500/40 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" /> {t("game.uploadImg")}
            <input data-testid="cover-file-input" type="file" accept="image/*" className="hidden" onChange={onCover} />
          </label>
          <div className="mt-2">
            <label className={label}>{t("game.orUrl")}</label>
            <input data-testid="cover-url-input" className={input} placeholder="https://…" value={form.cover_url} onChange={(e) => { set("cover_url")(e); setCoverPreview(e.target.value); setCoverFile(null); }} />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div><label className={label}>{t("game.title")}</label><input data-testid="title-input" className={input} placeholder="Resident Evil 2 Remake" value={form.title} onChange={set("title")} /></div>
          {matchedBp && <p data-testid="bypass-linked-note" className="text-xs text-cyan-400 flex items-center gap-1.5 -mt-2"><Link2 className="w-3.5 h-3.5" /> {t("game.bypassLinked")}: {matchedBp.title}</p>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>{t("game.appid")}</label>
              <div className="flex gap-2">
                <input data-testid="appid-input" className={`${input} font-mono flex-1`} placeholder="223308" value={form.app_id} onChange={set("app_id")} />
                <button type="button" onClick={fetchSteamData} className="px-4 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors flex items-center justify-center border border-cyan-500/30 font-semibold text-sm">
                  <Search className="w-4 h-4 mr-1.5" /> Buscar
                </button>
              </div>
            </div>
            <div><label className={label}>{t("game.category")}</label><input data-testid="category-input" className={input} placeholder="Horror / Action" value={form.category} onChange={set("category")} /></div>
          </div>
          <div><label className={label}>{t("game.desc")}</label><textarea data-testid="description-input" rows={2} className={input} placeholder="…" value={form.description} onChange={set("description")} /></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Toggle testid="toggle-public" checked={form.is_public} onChange={(v) => setVal("is_public", v)} label={t("game.public")} icon={Globe} />
            <Toggle testid="toggle-store" checked={form.in_store} onChange={(v) => setVal("in_store", v)} label={t("game.sell")} icon={ShoppingCart} />
          </div>
          
          {form.in_store && (
            <div className="max-w-[220px]">
              <label className={label}>{t("game.price")}</label>
              <input data-testid="price-input" type="number" min="0" step="0.01" className={`${input} font-mono`} value={form.price} onChange={set("price")} />
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button data-testid="save-game-btn" onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 disabled:opacity-60 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editing ? t("game.saveChanges") : t("game.create")}
            </button>
            
            {editing && (
              <button type="button" onClick={deleteGame} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 text-red-500 font-semibold text-sm hover:bg-red-500/20 transition-colors border border-red-500/30">
                <Trash2 className="w-4 h-4" /> Excluir
              </button>
            )}
          </div>
        </div>
      </div>

      {editing && game && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4"><FileCode2 className="w-5 h-5 text-emerald-400" /><h2 className="font-display text-xl font-bold">{t("game.files")}</h2></div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 max-w-md">
            <p className="text-[11px] font-mono text-slate-500 mb-3">Injected into → C:\Program Files (x86)\Steam\config\lua\</p>
            <label className="flex items-center justify-center gap-2 py-2 rounded-lg border border-emerald-500/30 text-xs text-emerald-300 hover:bg-emerald-500/10 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" /> {t("game.uploadFile")}
              <input ref={luaRef} data-testid="lua-file-input" type="file" accept=".lua,text/*" multiple className="hidden" onChange={uploadLua} />
            </label>
            <p className="text-[11px] text-cyan-400/90 mt-2 leading-relaxed">{t("game.uploadMultiHint")}</p>
          </div>
          {uploading && <p className="text-xs text-cyan-400 mt-3 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</p>}
          <div className="mt-4 rounded-xl border border-white/10 bg-[#10131E] divide-y divide-white/5 max-w-2xl">
            {(game.lua_files || []).length === 0 ? (
              <p className="p-5 text-sm text-slate-500 text-center">No .lua files attached yet.</p>
            ) : (
              game.lua_files.map((f) => (
                <div key={f.id} data-testid={`file-row-${f.id}`} className="flex items-center gap-3 px-4 py-3">
                  <FileCode2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate font-mono">{f.filename}</div>
                    <div className="text-[11px] text-slate-500">{f.size < 1024 ? `${f.size} B` : `${(f.size / 1024).toFixed(1)} KB`}</div>
                  </div>
                  <button data-testid={`remove-file-${f.id}`} onClick={() => removeLua(f.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}