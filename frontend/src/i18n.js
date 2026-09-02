import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export const LANGS = [
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

const T = {
  pt: {
    "app.name": "Rayzer Stark Game",
    "app.tag": "Admin",
    "nav.library": "Biblioteca",
    "nav.addGame": "Adicionar Jogo",
    "nav.bypass": "Bypass",
    "nav.dependencies": "Dependências",
    "nav.orders": "Pedidos",
    "nav.settings": "Configurações",
    "nav.logout": "Sair",
    "nav.clientNote": "Os jogos que você publicar aparecem no app do cliente.",
    "common.save": "Salvar", "common.delete": "Excluir", "common.back": "Voltar",
    "common.manage": "Gerenciar", "common.loading": "Carregando…", "common.search": "Buscar",
    "changing": "Mudando idioma…",
    "nav.keys": "Keys",
    "keys.title": "Keys de Acesso", "keys.subtitle": "Gere keys de uso único (travadas por PC). Se usarem em outro PC, o app do cliente bloqueia.",
    "keys.gen": "Gerar Key", "keys.label": "Rótulo (opcional, ex: nome do cliente)", "keys.empty": "Nenhuma key gerada ainda.",
    "keys.copy": "Copiar", "keys.copied": "Key copiada", "keys.revoke": "Excluir", "keys.reset": "Resetar HWID",
    "keys.bound": "Travada no PC", "keys.unused": "Ainda não usada", "keys.generated": "Key gerada",
    "keys.name": "Nome completo", "keys.email": "E-mail", "keys.phone": "Telefone", "keys.needFields": "Preencha nome, e-mail e telefone.",
    "bypass.orUrl": "…ou cole um link (URL) do arquivo (recomendado p/ arquivos grandes)",
    "login.title": "Entrar", "login.subtitle": "Acesso restrito ao administrador.",
    "login.email": "E-mail", "login.password": "Senha", "login.submit": "Entrar",
    "login.welcome": "Bem-vindo!", "login.fail": "Falha no login",
    "lib.title": "Biblioteca", "lib.subtitle": "Gerencie os jogos, arquivos, loja e visibilidade.",
    "lib.add": "Adicionar Jogo", "lib.searchPh": "Buscar por título ou App ID…",
    "lib.empty": "Nenhum jogo ainda.", "lib.addFirst": "Adicione seu primeiro jogo →",
    "lib.public": "PÚBLICO", "lib.confirmDelete": "Remover \"{x}\"? Ele some da biblioteca de todos os clientes.",
    "lib.removed": "Removido {x}", "lib.loadFail": "Falha ao carregar a biblioteca",
    "game.manage": "Gerenciar Jogo", "game.add": "Adicionar Novo Jogo",
    "game.cover": "Capa", "game.uploadImg": "Enviar imagem", "game.orUrl": "…ou URL da imagem",
    "game.title": "Título do Jogo", "game.appid": "Steam App ID", "game.category": "Categoria",
    "game.desc": "Descrição", "game.public": "Público (grátis para todos)", "game.sell": "Vender na Loja",
    "game.price": "Preço (R$)", "game.create": "Criar Jogo", "game.saveChanges": "Salvar Alterações",
    "game.files": "Arquivos", "game.uploadFile": "Enviar arquivo", "game.noFiles": "Nenhum arquivo anexado.",
    "game.needFields": "Título e App ID são obrigatórios", "game.created": "Jogo criado — agora adicione os arquivos",
    "game.updated": "Jogo atualizado", "game.saveFail": "Falha ao salvar",
    "game.coverUpdated": "Capa atualizada", "game.uploading": "Enviando…", "game.fileAdded": "Arquivo adicionado",
    "game.fileRemoved": "Arquivo removido",
    "deps.title": "Dependências", "deps.subtitle": "Arquivos globais instalados pelo botão \"Instalar dependências\" do cliente.",
    "deps.upload": "Enviar arquivo", "deps.empty": "Nenhuma dependência enviada ainda.",
    "deps.added": "Dependência adicionada: {x}", "deps.removed": "Removida", "deps.uploadFail": "Falha no envio",
    "orders.title": "Pedidos", "orders.subtitle": "Pedidos de compra dos clientes. Confira o comprovante e libere o acesso.",
    "orders.pending": "Pendentes", "orders.approved": "Aprovados", "orders.rejected": "Recusados", "orders.all": "Todos",
    "orders.empty": "Nenhum pedido.", "orders.release": "Liberar", "orders.viewReceipt": "ver comprovante",
    "orders.released": "Acesso liberado ✓", "orders.rejectedMsg": "Pedido recusado",
    "settings.title": "Configurações", "settings.subtitle": "Pagamento Pix e informações do app.",
    "settings.lang": "Idioma", "settings.langDesc": "Escolha o idioma do painel.",
    "settings.pix": "Pix (mostrado na Loja do cliente)", "settings.pixType": "Tipo", "settings.pixKey": "Chave Pix",
    "settings.pixHolder": "Titular da conta", "settings.savePix": "Salvar Pix", "settings.pixSaved": "Pix salvo",
    "settings.clientApp": "App do Cliente (Windows)", "settings.adminApp": "App Admin (Windows)",
    "settings.download": "Baixar", "settings.buildNA": "Build ainda não disponível.",
    "settings.clientDesc": "Versão portátil já compilada. Baixe, extraia e rode o app. Não precisa instalar nada.",
    "settings.adminDesc": "Este painel como app desktop. Precisa de internet (conecta no servidor).",
    "bypass.title": "Bypass", "bypass.subtitle": "Gerencie os bypasses disponíveis para download no app do cliente.",
    "bypass.add": "Adicionar Bypass", "bypass.manage": "Gerenciar Bypass", "bypass.addNew": "Adicionar Novo Bypass",
    "bypass.file": "Arquivo do Bypass (.zip/.rar/qualquer)", "bypass.noFile": "Nenhum arquivo enviado.",
    "bypass.empty": "Nenhum bypass ainda.", "bypass.addFirst": "Adicione seu primeiro bypass →",
    "bypass.created": "Bypass criado", "bypass.updated": "Bypass atualizado", "bypass.removed": "Bypass removido",
    "bypass.fileSet": "Arquivo do bypass atualizado", "bypass.searchPh": "Buscar bypass por título ou App ID…",
  },
  en: {
    "app.name": "Rayzer Stark Game", "app.tag": "Admin",
    "nav.library": "Library", "nav.addGame": "Add Game", "nav.bypass": "Bypass",
    "nav.dependencies": "Dependencies", "nav.orders": "Orders", "nav.settings": "Settings", "nav.logout": "Log out",
    "nav.clientNote": "Games you publish appear in the customer's app.",
    "common.save": "Save", "common.delete": "Delete", "common.back": "Back",
    "common.manage": "Manage", "common.loading": "Loading…", "common.search": "Search",
    "changing": "Changing language…",
    "nav.keys": "Keys",
    "keys.title": "Access Keys", "keys.subtitle": "Generate single-use keys (locked to one PC). If used on another PC, the client app is blocked.",
    "keys.gen": "Generate Key", "keys.label": "Label (optional, e.g. customer name)", "keys.empty": "No keys generated yet.",
    "keys.copy": "Copy", "keys.copied": "Key copied", "keys.revoke": "Delete", "keys.reset": "Reset HWID",
    "keys.bound": "Locked to PC", "keys.unused": "Not used yet", "keys.generated": "Key generated",
    "keys.name": "Full name", "keys.email": "Email", "keys.phone": "Phone", "keys.needFields": "Fill in name, email and phone.",
    "bypass.orUrl": "…or paste a file link (URL) (recommended for large files)",
    "login.title": "Sign in", "login.subtitle": "Admin access only.",
    "login.email": "Email", "login.password": "Password", "login.submit": "Sign in",
    "login.welcome": "Welcome!", "login.fail": "Login failed",
    "lib.title": "Game Library", "lib.subtitle": "Manage games, files, store listing and visibility.",
    "lib.add": "Add Game", "lib.searchPh": "Search by title or App ID…",
    "lib.empty": "No games yet.", "lib.addFirst": "Add your first game →",
    "lib.public": "PUBLIC", "lib.confirmDelete": "Remove \"{x}\"? It disappears from every customer's library.",
    "lib.removed": "Removed {x}", "lib.loadFail": "Failed to load library",
    "game.manage": "Manage Game", "game.add": "Add New Game",
    "game.cover": "Cover", "game.uploadImg": "Upload image", "game.orUrl": "…or image URL",
    "game.title": "Game Title", "game.appid": "Steam App ID", "game.category": "Category",
    "game.desc": "Description", "game.public": "Public (free for everyone)", "game.sell": "Sell in Store",
    "game.price": "Price (R$)", "game.create": "Create Game", "game.saveChanges": "Save Changes",
    "game.files": "Files", "game.uploadFile": "Upload file", "game.noFiles": "No files attached yet.",
    "game.needFields": "Title and App ID are required", "game.created": "Game created — now add its files",
    "game.updated": "Game updated", "game.saveFail": "Save failed",
    "game.coverUpdated": "Cover updated", "game.uploading": "Uploading…", "game.fileAdded": "File added",
    "game.fileRemoved": "File removed",
    "deps.title": "Dependencies", "deps.subtitle": "Global files installed by the client's \"Install dependencies\" button.",
    "deps.upload": "Upload file", "deps.empty": "No dependencies uploaded yet.",
    "deps.added": "Dependency added: {x}", "deps.removed": "Removed", "deps.uploadFail": "Upload failed",
    "orders.title": "Orders", "orders.subtitle": "Customer purchase requests. Review the receipt and release access.",
    "orders.pending": "Pending", "orders.approved": "Approved", "orders.rejected": "Rejected", "orders.all": "All",
    "orders.empty": "No orders.", "orders.release": "Release", "orders.viewReceipt": "view receipt",
    "orders.released": "Access released ✓", "orders.rejectedMsg": "Order rejected",
    "settings.title": "Settings", "settings.subtitle": "Pix payment and app info.",
    "settings.lang": "Language", "settings.langDesc": "Choose the panel language.",
    "settings.pix": "Pix (shown in the customer Store)", "settings.pixType": "Type", "settings.pixKey": "Pix Key",
    "settings.pixHolder": "Account holder", "settings.savePix": "Save Pix", "settings.pixSaved": "Pix saved",
    "settings.clientApp": "Customer App (Windows)", "settings.adminApp": "Admin App (Windows)",
    "settings.download": "Download", "settings.buildNA": "Build not available yet.",
    "settings.clientDesc": "Prebuilt portable version. Download, extract and run. No install needed.",
    "settings.adminDesc": "This panel as a desktop app. Requires internet (connects to the server).",
    "bypass.title": "Bypass", "bypass.subtitle": "Manage bypasses available for download in the customer app.",
    "bypass.add": "Add Bypass", "bypass.manage": "Manage Bypass", "bypass.addNew": "Add New Bypass",
    "bypass.file": "Bypass file (.zip/.rar/any)", "bypass.noFile": "No file uploaded.",
    "bypass.empty": "No bypasses yet.", "bypass.addFirst": "Add your first bypass →",
    "bypass.created": "Bypass created", "bypass.updated": "Bypass updated", "bypass.removed": "Bypass removed",
    "bypass.fileSet": "Bypass file updated", "bypass.searchPh": "Search bypass by title or App ID…",
  },
  es: {
    "app.name": "Rayzer Stark Game", "app.tag": "Admin",
    "nav.library": "Biblioteca", "nav.addGame": "Añadir Juego", "nav.bypass": "Bypass",
    "nav.dependencies": "Dependencias", "nav.orders": "Pedidos", "nav.settings": "Ajustes", "nav.logout": "Salir",
    "nav.clientNote": "Los juegos que publiques aparecen en la app del cliente.",
    "common.save": "Guardar", "common.delete": "Eliminar", "common.back": "Volver",
    "common.manage": "Gestionar", "common.loading": "Cargando…", "common.search": "Buscar",
    "changing": "Cambiando idioma…",
    "nav.keys": "Keys",
    "keys.title": "Claves de Acceso", "keys.subtitle": "Genera claves de un solo uso (bloqueadas a un PC). Si se usan en otro PC, la app del cliente se bloquea.",
    "keys.gen": "Generar Clave", "keys.label": "Etiqueta (opcional, ej: nombre del cliente)", "keys.empty": "Aún no hay claves.",
    "keys.copy": "Copiar", "keys.copied": "Clave copiada", "keys.revoke": "Eliminar", "keys.reset": "Reiniciar HWID",
    "keys.bound": "Bloqueada al PC", "keys.unused": "Sin usar aún", "keys.generated": "Clave generada",
    "keys.name": "Nombre completo", "keys.email": "Correo", "keys.phone": "Teléfono", "keys.needFields": "Completa nombre, correo y teléfono.",
    "bypass.orUrl": "…o pega un enlace (URL) del archivo (recomendado para archivos grandes)",
    "login.title": "Entrar", "login.subtitle": "Acceso solo para el administrador.",
    "login.email": "Correo", "login.password": "Contraseña", "login.submit": "Entrar",
    "login.welcome": "¡Bienvenido!", "login.fail": "Error al iniciar sesión",
    "lib.title": "Biblioteca", "lib.subtitle": "Gestiona juegos, archivos, tienda y visibilidad.",
    "lib.add": "Añadir Juego", "lib.searchPh": "Buscar por título o App ID…",
    "lib.empty": "Aún no hay juegos.", "lib.addFirst": "Añade tu primer juego →",
    "lib.public": "PÚBLICO", "lib.confirmDelete": "¿Eliminar \"{x}\"? Desaparece de la biblioteca de todos los clientes.",
    "lib.removed": "Eliminado {x}", "lib.loadFail": "Error al cargar la biblioteca",
    "game.manage": "Gestionar Juego", "game.add": "Añadir Nuevo Juego",
    "game.cover": "Portada", "game.uploadImg": "Subir imagen", "game.orUrl": "…o URL de imagen",
    "game.title": "Título del Juego", "game.appid": "Steam App ID", "game.category": "Categoría",
    "game.desc": "Descripción", "game.public": "Público (gratis para todos)", "game.sell": "Vender en la Tienda",
    "game.price": "Precio (R$)", "game.create": "Crear Juego", "game.saveChanges": "Guardar Cambios",
    "game.files": "Archivos", "game.uploadFile": "Subir archivo", "game.noFiles": "Aún no hay archivos.",
    "game.needFields": "Título y App ID son obligatorios", "game.created": "Juego creado — ahora añade los archivos",
    "game.updated": "Juego actualizado", "game.saveFail": "Error al guardar",
    "game.coverUpdated": "Portada actualizada", "game.uploading": "Subiendo…", "game.fileAdded": "Archivo añadido",
    "game.fileRemoved": "Archivo eliminado",
    "deps.title": "Dependencias", "deps.subtitle": "Archivos globales instalados por el botón \"Instalar dependencias\" del cliente.",
    "deps.upload": "Subir archivo", "deps.empty": "Aún no hay dependencias.",
    "deps.added": "Dependencia añadida: {x}", "deps.removed": "Eliminada", "deps.uploadFail": "Error al subir",
    "orders.title": "Pedidos", "orders.subtitle": "Solicitudes de compra. Revisa el comprobante y libera el acceso.",
    "orders.pending": "Pendientes", "orders.approved": "Aprobados", "orders.rejected": "Rechazados", "orders.all": "Todos",
    "orders.empty": "Sin pedidos.", "orders.release": "Liberar", "orders.viewReceipt": "ver comprobante",
    "orders.released": "Acceso liberado ✓", "orders.rejectedMsg": "Pedido rechazado",
    "settings.title": "Ajustes", "settings.subtitle": "Pago Pix e info de la app.",
    "settings.lang": "Idioma", "settings.langDesc": "Elige el idioma del panel.",
    "settings.pix": "Pix (mostrado en la Tienda del cliente)", "settings.pixType": "Tipo", "settings.pixKey": "Clave Pix",
    "settings.pixHolder": "Titular de la cuenta", "settings.savePix": "Guardar Pix", "settings.pixSaved": "Pix guardado",
    "settings.clientApp": "App del Cliente (Windows)", "settings.adminApp": "App Admin (Windows)",
    "settings.download": "Descargar", "settings.buildNA": "Build aún no disponible.",
    "settings.clientDesc": "Versión portátil ya compilada. Descarga, extrae y ejecuta. Sin instalación.",
    "settings.adminDesc": "Este panel como app de escritorio. Requiere internet (conecta al servidor).",
    "bypass.title": "Bypass", "bypass.subtitle": "Gestiona los bypasses disponibles para descargar en la app del cliente.",
    "bypass.add": "Añadir Bypass", "bypass.manage": "Gestionar Bypass", "bypass.addNew": "Añadir Nuevo Bypass",
    "bypass.file": "Archivo del Bypass (.zip/.rar/cualquiera)", "bypass.noFile": "Ningún archivo subido.",
    "bypass.empty": "Aún no hay bypasses.", "bypass.addFirst": "Añade tu primer bypass →",
    "bypass.created": "Bypass creado", "bypass.updated": "Bypass actualizado", "bypass.removed": "Bypass eliminado",
    "bypass.fileSet": "Archivo del bypass actualizado", "bypass.searchPh": "Buscar bypass por título o App ID…",
  },
};

const I18nCtx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "pt");
  const [overlay, setOverlay] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const t = useCallback(
    (key, vars) => {
      let s = (T[lang] && T[lang][key]) || (T.pt[key]) || key;
      if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.replace(`{${k}}`, v); });
      return s;
    },
    [lang]
  );

  const changeLang = useCallback((next) => {
    if (next === lang) return;
    setOverlay(true);
    setProgress(0);
    const started = Date.now();
    const iv = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - started) / 1100) * 100));
      setProgress(p);
      if (p >= 100) {
        clearInterval(iv);
        localStorage.setItem("lang", next);
        setLang(next);
        setTimeout(() => setOverlay(false), 250);
      }
    }, 60);
  }, [lang]);

  return (
    <I18nCtx.Provider value={{ lang, t, changeLang }}>
      {children}
      {overlay && (
        <div data-testid="lang-overlay" className="fixed inset-0 z-[999] bg-[#08090E] flex flex-col items-center justify-center gap-6">
          <img src="/logo.png" alt="logo" className="w-16 h-16 rounded-xl animate-pulse" />
          <div className="font-display text-xl font-bold text-cyan-300">{t("changing")}</div>
          <div className="w-64 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-cyan-500 transition-all duration-75" style={{ width: `${progress}%` }} />
          </div>
          <div className="font-mono text-sm text-slate-500">{progress}%</div>
        </div>
      )}
    </I18nCtx.Provider>
  );
}

export const useI18n = () => useContext(I18nCtx);
