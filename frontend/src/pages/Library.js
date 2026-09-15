import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChevronDown } from "lucide-react";
import { api, resolveImg } from "@/lib/api";

export default function Library() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(20); // 🔴 Começa mostrando só 20

  useEffect(() => {
    api.get("/games").then(res => setGames(res.data)).catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    return games.filter(g => 
      g.title.toLowerCase().includes(search.toLowerCase()) || 
      String(g.app_id).includes(search)
    );
  }, [games, search]);

  const visibleGames = filtered.slice(0, visible);

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
            className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-[#10131E] border border-white/5 hover:border-cyan-500/50 cursor-pointer transition-all hover:-translate-y-1"
          >
            <img 
              src={resolveImg(game.cover_url) || "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=400"} 
              alt={game.title}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              loading="lazy" // 🔴 ISSO EVITA TRAVAMENTOS DE MEMÓRIA!
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-4 flex flex-col justify-end">
              <div className="text-xs font-mono text-cyan-400 mb-1">{game.app_id}</div>
              <div className="font-bold text-sm leading-tight line-clamp-2">{game.title}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 🔴 BOTÃO DE VER MAIS INTELIGENTE 🔴 */}
      {visible < filtered.length && (
        <div className="mt-10 flex justify-center">
          <button 
            onClick={() => setVisible(prev => prev + 20)} // Puxa mais 20
            className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 bg-[#10131E] text-sm font-semibold hover:bg-white/5 transition-colors"
          >
            Ver mais jogos <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}