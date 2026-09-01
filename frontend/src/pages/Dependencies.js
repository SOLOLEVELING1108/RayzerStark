import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Boxes, Upload, Trash2, Loader2, HardDriveDownload } from "lucide-react";
import { api } from "@/lib/api";

export default function Dependencies() {
  const [deps, setDeps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const ref = useRef();

  const load = () => {
    setLoading(true);
    api.get("/dependencies").then(({ data }) => setDeps(data)).catch(() => toast.error("Failed to load")).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const upload = async () => {
    const file = ref.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post("/dependencies", fd);
      toast.success(`Dependency added: ${file.name}`);
      ref.current.value = "";
      load();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (dep) => {
    try {
      await api.delete(`/dependencies/${dep.id}`);
      toast.success("Removed");
      load();
    } catch {
      toast.error("Remove failed");
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-1"><Boxes className="w-6 h-6 text-amber-400" /><h1 className="font-display text-3xl font-black tracking-tight">Dependencies</h1></div>
      <p className="text-slate-400 text-sm mb-6">Global DLLs installed into the Steam root by the client's "Install dependencies" button.</p>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-6">
        <p className="text-[11px] font-mono text-slate-500 mb-3 flex items-center gap-2"><HardDriveDownload className="w-3.5 h-3.5" /> → C:\Program Files (x86)\Steam\</p>
        <label className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-amber-500/30 text-sm text-amber-300 hover:bg-amber-500/10 cursor-pointer transition-colors max-w-xs">
          <Upload className="w-4 h-4" /> Upload .dll
          <input ref={ref} data-testid="dep-file-input" type="file" className="hidden" onChange={upload} />
        </label>
        {uploading && <p className="text-xs text-cyan-400 mt-3 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</p>}
      </div>

      <div className="rounded-xl border border-white/10 bg-[#10131E] divide-y divide-white/5">
        {loading ? (
          <p className="p-6 text-center text-slate-500 text-sm">Loading…</p>
        ) : deps.length === 0 ? (
          <p className="p-6 text-center text-slate-500 text-sm">No dependencies uploaded yet.</p>
        ) : (
          deps.map((d) => (
            <div key={d.id} data-testid={`dep-row-${d.id}`} className="flex items-center gap-3 px-4 py-3">
              <Boxes className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate font-mono">{d.filename}</div>
                <div className="text-[11px] text-slate-500">{d.size < 1024 ? `${d.size} B` : `${(d.size / 1024).toFixed(1)} KB`}</div>
              </div>
              <button data-testid={`remove-dep-${d.id}`} onClick={() => remove(d)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
