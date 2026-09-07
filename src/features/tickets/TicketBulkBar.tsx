import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, X, CheckSquare, Square, MinusSquare } from 'lucide-react';
import { ticketsService } from '../../services/tickets.service';

// Barra flotante con acciones masivas para el listado de tickets.
// Feedback 2026-08-15: cambiar estatus o reasignar area para N tickets a la
// vez. El backend valida permisos (solo aplica a los tickets del area del
// usuario si no es global).
// Feedback 2026-09-07: se muestra siempre con checkbox "seleccionar todos"
// para que el usuario pueda armar la seleccion desde el mismo bar.
interface Props {
  selectedIds: number[];
  onClear: () => void;
  isDark: boolean;
  invalidateKeys?: string[][];
  statusOptions: string[];
  // Ids visibles ahora (post filtros/pestana). Habilita "seleccionar todos".
  allVisibleIds?: number[];
  onToggleSelectAll?: () => void;
}

export function TicketBulkBar({ selectedIds, onClear, isDark, invalidateKeys, statusOptions, allVisibleIds, onToggleSelectAll }: Props) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [area, setArea] = useState<'' | 'QEB' | 'TI'>('');

  const invalidate = () => {
    (invalidateKeys || [['tickets-historial'], ['tickets']]).forEach(key => {
      queryClient.invalidateQueries({ queryKey: key });
    });
    queryClient.invalidateQueries({ queryKey: ['tickets-unread-count'] });
  };

  const statusMutation = useMutation({
    mutationFn: (s: string) => ticketsService.bulkUpdateStatus(selectedIds, s),
    onSuccess: (res) => {
      invalidate();
      onClear();
      if (res.saltados > 0) alert(`${res.updated} tickets actualizados. ${res.saltados} saltados por permisos.`);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || 'Error al aplicar cambio masivo');
    },
  });
  const areaMutation = useMutation({
    mutationFn: (a: 'QEB' | 'TI') => ticketsService.bulkUpdateArea(selectedIds, a),
    onSuccess: (res) => {
      invalidate();
      onClear();
      if (res.saltados > 0) alert(`${res.updated} tickets reasignados. ${res.saltados} saltados por permisos.`);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || 'Error al reasignar en masa');
    },
  });

  const busy = statusMutation.isPending || areaMutation.isPending;
  const total = allVisibleIds?.length ?? 0;
  const allSelected = total > 0 && total === selectedIds.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  // Si no hay ni checkbox master ni selecciones, el bar no aporta nada.
  if (selectedIds.length === 0 && !onToggleSelectAll) return null;

  return (
    <div className={`sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border shadow-lg ${
      isDark ? 'bg-zinc-900/95 border-purple-500/30' : 'bg-white border-purple-200'
    }`}>
      {onToggleSelectAll && (
        <button
          onClick={onToggleSelectAll}
          disabled={busy || total === 0}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${
            isDark ? 'text-purple-300 hover:bg-purple-500/10' : 'text-purple-700 hover:bg-purple-50'
          } disabled:opacity-50`}
          title={allSelected ? 'Deseleccionar todos' : `Seleccionar los ${total} tickets visibles`}
        >
          {allSelected ? <CheckSquare className="h-4 w-4" /> : someSelected ? <MinusSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          {allSelected ? 'Todos' : 'Seleccionar todos'}
        </button>
      )}

      <span className={`text-xs font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
        {selectedIds.length > 0
          ? `${selectedIds.length} de ${total || selectedIds.length} seleccionado${selectedIds.length === 1 ? '' : 's'}`
          : `${total} ticket${total === 1 ? '' : 's'} visible${total === 1 ? '' : 's'}`}
      </span>

      <div className={`flex items-center gap-1.5 ${selectedIds.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
        <label className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Estatus:</label>
        <select
          value={status}
          onChange={(e) => {
            const s = e.target.value;
            setStatus(s);
            if (s) statusMutation.mutate(s);
          }}
          disabled={busy}
          className={`px-2 py-1 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50 ${
            isDark ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-gray-50 text-gray-900 border-gray-300'
          }`}
        >
          <option value="">— cambiar —</option>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className={`flex items-center gap-1.5 ${selectedIds.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
        <label className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Área:</label>
        <select
          value={area}
          onChange={(e) => {
            const a = e.target.value as '' | 'QEB' | 'TI';
            setArea(a);
            if (a) areaMutation.mutate(a);
          }}
          disabled={busy}
          className={`px-2 py-1 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50 ${
            isDark ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-gray-50 text-gray-900 border-gray-300'
          }`}
        >
          <option value="">— reasignar —</option>
          <option value="QEB">QEB</option>
          <option value="TI">TI</option>
        </select>
      </div>

      {busy && <Loader2 className={`h-4 w-4 animate-spin ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />}

      {selectedIds.length > 0 && (
        <button
          onClick={onClear}
          disabled={busy}
          className={`ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${
            isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          } transition-colors disabled:opacity-50`}
        >
          <X className="h-3 w-3" /> Limpiar
        </button>
      )}
    </div>
  );
}
