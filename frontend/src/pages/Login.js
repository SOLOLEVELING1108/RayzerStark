import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, Loader2, Mail } from "lucide-react";
import { api, resolveImg } from "@/lib/api";
import { useI18n } from "@/i18n";

export default function Login() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Estados do formulário normal
  const [loading, setLoading] = useState(false);
  
  // 🔴 Estados da Tela de Carregamento Ninja (Pré-Cache)
  const [caching, setCaching] = useState(false);
  const [cacheText, setCacheText] = useState("");
  const [progress, setProgress] = useState(0);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isAff = email.trim().toUpperCase().startsWith("AFF-");
      const body = isAff ? { affiliate_key: email.trim().toUpperCase() } : { email, password };
      const { data } = await api.post("/auth/login", body);
      
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("role", data.role || "admin");
      localStorage.setItem("principal_name", data.name || "Admin");
      toast.success(t("login.welcome"));

      // Se for afiliado, vai direto pras Keys sem pré-cache
      if (data.role === "affiliate") {
        navigate("/keys");
        return;
      }

      // 🔴 SE FOR ADMIN/USUÁRIO, INICIA O MOTOR DE PRÉ-CACHE 🔴
      iniciarPreCache();

    } catch (err) {
      toast.error(err.response?.data?.detail || t("login.fail"));
      setLoading(false);
    }
  };

  const iniciarPreCache = async () => {
    setCaching(true); // Troca a tela
    setCacheText("Autenticado! Conectando aos servidores...");
    
    // Animação da barra de progresso (0 a 100% em 12 segundos)
    let tempo = 0;
    const duracaoTotal = 12000; // 12 segundos garantidos para a tela não piscar rápido demais
    const intervalo = setInterval(() => {
      tempo += 100;
      setProgress(Math.min((tempo / duracaoTotal) * 100, 100));
    }, 100);

    try {
      // 1. Puxa a lista de jogos
      setCacheText("Sincronizando banco de dados...");
      const gamesRes = await api.get("/games");
      const primeiros20 = gamesRes.data.slice(0, 20);

      // 2. Prepara a injeção na Memória RAM
      let baixadas = 0;
      setCacheText(`Injetando texturas na memória (0/${primeiros20.length})...`);

      const preloadImage = (url) => {
        return new Promise((resolve) => {
          if (!url) return resolve();
          const img = new Image();
          img.src = url;
          img.onload = () => { 
            baixadas++; 
            setCacheText(`Injetando texturas na memória (${baixadas}/${primeiros20.length})...`); 
            resolve(); 
          };
          img.onerror = resolve; // Se falhar, passa direto pra não travar
        });
      };

      // 3. Roda o download de todas as 20 fotos no fundo
      const promessasDeImagens = Promise.all(
        primeiros20.map(g => 
          preloadImage(g.cover_url ? resolveImg(g.cover_url) : "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=400")
        )
      );

      // 4. Cria o timer obrigatório de 12 segundos (como você pediu)
      const timerObrigatorio = new Promise(resolve => setTimeout(resolve, duracaoTotal));

      // Espera baixar TUDO E passar os 12 segundos
      await Promise.all([promessasDeImagens, timerObrigatorio]);

      clearInterval(intervalo);
      setProgress(100);
      setCacheText("Tudo pronto! Abrindo biblioteca...");
      
      // Dá meio segundo pra ele ler a mensagem final e entra
      setTimeout(() => {
        navigate("/");
      }, 500);

    } catch (e) {
      console.error("Erro no pré-cache:", e);
      // Se der qualquer erro na internet, ele entra mesmo assim pra não trancar o usuário fora
      clearInterval(intervalo);
      navigate("/");
    }
  };

  const affMode = email.trim().toUpperCase().startsWith("AFF-");

  // 🔴 TELA DE CARREGAMENTO (ESTILO LAUNCHER PROFISSIONAL) 🔴
  if (caching) {
    return (
      <div className="min-h-screen bg-[#08090E] bg-grid flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
        <img 
          src="/logo.png" 
          alt="Rayzer Stark" 
          className="w-24 h-24 rounded-3xl border border-cyan-500/50 shadow-[0_0_40px_rgba(6,182,212,0.3)] mb-8 animate-pulse" 
        />
        <h1 className="font-display text-2xl font-black mb-3 text-cyan-400 tracking-widest uppercase">
          Inicializando Motor Gráfico
        </h1>
        <p className="text-slate-400 text-xs font-mono mb-8 uppercase tracking-widest h-4">
          {cacheText}
        </p>
        
        {/* Barra de Progresso */}
        <div className="w-full max-w-sm h-1.5 bg-[#10131E] rounded-full overflow-hidden border border-white/5">
          <div 
            className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)] rounded-full transition-all duration-100 ease-out" 
            style={{ width: `${progress}%` }} 
          />
        </div>
        <div className="w-full max-w-sm flex justify-between mt-2 px-1">
          <span className="text-[10px] text-slate-600 font-mono">LOADING ASSETS</span>
          <span className="text-[10px] text-cyan-500 font-mono">{Math.floor(progress)}%</span>
        </div>
      </div>
    );
  }

  // TELA DE LOGIN NORMAL
  return (
    <div className="min-h-screen bg-[#08090E] bg-grid flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src="/logo.png" alt="Rayzer" className="w-11 h-11 rounded-xl border border-cyan-500/30" />
          <div className="leading-tight">
            <div className="font-display font-extrabold tracking-tight text-lg">RAYZER STARK</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{t("app.tag")}</div>
          </div>
        </div>

        <form onSubmit={submit} className="glass border border-white/10 rounded-2xl p-7">
          <h1 className="font-display text-2xl font-black mb-1">{t("login.title")}</h1>
          <p className="text-slate-400 text-sm mb-6">{t("login.subtitle")}</p>

          <label className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1.5 block">{t("login.email")} / KEY</label>
          <div className="relative mb-4">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input data-testid="login-email" type="text" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0b0d14] border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-cyan-500/50 text-slate-100" placeholder="voce@email.com  ·  AFF-XXXX-XXXX-XXXX" required />
          </div>

          {!affMode && (
          <>
          <label className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1.5 block">{t("login.password")}</label>
          <div className="relative mb-6">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0b0d14] border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-cyan-500/50 text-slate-100" placeholder="••••••••" />
          </div>
          </>
          )}
          {affMode && <p className="text-[12px] text-cyan-400 mb-6 -mt-1">{t("login.affHint")}</p>}

          <button data-testid="login-submit" type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 disabled:opacity-60 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {t("login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}