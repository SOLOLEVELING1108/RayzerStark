import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Inbox, Check, X, ExternalLink, Loader2, Cpu } from "lucide-react";
import { api, resolveImg } from "@/lib/api";

export default function Orders() {
  const [tab, setTab] = useState("pending");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/purchases", { params: tab === "all" ? {} : { status: tab } })
      .then(({ data }) => setOrders(data))
      .catch(() => toast.error("Failed to load orders"))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(load, [load]);

  const act = async (id, action) => {
    try {
      await api.post(`/purchases/${id}/${action}`);
      toast.success(action === "approve" ? "Access released ✓" : "Order rejected");
      load();
    } catch {
      toast.error("Action failed");
    }
  };

  const statusBadge = (s) => {
    const map = { pending: "bg-amber-500/15 text-amber-300 border-amber-500/30", approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", rejected: "bg-red-500/15 text-red-300 border-red-500/30" };
    return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${map[s]}`}>{s}</span>;
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-1"><Inbox className="w-6 h-6 text-cyan-400" /><h1 className="font-display text-3xl font-black tracking-tight">Orders</h1></div>
      <p className="text-slate-400 text-sm mb-6">Customer purchase requests. Review the Pix receipt and release access.</p>

      <div className="flex gap-2 mb-5">
        {["pending", "approved", "rejected", "all"].map((t) => (
          <button key={t} data-testid={`orders-tab-${t}`} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${tab === t ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40" : "text-slate-400 border border-white/10 hover:text-slate-200"}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="p-6 text-center text-slate-500 text-sm">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
          <Inbox className="w-10 h-10 mx-auto text-slate-700" />
          <p className="mt-3 text-slate-400 text-sm">No {tab === "all" ? "" : tab} orders.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} data-testid={`order-${o.id}`} className="rounded-xl border border-white/10 bg-[#10131E] p-4 flex flex-col sm:flex-row gap-4 items-start">
              {o.receipt_url && (
                <a href={resolveImg(o.receipt_url)} target="_blank" rel="noreferrer" className="shrink-0 group">
                  <img src={resolveImg(o.receipt_url)} alt="receipt" className="w-24 h-24 object-cover rounded-lg border border-white/10 group-hover:border-cyan-500/40 transition-colors" />
                  <span className="text-[10px] text-cyan-400 flex items-center gap-1 mt-1"><ExternalLink className="w-3 h-3" /> view receipt</span>
                </a>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-bold">{o.game_title}</span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">APPID {o.game_app_id}</span>
                  {statusBadge(o.status)}
                </div>
                <div className="text-sm text-slate-300 mt-1">R$ {Number(o.game_price).toFixed(2)}</div>
                <div className="text-[11px] font-mono text-slate-500 mt-2 flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> {o.device_code}</span>
                  {o.device_name && <span>· {o.device_name}</span>}
                  <span>· {new Date(o.created_at).toLocaleString()}</span>
                </div>
              </div>
              {o.status === "pending" && (
                <div className="flex gap-2 shrink-0">
                  <button data-testid={`approve-${o.id}`} onClick={() => act(o.id, "approve")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-black text-sm font-semibold hover:bg-emerald-400 transition-colors"><Check className="w-4 h-4" /> Liberar</button>
                  <button data-testid={`reject-${o.id}`} onClick={() => act(o.id, "reject")} className="p-2 rounded-lg border border-white/10 text-slate-300 hover:text-red-400 hover:border-red-500/40 transition-colors"><X className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
