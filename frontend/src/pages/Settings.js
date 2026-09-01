import { useState } from "react";
import { toast } from "sonner";
import { FolderCog, Terminal, Download, CheckCircle2, Copy, Boxes, FileCode2 } from "lucide-react";

const STEAM_PATH = "C:\\Program Files (x86)\\Steam";
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Settings() {
  const [copied, setCopied] = useState(false);
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy — copy it manually.");
    }
  };

  const card = "rounded-2xl border border-white/10 bg-[#10131E] p-6";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-black tracking-tight">Settings</h1>
        <p className="text-slate-400 mt-1 text-sm">Injection targets and desktop client setup.</p>
      </div>

      {/* Steam path */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-4">
          <FolderCog className="w-5 h-5 text-cyan-400" />
          <h2 className="font-display text-lg font-bold">Steam Directory</h2>
        </div>
        <label className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1.5 block">Base Path</label>
        <div className="flex gap-2">
          <input
            data-testid="steam-path-input"
            readOnly
            value={STEAM_PATH}
            className="flex-1 bg-[#0b0d14] border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-cyan-300 outline-none"
          />
          <button
            data-testid="copy-steam-path"
            onClick={() => copy(STEAM_PATH)}
            className="px-3 rounded-lg border border-white/10 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold"><Boxes className="w-4 h-4" /> DLLs</div>
            <p className="text-[11px] font-mono text-slate-500 mt-1">{STEAM_PATH}\</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold"><FileCode2 className="w-4 h-4" /> .lua files</div>
            <p className="text-[11px] font-mono text-slate-500 mt-1">{STEAM_PATH}\config\lua\</p>
          </div>
        </div>
      </div>

      {/* Desktop client */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-4">
          <Download className="w-5 h-5 text-cyan-400" />
          <h2 className="font-display text-lg font-bold">Windows Desktop Client</h2>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed mb-4">
          Browsers can't write to your Steam folder. The actual DLL / .lua injection is done by the
          Electron desktop app. It connects to this same server, downloads each game's files, and
          places them in the correct Steam folders when you click <span className="text-cyan-300 font-medium">Activate</span>.
        </p>

        <div className="rounded-xl bg-[#0b0d14] border border-white/10 p-4">
          <div className="flex items-center gap-2 text-slate-300 text-xs font-mono uppercase tracking-widest mb-3">
            <Terminal className="w-3.5 h-3.5" /> Build the desktop app
          </div>
          <pre className="text-[12px] font-mono text-cyan-200 whitespace-pre-wrap leading-relaxed">
{`cd desktop
npm install
# set the server URL the app talks to:
#   edit config.json -> "apiBase"
npm start            # run in dev
npm run build:win    # build the Windows .exe (dist/)`}
          </pre>
        </div>

        <div className="mt-4 rounded-xl bg-[#0b0d14] border border-white/10 p-4">
          <label className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1.5 block">Server URL (set as apiBase in desktop/config.json)</label>
          <div className="flex gap-2">
            <input
              data-testid="api-base-input"
              readOnly
              value={BACKEND_URL}
              className="flex-1 bg-[#08090E] border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-cyan-300 outline-none"
            />
            <button
              data-testid="copy-api-base"
              onClick={() => copy(BACKEND_URL)}
              className="px-3 rounded-lg border border-white/10 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
