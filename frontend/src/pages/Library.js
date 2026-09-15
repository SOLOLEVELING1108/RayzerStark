import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChevronDown } from "lucide-react";
import { api, resolveImg } from "@/lib/api";

export default function Library() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(20); // Carrega de 20 em 20

  useEffect(() => {
    api.get("/games").then(res => setGames(res.data)).catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return games;
    const s = search.toLowerCase();
    return games.filter(g => 
      g.title.toLowerCase().includes(s) || 
      String(g.app_id).includes(s)
    );
  }, [games, search]);

  const visibleGames = useMemo(() => filtered.slice(0, visible), [filtered, visible]);

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight">Biblioteca</h1>
          <p className="text-sm text-slate-400 mt-1">Gerencie todos os jogos ({filtered.length} cadastrados)</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Buscar jogo ou ID..."
              value={search}
              onChange={e => { setSearch(e.target.value); setVisible(20); }}
              className="pl-9 pr-4 py-2 bg-[#0b0d14] border border-white/10 rounded-lg text-sm outline-none focus:border-cyan-500/50 text-slate-100 min-w-[250px]"
            />
          </div>
          <button onClick={() => navigate("/games/new")} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-black font-semibold text-sm rounded-lg hover:bg-cyan-400 transition-colors">
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {visibleGames.map(game => (
          <div 
            key={game.id} 
            onClick={() => navigate(`/games/${game.id}`)}
            className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-[#10131E] border border-white/5 hover:border-cyan-500 cursor-pointer"
          >
            <img 
              src={game.cover_url ? resolveImg(game.cover_url) : "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=400"} 
              alt={game.title}
              loading="lazy"
              onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=400"; }}
              className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-200"
            />
            
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-12 flex flex-col justify-end pointer-events-none">
              <div className="text-[10px] font-mono text-cyan-400 mb-0.5">{game.app_id}</div>
              <div className="font-bold text-sm leading-tight text-white line-clamp-2">{game.title}</div>
            </div>
          </div>
        ))}
      </div>

      {visible < filtered.length && (
        <div className="mt-10 flex justify-center">
          <button 
            onClick={() => setVisible(prev => prev + 20)}
            className="flex items-center gap-2 px-8 py-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-sm font-bold hover:bg-cyan-500/20 transition-colors"
          >
            Carregar mais {Math.min(20, filtered.length - visible)} jogos <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}