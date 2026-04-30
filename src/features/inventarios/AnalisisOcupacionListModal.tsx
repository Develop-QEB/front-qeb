import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, FolderOpen, Loader2, Trash2, Share2, BarChart3, CheckCircle2, Plus, AlertCircle,
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { analisisOcupacionService, AnalisisOcupacion } from '../../services/analisisOcupacion.service';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenAnalisis: (a: AnalisisOcupacion) => void;
  onCreateNew: () => void;
}

export function AnalisisOcupacionListModal({ open, onClose, onOpenAnalisis, onCreateNew }: Props) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['analisis-ocupacion'],
    queryFn: () => analisisOcupacionService.list(),
    enabled: open,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => analisisOcupacionService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analisis-ocupacion'] });
      setPendingDelete(null);
    },
  });

  const handleShare = async (id: number) => {
    const url = `${window.location.origin}/inventarios/analisis/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt('Copia el enlace:', url);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`${isDark ? 'bg-zinc-900' : 'bg-white'} rounded-2xl border ${isDark ? 'border-purple-500/20' : 'border-purple-200'} w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-500/10`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`p-5 border-b ${isDark ? 'border-purple-500/20 bg-gradient-to-r from-purple-900/20 to-fuchsia-900/10' : 'border-purple-200 bg-gradient-to-r from-purple-50 to-fuchsia-50'} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-50'} flex items-center justify-center`}>
              <FolderOpen className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Análisis Guardados</h2>
              <p className={`text-xs ${isDark ? 'text-purple-300/50' : 'text-purple-400'}`}>
                {data?.length ?? 0} análisis guardados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCreateNew}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'}`}
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo
            </button>
            <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          ) : error ? (
            <div className={`text-sm text-center py-8 ${isDark ? 'text-red-400' : 'text-red-600'} flex flex-col items-center gap-2`}>
              <AlertCircle className="h-6 w-6" />
              Error al cargar los análisis
            </div>
          ) : !data || data.length === 0 ? (
            <div className={`flex flex-col items-center gap-3 py-12 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
              <BarChart3 className="h-10 w-10 opacity-40" />
              <p className="text-sm">Aún no tienes análisis guardados</p>
              <button
                onClick={onCreateNew}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'}`}
              >
                <Plus className="h-3.5 w-3.5" />
                Crear primer análisis
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {data.map(a => {
                const isPending = pendingDelete === a.id;
                return (
                  <div
                    key={a.id}
                    className={`rounded-xl border ${isDark ? 'border-zinc-700 bg-zinc-800/50 hover:border-purple-500/40' : 'border-gray-200 bg-white hover:border-purple-300'} p-3 transition-all`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => onOpenAnalisis(a)}
                        className="flex-1 text-left"
                      >
                        <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{a.nombre}</h3>
                        <div className={`flex items-center gap-3 mt-1 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                          <span>{a.inventarios.length} inventarios</span>
                          <span>·</span>
                          <span>{a.catorcenas.length} periodos</span>
                          {a.codigosNoEncontrados.length > 0 && (
                            <>
                              <span>·</span>
                              <span className={isDark ? 'text-amber-400' : 'text-amber-600'}>
                                {a.codigosNoEncontrados.length} no encontrados
                              </span>
                            </>
                          )}
                        </div>
                        <p className={`text-[10px] mt-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                          Actualizado: {new Date(a.fecha_actualizacion || a.fecha_creacion).toLocaleString('es-MX')}
                        </p>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleShare(a.id)}
                          title="Copiar enlace"
                          className={`p-1.5 rounded-md ${isDark ? 'hover:bg-purple-500/20 text-zinc-400 hover:text-purple-300' : 'hover:bg-purple-50 text-gray-500 hover:text-purple-700'}`}
                        >
                          {copiedId === a.id ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
                        </button>
                        {isPending ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => deleteMutation.mutate(a.id)}
                              disabled={deleteMutation.isPending}
                              className={`px-2 py-1 rounded-md text-[10px] font-medium ${isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-50 text-red-700 hover:bg-red-100'} disabled:opacity-50`}
                            >
                              {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmar'}
                            </button>
                            <button
                              onClick={() => setPendingDelete(null)}
                              className={`px-2 py-1 rounded-md text-[10px] ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPendingDelete(a.id)}
                            title="Eliminar"
                            className={`p-1.5 rounded-md ${isDark ? 'hover:bg-red-500/20 text-zinc-400 hover:text-red-300' : 'hover:bg-red-50 text-gray-500 hover:text-red-700'}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
