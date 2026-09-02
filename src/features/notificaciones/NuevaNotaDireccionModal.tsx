import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, ShieldCheck, Trash2, X } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

interface Props {
  isOpen: boolean;
  onCancel: () => void;
  // Devuelve la nota confirmada. Es responsabilidad del caller crear la nota
  // en la bitacora (POST /solicitudes/:id/notas-direccion) y luego continuar
  // con el flujo de Guardar cambios.
  onConfirm: (texto: string) => Promise<void> | void;
  // Contexto opcional para el titulo — Solicitud, Propuesta o Campaña.
  contexto?: 'solicitud' | 'propuesta' | 'campana';
  // Nombre/id del registro para mostrarlo en el header. Ej: "Solicitud #12472".
  referenciaLabel?: string;
  // Autorizacion que se va a disparar (DG / DCM / DG y DCM).
  tipoAutorizacion?: 'dg' | 'dcm' | 'ambas' | null;
  // 'direccion' (default) = nota general de Dirección; 'eliminacion' = nota de por
  // qué se borra un circuito (distintivo rojo/papelera, va a Gerente → DG).
  variant?: 'direccion' | 'eliminacion';
}

const CONTEXTO_LABEL: Record<NonNullable<Props['contexto']>, string> = {
  solicitud: 'Solicitud',
  propuesta: 'Propuesta',
  campana: 'Campaña',
};

// Mini-modal que se dispara al Guardar cambios cuando la edicion genera una
// autorizacion nueva (DG o DCM). La nota es OBLIGATORIA — sin ella no se
// puede continuar con el guardado. Feedback de Jos 2026-07-08.
export function NuevaNotaDireccionModal({ isOpen, onCancel, onConfirm, contexto, referenciaLabel, tipoAutorizacion, variant = 'direccion' }: Props) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const [texto, setTexto] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Distintivo por variante: 'eliminacion' usa rojo + papelera; 'direccion' naranja + escudo.
  const esElim = variant === 'eliminacion';
  const Icon = esElim ? Trash2 : ShieldCheck;
  const ui = esElim
    ? {
        iconBg: isDark ? 'bg-red-500/15' : 'bg-red-50',
        iconText: isDark ? 'text-red-300' : 'text-red-600',
        focus: 'focus:border-red-500/60',
        btn: 'bg-red-600 hover:bg-red-700',
        titulo: 'Motivo de eliminación',
        label: 'Motivo de la eliminación',
        placeholder: '¿Por qué se elimina este circuito? (lo verá el Gerente y Dirección)',
        footer: 'Se enviará junto con la solicitud de eliminación.',
        btnLabel: 'Solicitar eliminación',
      }
    : {
        iconBg: isDark ? 'bg-orange-500/15' : 'bg-orange-50',
        iconText: isDark ? 'text-orange-300' : 'text-orange-600',
        focus: 'focus:border-orange-500/60',
        btn: 'bg-orange-600 hover:bg-orange-700',
        titulo: 'Nueva nota de Dirección',
        label: 'Nota para esta autorización',
        placeholder: 'Describe qué cambió y qué necesita Dirección aprobar...',
        footer: 'Se guardará en la bitácora del registro.',
        btnLabel: 'Guardar y enviar',
      };

  useEffect(() => {
    if (isOpen) {
      setTexto('');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tipoLabel = tipoAutorizacion === 'ambas'
    ? 'DG y DCM'
    : tipoAutorizacion === 'dg' ? 'DG'
      : tipoAutorizacion === 'dcm' ? 'DCM' : null;

  const handleConfirm = async () => {
    const clean = texto.trim();
    if (!clean) {
      setError(esElim ? 'El motivo de eliminación es obligatorio.' : 'La nota es obligatoria para enviar la autorización.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(clean);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar la nota.';
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-2xl shadow-2xl ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'} border`}>
        <div className={`flex items-start justify-between px-5 py-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex items-start gap-3">
            <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${ui.iconBg}`}>
              <Icon className={`h-5 w-5 ${ui.iconText}`} />
            </div>
            <div>
              <h3 className={`text-base font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                {ui.titulo}
              </h3>
              <p className={`mt-0.5 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                {esElim
                  ? 'Se enviará a autorización de eliminación de Gerencia.'
                  : (tipoLabel
                    ? `Se enviará una autorización ${tipoLabel} tras guardar.`
                    : 'Se enviará una autorización tras guardar.')}
                {contexto && referenciaLabel ? ` (${CONTEXTO_LABEL[contexto]} ${referenciaLabel})` : null}
                {esElim ? ' Escribe por qué se elimina.' : ' Escribe la nota que verá Dirección.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={`p-1.5 rounded-md ${isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'} transition-colors disabled:opacity-40`}
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <label className={`block text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-600'} mb-1.5`}>
            {ui.label} <span className="text-red-400">*</span>
          </label>
          <textarea
            autoFocus
            value={texto}
            onChange={e => { setTexto(e.target.value); if (error) setError(null); }}
            rows={5}
            maxLength={2000}
            placeholder={ui.placeholder}
            className={`w-full text-sm rounded-lg px-3 py-2 resize-none ${isDark
              ? 'bg-zinc-950/60 border-zinc-800 text-zinc-100 placeholder:text-zinc-600'
              : 'bg-white border-gray-200 text-gray-800 placeholder:text-gray-400'} border focus:outline-none ${ui.focus}`}
            disabled={submitting}
          />
          <div className={`mt-1 flex items-center justify-between text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
            <span>{texto.length}/2000</span>
            <span className="italic">{ui.footer}</span>
          </div>

          {error && (
            <div className={`mt-3 flex items-start gap-2 px-3 py-2 rounded-md ${isDark ? 'bg-red-950/40 border-red-900/50 text-red-300' : 'bg-red-50 border-red-200 text-red-700'} border text-xs`}>
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className={`flex items-center justify-end gap-2 px-5 py-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={`px-3 py-1.5 text-sm rounded-lg ${isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-100'} transition-colors disabled:opacity-50`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !texto.trim()}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors ${submitting || !texto.trim()
              ? (isDark ? 'bg-zinc-800/60 text-zinc-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed')
              : `${ui.btn} text-white`}`}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
            {ui.btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
