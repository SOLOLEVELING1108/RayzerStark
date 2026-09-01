import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Search, Plus, Settings2, Trash2, FileCode2, Boxes, Zap, Loader2, CheckCircle2,
} from "lucide-react";
import { api, resolveImg } from "@/lib/api";

function GameCard({ game, onManage, onDelete }) {
  const [injecting, setInjecting] = useState(false);
  const [done, setDone] = useState(false);
  const dllCount = game.files.filter((f) => f.type === "dll").length;
  const luaCount = game.files.filter((f) => f.type === "lua").length;

  const simulate = async () => {
    if (game.files.length === 0) {
      toast.error("No files attached. Add DLL/.lua files first.");
      return;
    }
    setInjecting(true);
    setDone(false);
    await new Promise((r) => setTimeout(r, 1400));
    game.files.forEach((f) => {
      const target = f.type === "dll" ? "Steam\\" : "Steam\\config\\lua\\";
      toast.success(`Injected ${f.original_filename}`, { description: `→ C:\\Program Files (x86)\\${target}` });
    });
    setInjecting(false);
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  };

  return (
    <div
      data-testid={`game-card-${game.app_id}`}
      className="group relative rounded-2xl overflow-hidden border border-white/10 bg-[#10131E] card-glow transition-shadow animate-fade-up"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[#0b0d14]">
        {game.cover_url ? (
          <img
            src={resolveImg(game.cover_url)}
            alt={game.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-slate-700">
            <Boxes className="w-12 h-12" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#10131E] via-transparent to-transparent" />
        <span className="absolute top-3 left-3 font-mono text-[11px] px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 backdrop-blur">
          APPID {game.app_id}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-[15px] truncate">{game.title}</h3>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mt-0.5">{game.category}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 text-[11px] font-mono">
          <span className="flex items-center gap-1 text-amber-400"><Boxes className="w-3.5 h-3.5" />{dllCount} DLL</span>
          <span className="flex items-center gap-1 text-emerald-400"><FileCode2 className="w-3.5 h-3.5" />{luaCount} LUA</span>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button
            data-testid={`activate-button-${game.app_id}`}
            onClick={simulate}
            disabled={injecting}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
              done
                ? "bg-emerald-500 text-black"
                : "bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-60"
            }`}
          >
            {injecting ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <CheckCircle2 className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            {injecting ? "Injecting…" : done ? "Injected" : "Simulate Inject"}
          </button>
          <button
            data-testid={`manage-button-${game.app_id}`}
            onClick={() => onManage(game.id)}
            className="p-2 rounded-lg border border-white/10 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
            title="Manage"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            data-testid={`delete-button-${game.app_id}`}
            onClick={() => onDelete(game)}
            className="p-2 rounded-lg border border-white/10 text-slate-300 hover:text-red-400 hover:border-red-500/40 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Library() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, c] = await Promise.all([
        api.get("/games", { params: { search: search || undefined, category: activeCat } }),
        api.get("/categories"),
      ]);
      setGames(g.data);
      setCategories(c.data);
    } catch (e) {
      toast.error("Failed to load library");
    } finally {
      setLoading(false);
    }
  }, [search, activeCat]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const handleDelete = async (game) => {
    try {
      await api.delete(`/games/${game.id}`);
      toast.success(`Removed ${game.title}`);
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight">Game Library</h1>
          <p className="text-slate-400 mt-1 text-sm">Manage games and their Steam injection files.</p>
        </div>
        <button
          data-testid="add-game-btn"
          onClick={() => navigate("/games/new")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Game
        </button>
      </div>

      {/* Filter bar */}
      <div className="glass border border-white/10 rounded-xl p-3 mb-6 flex flex-wrap items-center gap-3 sticky top-20 z-[5]">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            data-testid="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or App ID…"
            className="w-full bg-[#0b0d14] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-cyan-500/50 text-slate-100 placeholder:text-slate-600"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {["All", ...categories].map((cat) => (
            <button
              key={cat}
              data-testid={`category-${cat}`}
              onClick={() => setActiveCat(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeCat === cat
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 border border-white/10 hover:text-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-[#10131E] overflow-hidden">
              <div className="aspect-[16/10] relative shimmer bg-[#0b0d14]" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-white/5 rounded w-2/3" />
                <div className="h-3 bg-white/5 rounded w-1/3" />
                <div className="h-9 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-white/10 rounded-2xl">
          <Boxes className="w-12 h-12 mx-auto text-slate-700" />
          <p className="mt-4 text-slate-400">No games yet.</p>
          <button
            onClick={() => navigate("/games/new")}
            className="mt-4 text-cyan-400 text-sm font-semibold hover:underline"
          >
            Add your first game →
          </button>
        </div>
      ) : (
        <div
          data-testid="games-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          {games.map((g) => (
            <GameCard key={g.id} game={g} onManage={(id) => navigate(`/games/${id}`)} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
