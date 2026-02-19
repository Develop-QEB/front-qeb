import { useEffect, useRef } from 'react';
import { X, BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';

const tutorials = [
  {
    id: 'asesores-solicitudes',
    category: 'Asesores',
    title: 'Crear - Ver - Editar Solicitudes',
    demoUrl: 'https://app.storylane.io/demo/qwp95lfqu2k0?embed=inline_overlay',
    width: 2560,
    height: 1425,
    previewImage:
      'https://storylane-prod-uploads.s3.us-east-2.amazonaws.com/company/company_708d0493-8c70-45e6-8886-151c1cc6fa6d/project/project_4a12c5d8-6fa6-418e-ac55-415ea0b724e1/page/1770993940788.png',
    paddingBottom: 'calc(55.66% + 25px)',
  },
];

const categories = [...new Set(tutorials.map((t) => t.category))];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tutorialId: string;
  onSelect: (id: string) => void;
}

export function AyudaModal({ isOpen, onClose, tutorialId, onSelect }: Props) {
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
    const sl = (window as any).Storylane;
    if (sl) sl.Play({ type: 'preview_embed', demo_type: 'image', width: selected.width, height: selected.height, element: e.currentTarget, demo_url: selected.demoUrl });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-6xl rounded-2xl overflow-hidden bg-[#1a1025] border border-purple-900/40 shadow-2xl" style={{ height: '85vh' }}>

        {/* Sidebar izquierdo */}
        <div className="w-60 flex-shrink-0 border-r border-purple-900/30 flex flex-col">
          <div className="px-4 py-4 border-b border-purple-900/30 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">Tutoriales</span>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-3">
            {categories.map((cat) => (
              <div key={cat}>
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-purple-500/60">
                  {cat}
                </p>
                {tutorials.filter((t) => t.category === cat).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-xl text-xs font-light transition-all duration-200',
                      tutorialId === t.id
                        ? 'bg-gradient-to-r from-pink-600/20 to-purple-600/20 text-white border border-pink-500/30'
                        : 'text-purple-300/70 hover:bg-purple-900/30 hover:text-white'
                    )}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </div>

        {/* Panel derecho */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-purple-900/30">
            <h3 className="text-sm font-medium text-white truncate pr-4">{selected.title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-purple-900/30 text-purple-400 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 p-5 overflow-auto">
            {/* key={tutorialId} fuerza re-mount al cambiar tutorial, reseteando el player */}
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
          </div>
        </div>
      </div>
    </div>
  );
}
