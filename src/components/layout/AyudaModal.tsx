import { useEffect, useRef } from 'react';
import { X, BookOpen, Ticket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useThemeStore } from '../../store/themeStore';

type Tutorial =
  | { id: string; type: 'demo'; category: string; title: string; demoUrl: string; width: number; height: number; previewImage: string; paddingBottom: string }
  | { id: string; type: 'pdf'; category: string; title: string; pdfUrl: string };

const tutorials: Tutorial[] = [
  {
    id: 'asesores-solicitudes',
    type: 'demo' as const,
    category: 'Asesores',
    title: 'Crear - Ver - Editar Solicitudes',
    demoUrl: 'https://app.storylane.io/demo/qwp95lfqu2k0?embed=inline_overlay',
    width: 2560,
    height: 1425,
    previewImage:
      'https://storylane-prod-uploads.s3.us-east-2.amazonaws.com/company/company_708d0493-8c70-45e6-8886-151c1cc6fa6d/project/project_4a12c5d8-6fa6-418e-ac55-415ea0b724e1/page/1770993940788.png',
    paddingBottom: 'calc(55.66% + 25px)',
  },
  {
    id: 'Gestion-Solicitudes',
    type: 'demo' as const,
    category: 'Asesores',
    title: 'Gestion de Solicitudes',
    demoUrl: 'https://app.storylane.io/demo/aasux8feuib8?embed=inline_overlay',
    width: 2560,
    height: 1425,
    previewImage:
      'https://storylane-prod-uploads.s3.us-east-2.amazonaws.com/company/company_708d0493-8c70-45e6-8886-151c1cc6fa6d/project/project_6c04e8be-d673-40bf-a4eb-f4344fc91ebf/page/1771447559402.png',
    paddingBottom: 'calc(55.66% + 25px)',
  },
  {
    id: 'Tutorial-Tickets',
    type: 'demo' as const,
    category: 'Tickets',
    title: 'Gestion de Tickets',
    demoUrl: 'https://app.storylane.io/demo/kwvumr3w4uc5?embed=inline_overlay',
    width: 2560,
    height: 1425,
    previewImage:
      'https://storylane-prod-uploads.s3.us-east-2.amazonaws.com/company/company_708d0493-8c70-45e6-8886-151c1cc6fa6d/project/project_17ead260-3777-4e8f-a218-8fe2e9f98afb/page/1774554935634.png',
    paddingBottom: 'calc(55.66% + 25px)',
  },
  { 
    id: 'manual-asesores', 
    
    type: 'pdf' as const, 
    category: 'Asesores', 
    title: 'Manual-Asesor-Comercial-QEB', 
    pdfUrl: 'https://drive.google.com/file/d/1mXExe-3UJ_zFTG4IkgKLwi_x6AtF0bko/preview'
  },
  {
    id: 'manual-analistas',
    type: 'pdf' as const,
    category: 'Analistas',
    title: 'Manual-Analista-QEB',
    pdfUrl: 'https://drive.google.com/file/d/1oIrHe80hrL5WxdstpD7oL7S_c63SZOvE/preview'
  },
  {
    id: 'manual-diseños',
    type: 'pdf' as const,
    category: 'Diseño',
    title: 'Manual-Diseño-QEB',
    pdfUrl: 'https://drive.google.com/file/d/1nBQg3OYPuaBlNJCQVpzCttKCpbyfTr00/preview'
  },
  {
    id: 'manual-trafico',
    type: 'pdf' as const,
    category: 'Trafico',
    title: 'Manual-Trafico-QEB',
    pdfUrl: 'https://drive.google.com/file/d/1rSLKyWxsO7EPHYIeLbs4btJjZ-1Snr1Y/preview'
  },
  {
    id: 'gestionar-campañas',
    type: 'demo' as const,
    category: 'Analistas',
    title: 'Gestion de Campañas',
    demoUrl: 'https://app.storylane.io/demo/taq3uxuzty4w?embed=inline_overlay',
    width: 2560,
    height: 1425,
    previewImage:
      'https://storylane-prod-uploads.s3.us-east-2.amazonaws.com/company/company_708d0493-8c70-45e6-8886-151c1cc6fa6d/project/project_9865049f-8508-4fbd-8ea5-486272859b7e/page/1775568519723.png',
    paddingBottom: 'calc(55.66% + 25px)',
  },
  {
    id: 'tutorial-versionario',
    type: 'demo' as const,
    category: 'Analistas',
    title: 'Tutorial de Versionario',
    demoUrl: 'https://app.storylane.io/demo/4zugtxb6t96w?embed=inline_overlay',
    width: 2560,
    height: 1425,
    previewImage:
      'https://storylane-prod-uploads.s3.us-east-2.amazonaws.com/company/company_708d0493-8c70-45e6-8886-151c1cc6fa6d/project/project_07d4b799-158a-492b-8ccd-0c7bad3a9fb4/page/1775570047634.png',
    paddingBottom: 'calc(55.66% + 25px)',
  },
    {
    id: 'filtrar-exportar-datos',
    type: 'demo' as const,
    category: 'Campañas',
    title: 'Tutorial de Filtrar y Exportar Datos',
    demoUrl: 'https://app.storylane.io/demo/jomjkefuskp5?embed=inline_overlay',
    width: 2560,
    height: 1425,
    previewImage:
      'https://storylane-prod-uploads.s3.us-east-2.amazonaws.com/company/company_708d0493-8c70-45e6-8886-151c1cc6fa6d/project/project_7e140c58-4280-47b4-aa0b-6a6205659a1f/page/1775591768363.png',
    paddingBottom: 'calc(55.66% + 25px)',
  },
];

const categories = [...new Set(tutorials.map((t) => t.category))];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tutorialId: string;
  onSelect: (id: string) => void;
  chatUnreadCount?: number;
}

export function AyudaModal({ isOpen, onClose, tutorialId, onSelect, chatUnreadCount = 0 }: Props) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const navigate = useNavigate();
  const scriptLoaded = useRef(false);
  const selected = tutorials.find((t) => t.id === tutorialId) ?? tutorials[0];

  useEffect(() => {
    if (isOpen && !scriptLoaded.current) {
      if (!document.querySelector('script[src="https://js.storylane.io/js/v2/storylane.js"]')) {
        const s = document.createElement('script');
        s.src = 'https://js.storylane.io/js/v2/storylane.js';
        s.async = true;
        document.head.appendChild(s);
      }
      scriptLoaded.current = true;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handlePlay = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (selected.type !== 'demo') return;
    const sl = (window as any).Storylane;
    if (sl) sl.Play({ type: 'preview_embed', demo_type: 'image', width: selected.width, height: selected.height, element: e.currentTarget, demo_url: selected.demoUrl });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 flex w-full max-w-6xl rounded-2xl overflow-hidden ${isDark ? 'bg-[#1a1025] border-purple-900/40' : 'bg-white border-gray-200'} border shadow-2xl`} style={{ height: '85vh' }}>

        {/* Sidebar izquierdo */}
        <div className={`w-60 flex-shrink-0 border-r ${isDark ? 'border-purple-900/30' : 'border-gray-200'} flex flex-col`}>
          <div className={`px-4 py-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'} flex items-center gap-2`}>
            <BookOpen className="h-4 w-4 text-purple-400" />
            <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Tutoriales</span>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-3">
            {categories.map((cat) => (
              <div key={cat}>
                <p className={`px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-purple-500/60' : 'text-purple-400'}`}>
                  {cat}
                </p>
                {tutorials.filter((t) => t.category === cat).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-xl text-xs font-light transition-all duration-200',
                      tutorialId === t.id
                        ? isDark ? 'bg-gradient-to-r from-pink-600/20 to-purple-600/20 text-white border border-pink-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200'
                        : isDark ? 'text-purple-300/70 hover:bg-purple-900/30 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className={`p-3 border-t ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
            <button
              onClick={() => { onClose(); navigate('/tickets'); }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all relative',
                isDark
                  ? 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
              )}
            >
              <Ticket className="h-4 w-4" />
              Mis Tickets de Soporte
              {chatUnreadCount > 0 && (
                <span className="absolute top-1.5 right-2 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse ring-2 ring-red-500/30" />
              )}
            </button>
          </div>
        </div>

        {/* Panel derecho */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
            <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} truncate pr-4`}>{selected.title}</h3>
            <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-purple-900/30 text-purple-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-900'} transition-colors`}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 p-5 overflow-auto">
            {selected.type === 'pdf' ? (
              <iframe
                key={tutorialId}
                src={(selected as any).pdfUrl}
                style={{ width: '100%', height: '100%', border: 'none', borderRadius: '10px' }}
              />
            ) : (
              /* key={tutorialId} fuerza re-mount al cambiar tutorial, reseteando el player */
              <div key={tutorialId} className="sl-embed-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(63,95,172,0.35)', boxShadow: '0px 0px 18px rgba(26,19,72,0.15)', borderRadius: '10px' }}>
                <div className="sl-preview-heading" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(40,37,54,0.9)', zIndex: 999999, fontFamily: 'Poppins, Arial, sans-serif', borderRadius: '10px' }}>
                  <div style={{ color: '#fff', marginBottom: '20px', fontSize: 'clamp(18px,2vw,26px)', fontWeight: 500, textAlign: 'center', maxWidth: '60%', textShadow: '0px 1px 2px rgba(26,19,72,0.40)' }}>
                    {selected.title}
                  </div>
                  <button onClick={handlePlay} className="sl-preview-cta" style={{ backgroundColor: '#9939EB', border: 'none', borderRadius: '8px', boxShadow: '0px 0px 15px rgba(26,19,72,0.45)', color: '#fff', fontFamily: 'Poppins, Arial, sans-serif', fontSize: 'clamp(14px,1.4vw,18px)', fontWeight: 600, height: 'clamp(38px,3.5vw,48px)', padding: '0 20px', cursor: 'pointer' }}>
                    VER DEMO
                  </button>
                </div>
                <div className="sl-embed" data-sl-demo-type="image" style={{ position: 'relative', paddingBottom: selected.paddingBottom, width: '100%', height: 0, overflow: 'hidden' }}>
                  <div className="sl-preview" style={{ width: '100%', height: '100%', zIndex: 99999, position: 'absolute', background: `url('${selected.previewImage}') no-repeat`, backgroundSize: '100% 100%', borderRadius: 'inherit' }} />
                  <iframe className="sl-demo" src="" name="sl-embed" allow="fullscreen" allowFullScreen style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} />
                </div>
                <iframe className="sl-demo" src="" name="sl-embed" allow="fullscreen" allowFullScreen style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
