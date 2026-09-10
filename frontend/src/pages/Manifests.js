import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Archive, Upload, Trash2, Loader2, HardDriveDownload } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n";

export default function Manifests() {
  const { t } = useI18n();
  const [manifests, setManifests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const ref = useRef();

  const load = () => {
    setLoading(true);
    api.get("/manifests").then(({ data }) => setManifests(data)).catch(() => toast.error("Failed to load manifests")).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const upload = async () => {
    const file = ref.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post("/manifests", fd);
      toast.success("Manifest adicionado com sucesso!");
      ref.current.value = "";
      load();
    } catch {
      toast.error("Falha ao fazer upload do manifest");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (manifest) => {
    try {
      await api.delete(`/manifests/${manifest.id}`);
      toast.success("Manifest removido!");
      load();
    } catch {
      toast.error("Falha ao remover o manifest");
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-1"><Archive className="w-6 h-6 text-purple-400" /><h1 className="font-display text-3xl font-black tracking-tight">Manifests</h1></div>
      <p className="text-slate-400 text-sm mb-6">Gerencie os arquivos de manifest que serão enviados para a pasta depotcache da Steam.</p>

      <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 mb-6">
        <p className="text-[11px] font-mono text-slate-500 mb-3 flex items-center gap-2"><HardDriveDownload className="w-3.5 h-3.5" /> → C:\Program Files (x86)\Steam\depotcache\</p>
        <label className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-purple-500/30 text-sm text-purple-300 hover:bg-purple-500/10 cursor-pointer transition-colors max-w-xs">
          <Upload className="w-4 h-4" /> Enviar Manifest
          <input ref={ref} data-testid="manifest-file-input" type="file" className="hidden" onChange={upload} />
        </label>
        {uploading && <p className="text-xs text-cyan-400 mt-3 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Fazendo upload...</p>}
      </div>

      <div className="rounded-xl border border-white/10 bg-[#10131E] divide-y divide-white/5">
        {loading ? (
          <p className="p-6 text-center text-slate-500 text-sm">{t("common.loading")}</p>
        ) : manifests.length === 0 ? (
          <p className="p-6 text-center text-slate-500 text-sm">Nenhum manifest adicionado ainda.</p>
        ) : (
          manifests.map((m) => (
            <div key={m.id} data-testid={`manifest-row-${m.id}`} className="flex items-center gap-3 px-4 py-3">
              <Archive className="w-4 h-4 text-purple-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate font-mono">{m.filename}</div>
                <div className="text-[11px] text-slate-500">{m.size < 1024 ? `${m.size} B` : `${(m.size / 1024).toFixed(1)} KB`}</div>
              </div>
              <button data-testid={`remove-manifest-${m.id}`} onClick={() => remove(m)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}