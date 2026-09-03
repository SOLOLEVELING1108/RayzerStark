import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Save, Upload, FileCode2, Trash2, Loader2, ImagePlus, Globe, ShoppingCart, Link2 } from "lucide-react";
import { api, resolveImg } from "@/lib/api";
import { useI18n } from "@/i18n";

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
            <div><label className={label}>{t("game.appid")}</label><input data-testid="appid-input" className={`${input} font-mono`} placeholder="223308" value={form.app_id} onChange={set("app_id")} /></div>
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

          <button data-testid="save-game-btn" onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 disabled:opacity-60 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editing ? t("game.saveChanges") : t("game.create")}
          </button>
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
