import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Save, Upload, FileArchive, Loader2, ImagePlus, Trash2 } from "lucide-react";
import { api, resolveImg } from "@/lib/api";
import { useI18n } from "@/i18n";

export default function BypassManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const editing = Boolean(id);

  const [form, setForm] = useState({ title: "", app_id: "", category: "", description: "", cover_url: "" });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [item, setItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    if (!editing) return;
    api.get(`/bypasses/${id}`).then(({ data }) => {
      setItem(data);
      setForm({ title: data.title, app_id: data.app_id, category: data.category, description: data.description || "", cover_url: data.cover_url?.startsWith("http") ? data.cover_url : "" });
      setCoverPreview(resolveImg(data.cover_url));
    }).catch(() => toast.error(t("game.saveFail")));
  }, [id, editing]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onCover = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverPreview(URL.createObjectURL(file));
    if (editing) {
      const fd = new FormData();
      fd.append("cover", file);
      try { const { data } = await api.post(`/bypasses/${id}/cover`, fd); setItem(data); toast.success(t("game.coverUpdated")); }
      catch { toast.error(t("game.saveFail")); }
    } else setCoverFile(file);
  };

  const save = async () => {
    if (!form.title || !form.app_id) { toast.error(t("game.needFields")); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/bypasses/${id}`, { title: form.title, app_id: form.app_id, category: form.category, description: form.description, cover_url: form.cover_url || undefined });
        toast.success(t("bypass.updated"));
        navigate("/bypass");
      } else {
        const fd = new FormData();
        fd.append("title", form.title); fd.append("app_id", form.app_id);
        fd.append("category", form.category || "Uncategorized"); fd.append("description", form.description);
        if (coverFile) fd.append("cover", coverFile); else fd.append("cover_url", form.cover_url);
        if (fileRef.current?.files?.[0]) fd.append("file", fileRef.current.files[0]);
        const { data } = await api.post("/bypasses", fd);
        toast.success(t("bypass.created"));
        navigate(`/bypass/${data.id}`);
      }
    } catch { toast.error(t("game.saveFail")); }
    finally { setSaving(false); }
  };

  const uploadFile = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post(`/bypasses/${id}/file`, fd);
      setItem(data);
      toast.success(t("bypass.fileSet"));
      fileRef.current.value = "";
    } catch { toast.error(t("deps.uploadFail")); }
    finally { setUploading(false); }
  };

  const input = "w-full bg-[#0b0d14] border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan-500/50 text-slate-100 placeholder:text-slate-600";
  const label = "text-xs font-mono uppercase tracking-widest text-slate-400 mb-1.5 block";

  return (
    <div className="max-w-4xl">
      <button data-testid="bypass-back" onClick={() => navigate("/bypass")} className="flex items-center gap-2 text-slate-400 hover:text-slate-100 text-sm mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> {t("common.back")}</button>
      <h1 className="font-display text-3xl font-black tracking-tight mb-6">{editing ? t("bypass.manage") : t("bypass.addNew")}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <label className={label}>{t("game.cover")}</label>
          <div className="aspect-[16/10] rounded-xl overflow-hidden border border-white/10 bg-[#0b0d14] relative">
            {coverPreview ? <img src={coverPreview} alt="cover" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-slate-700"><ImagePlus className="w-10 h-10" /></div>}
          </div>
          <label className="mt-2 flex items-center justify-center gap-2 py-2 rounded-lg border border-white/10 text-xs text-slate-300 hover:border-cyan-500/40 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" /> {t("game.uploadImg")}
            <input data-testid="bypass-cover-input" type="file" accept="image/*" className="hidden" onChange={onCover} />
          </label>
          <div className="mt-2">
            <label className={label}>{t("game.orUrl")}</label>
            <input data-testid="bypass-cover-url" className={input} placeholder="https://…" value={form.cover_url} onChange={(e) => { set("cover_url")(e); setCoverPreview(e.target.value); setCoverFile(null); }} />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div><label className={label}>{t("game.title")}</label><input data-testid="bypass-title" className={input} value={form.title} onChange={set("title")} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={label}>{t("game.appid")}</label><input data-testid="bypass-appid" className={`${input} font-mono`} value={form.app_id} onChange={set("app_id")} /></div>
            <div><label className={label}>{t("game.category")}</label><input data-testid="bypass-category" className={input} value={form.category} onChange={set("category")} /></div>
          </div>
          <div><label className={label}>{t("game.desc")}</label><textarea data-testid="bypass-desc" rows={2} className={input} value={form.description} onChange={set("description")} /></div>

          {!editing && (
            <div>
              <label className={label}>{t("bypass.file")}</label>
              <input data-testid="bypass-file-new" ref={fileRef} type="file" className={input} />
            </div>
          )}

          <button data-testid="bypass-save" onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 disabled:opacity-60 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editing ? t("game.saveChanges") : t("game.create")}
          </button>
        </div>
      </div>

      {editing && item && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4"><FileArchive className="w-5 h-5 text-cyan-400" /><h2 className="font-display text-xl font-bold">{t("bypass.file")}</h2></div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 max-w-md">
            <label className="flex items-center justify-center gap-2 py-2 rounded-lg border border-cyan-500/30 text-xs text-cyan-300 hover:bg-cyan-500/10 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" /> {t("game.uploadFile")}
              <input ref={fileRef} data-testid="bypass-file-input" type="file" className="hidden" onChange={uploadFile} />
            </label>
          </div>
          {uploading && <p className="text-xs text-cyan-400 mt-3 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("game.uploading")}</p>}
          <div className="mt-4 rounded-xl border border-white/10 bg-[#10131E] max-w-2xl p-4">
            {item.file && item.file.filename ? (
              <div className="flex items-center gap-3">
                <FileArchive className="w-4 h-4 text-cyan-400" />
                <div className="flex-1 min-w-0"><div className="text-sm truncate font-mono">{item.file.filename}</div><div className="text-[11px] text-slate-500">{item.file.size < 1024 ? `${item.file.size} B` : `${(item.file.size / 1024).toFixed(1)} KB`}</div></div>
              </div>
            ) : <p className="text-sm text-slate-500 text-center">{t("bypass.noFile")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
