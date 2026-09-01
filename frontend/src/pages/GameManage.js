import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Upload, Boxes, FileCode2, Trash2, Loader2, ImagePlus, HardDriveDownload,
} from "lucide-react";
import { api, resolveImg } from "@/lib/api";

export default function GameManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [form, setForm] = useState({ title: "", app_id: "", category: "", description: "", cover_url: "" });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [game, setGame] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dllRef = useRef();
  const luaRef = useRef();

  useEffect(() => {
    if (!editing) return;
    api.get(`/games/${id}`).then(({ data }) => {
      setGame(data);
      setForm({
        title: data.title, app_id: data.app_id, category: data.category,
        description: data.description, cover_url: data.cover_url?.startsWith("http") ? data.cover_url : "",
      });
      setCoverPreview(resolveImg(data.cover_url));
    }).catch(() => toast.error("Game not found"));
  }, [id, editing]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onCover = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (!form.title || !form.app_id) {
      toast.error("Title and App ID are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/games/${id}`, form);
        if (coverFile) await uploadCoverOnEdit();
        toast.success("Game updated");
        navigate("/");
      } else {
        const fd = new FormData();
        fd.append("title", form.title);
        fd.append("app_id", form.app_id);
        fd.append("category", form.category || "Uncategorized");
        fd.append("description", form.description);
        if (coverFile) fd.append("cover", coverFile);
        else fd.append("cover_url", form.cover_url);
        const { data } = await api.post("/games", fd);
        toast.success("Game created");
        navigate(`/games/${data.id}`);
      }
    } catch (e) {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  // On edit, cover file upload goes through a fresh create-style call is not available;
  // simplest: re-create not needed. We update cover via a dedicated multipart? Backend PUT is JSON only.
  // For edit, we support external URL via form; file cover only applied on create.
  const uploadCoverOnEdit = async () => {
    toast.message("Cover image upload is only applied when creating a game. Use an image URL to change it here.");
  };

  const uploadFile = async (type, fileInput) => {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file_type", type);
      fd.append("file", file);
      const { data } = await api.post(`/games/${id}/files`, fd);
      setGame(data);
      toast.success(`${type.toUpperCase()} added: ${file.name}`);
      fileInput.current.value = "";
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async (fileId) => {
    try {
      const { data } = await api.delete(`/games/${id}/files/${fileId}`);
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
      <button
        data-testid="back-btn"
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-100 text-sm mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Library
      </button>

      <h1 className="font-display text-3xl font-black tracking-tight mb-6">
        {editing ? "Manage Game" : "Add New Game"}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cover */}
        <div>
          <label className={label}>Cover</label>
          <div className="aspect-[16/10] rounded-xl overflow-hidden border border-white/10 bg-[#0b0d14] relative group">
            {coverPreview ? (
              <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-slate-700">
                <ImagePlus className="w-10 h-10" />
              </div>
            )}
          </div>
          {!editing && (
            <label className="mt-2 flex items-center justify-center gap-2 py-2 rounded-lg border border-white/10 text-xs text-slate-300 hover:border-cyan-500/40 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" /> Upload image
              <input data-testid="cover-file-input" type="file" accept="image/*" className="hidden" onChange={onCover} />
            </label>
          )}
          <div className="mt-2">
            <label className={label}>…or image URL</label>
            <input data-testid="cover-url-input" className={input} placeholder="https://…" value={form.cover_url} onChange={(e) => { set("cover_url")(e); setCoverPreview(e.target.value); setCoverFile(null); }} />
          </div>
        </div>

        {/* Fields */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <label className={label}>Game Title</label>
            <input data-testid="title-input" className={input} placeholder="Resident Evil 2 Remake" value={form.title} onChange={set("title")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Steam App ID</label>
              <input data-testid="appid-input" className={`${input} font-mono`} placeholder="223308" value={form.app_id} onChange={set("app_id")} />
            </div>
            <div>
              <label className={label}>Category</label>
              <input data-testid="category-input" className={input} placeholder="Horror / Action" value={form.category} onChange={set("category")} />
            </div>
          </div>
          <div>
            <label className={label}>Description</label>
            <textarea data-testid="description-input" rows={3} className={input} placeholder="Short description…" value={form.description} onChange={set("description")} />
          </div>
          <button
            data-testid="save-game-btn"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editing ? "Save Changes" : "Create Game"}
          </button>
        </div>
      </div>

      {/* Files section (edit only) */}
      {editing && game && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <HardDriveDownload className="w-5 h-5 text-cyan-400" />
            <h2 className="font-display text-xl font-bold">Injection Files</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* DLL uploader */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 text-amber-400 mb-1"><Boxes className="w-4 h-4" /><span className="font-semibold text-sm">DLL Dependencies</span></div>
              <p className="text-[11px] font-mono text-slate-500 mb-3">→ C:\Program Files (x86)\Steam\</p>
              <label className="flex items-center justify-center gap-2 py-2 rounded-lg border border-amber-500/30 text-xs text-amber-300 hover:bg-amber-500/10 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" /> Upload .dll
                <input ref={dllRef} data-testid="dll-file-input" type="file" className="hidden" onChange={() => uploadFile("dll", dllRef)} />
              </label>
            </div>

            {/* LUA uploader */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 text-emerald-400 mb-1"><FileCode2 className="w-4 h-4" /><span className="font-semibold text-sm">LUA Scripts</span></div>
              <p className="text-[11px] font-mono text-slate-500 mb-3">→ C:\Program Files (x86)\Steam\config\lua\</p>
              <label className="flex items-center justify-center gap-2 py-2 rounded-lg border border-emerald-500/30 text-xs text-emerald-300 hover:bg-emerald-500/10 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" /> Upload .lua
                <input ref={luaRef} data-testid="lua-file-input" type="file" accept=".lua,text/*" className="hidden" onChange={() => uploadFile("lua", luaRef)} />
              </label>
            </div>
          </div>

          {uploading && <p className="text-xs text-cyan-400 mt-3 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</p>}

          <div className="mt-4 rounded-xl border border-white/10 bg-[#10131E] divide-y divide-white/5">
            {game.files.length === 0 ? (
              <p className="p-5 text-sm text-slate-500 text-center">No files attached yet.</p>
            ) : (
              game.files.map((f) => (
                <div key={f.id} data-testid={`file-row-${f.id}`} className="flex items-center gap-3 px-4 py-3">
                  {f.type === "dll" ? <Boxes className="w-4 h-4 text-amber-400 shrink-0" /> : <FileCode2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate font-mono">{f.original_filename}</div>
                    <div className="text-[11px] text-slate-500">{f.type.toUpperCase()} · {f.size < 1024 ? `${f.size} B` : `${(f.size / 1024).toFixed(1)} KB`}</div>
                  </div>
                  <button
                    data-testid={`remove-file-${f.id}`}
                    onClick={() => removeFile(f.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
