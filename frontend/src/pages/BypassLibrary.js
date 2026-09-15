import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChevronDown } from "lucide-react";
import { api, resolveImg } from "@/lib/api";

export default function BypassLibrary() {
  const navigate = useNavigate();
  const [bypasses, setBypasses] = useState([]);
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(20); // 🔴 Começa mostrando só 20

  useEffect(() => {
    api.get("/bypasses").then(res => setBypasses(res.data)).catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    return bypasses.filter(b => 
      b.title.toLowerCase().includes(search.toLowerCase()) || 
      String(b.app_id).includes(search)
    );
  }, [bypasses, search]);

  const visibleBypasses = filtered.slice(0, visible);

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight">Bypasses</h1>
          <p className="text-sm text-slate-400 mt-1">Gerencie os arquivos Bypass ({filtered.length} cadastrados)</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Buscar bypass ou ID..."
              value={search}
              onChange={e => { setSearch(e.target.value); setVisible(20); }}
              className="pl-9 pr-4 py-2 bg-[#0b0d14] border border-white/10 rounded-lg text-sm outline-none focus:border-cyan-500/50 text-slate-100 min-w-[250px]"
            />
          </div>
          <button onClick={() => navigate("/bypasses/new")} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black font-semibold text-sm rounded-lg hover:bg-emerald-400 transition-colors">
            <Plus className="w-4 h-4" /> Adicionar Bypass
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {visibleBypasses.map(bypass => (
          <div 
            key={bypass.id} 
            onClick={() => navigate(`/bypasses/${bypass.id}`)}
            className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-[#10131E] border border-white/5 hover:border-emerald-500/50 cursor-pointer transition-all hover:-translate-y-1"
          >
            <img 
              src={resolveImg(bypass.cover_url) || "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=400"} 
              alt={bypass.title}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              loading="lazy" // 🔴 DEIXA SUPER LEVE
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-4 flex flex-col justify-end">
              <div className="text-xs font-mono text-emerald-400 mb-1">{bypass.app_id}</div>
              <div className="font-bold text-sm leading-tight line-clamp-2">{bypass.title}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 🔴 BOTÃO DE VER MAIS INTELIGENTE 🔴 */}
      {visible < filtered.length && (
        <div className="mt-10 flex justify-center">
          <button 
            onClick={() => setVisible(prev => prev + 20)}
            className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 bg-[#10131E] text-sm font-semibold hover:bg-white/5 transition-colors"
          >
            Ver mais bypasses <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}