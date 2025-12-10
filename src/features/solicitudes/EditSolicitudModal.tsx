import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Save, Building2, Package, Calendar, FileText, MapPin, Hash, User,
  Loader2, DollarSign, Users, Trash2, Plus
} from 'lucide-react';
import { solicitudesService, SolicitudFullDetails, UserOption, SolicitudCaraInput } from '../../services/solicitudes.service';
import { formatCurrency, formatDate } from '../../lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  solicitudId: number | null;
}

interface EditableCaraEntry {
  id: number;
  ciudad: string;
  estado: string;
  tipo: string;
  flujo: string;
  bonificacion: number;
  caras: number;
  nivel_socioeconomico: string;
  formato: string;
  costo: number;
  tarifa_publica: number;
  inicio_periodo: string;
  fin_periodo: string;
  caras_flujo: number;
  caras_contraflujo: number;
  descuento: number;
}

export function EditSolicitudModal({ isOpen, onClose, solicitudId }: Props) {
  const queryClient = useQueryClient();

  // Form state
  const [descripcion, setDescripcion] = useState('');
  const [notas, setNotas] = useState('');
  const [presupuesto, setPresupuesto] = useState<number>(0);
  const [nombreCampania, setNombreCampania] = useState('');
  const [selectedAsignados, setSelectedAsignados] = useState<{ id: number; nombre: string }[]>([]);
  const [caras, setCaras] = useState<EditableCaraEntry[]>([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Fetch existing solicitud data
  const { data: solicitudData, isLoading } = useQuery({
    queryKey: ['solicitud-edit', solicitudId],
    queryFn: () => solicitudesService.getFullDetails(solicitudId!),
    enabled: isOpen && !!solicitudId,
  });

  // Fetch users for assignment
  const { data: users } = useQuery({
    queryKey: ['solicitudes-users'],
    queryFn: () => solicitudesService.getUsers(),
    enabled: isOpen,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return solicitudesService.update(solicitudId!, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
      queryClient.invalidateQueries({ queryKey: ['solicitudes-stats'] });
      queryClient.invalidateQueries({ queryKey: ['solicitud-edit', solicitudId] });
      queryClient.invalidateQueries({ queryKey: ['solicitud-details', solicitudId] });
      onClose();
    },
  });

  // Load data into form when solicitud data is fetched
  useEffect(() => {
    if (solicitudData) {
      const sol = solicitudData.solicitud;
      setDescripcion(sol.descripcion || '');
      setNotas(sol.notas || '');
      setPresupuesto(sol.presupuesto || 0);

      if (solicitudData.cotizacion) {
        setNombreCampania(solicitudData.cotizacion.nombre_campania || '');
        setFechaInicio(solicitudData.cotizacion.fecha_inicio?.split('T')[0] || '');
        setFechaFin(solicitudData.cotizacion.fecha_fin?.split('T')[0] || '');
      }

      // Parse asignados
      if (sol.id_asignado && sol.asignado) {
        const ids = sol.id_asignado.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id));
        const nombres = sol.asignado.split(',').map((n: string) => n.trim());
        const asignados = ids.map((id: number, idx: number) => ({
          id,
          nombre: nombres[idx] || `Usuario ${id}`
        }));
        setSelectedAsignados(asignados);
      }

      // Load caras
      if (solicitudData.caras && solicitudData.caras.length > 0) {
        setCaras(solicitudData.caras.map(c => ({
          id: c.id,
          ciudad: c.ciudad || '',
          estado: c.estados || '',
          tipo: c.tipo || '',
          flujo: c.flujo || '',
          bonificacion: c.bonificacion || 0,
          caras: c.caras || 0,
          nivel_socioeconomico: c.nivel_socioeconomico || '',
          formato: c.formato || '',
          costo: c.costo || 0,
          tarifa_publica: c.tarifa_publica || 0,
          inicio_periodo: c.inicio_periodo?.split('T')[0] || '',
          fin_periodo: c.fin_periodo?.split('T')[0] || '',
          caras_flujo: c.caras_flujo || 0,
          caras_contraflujo: c.caras_contraflujo || 0,
          descuento: c.descuento || 0,
        })));
      }
    }
  }, [solicitudData]);

  const handleSave = () => {
    if (!solicitudData) return;

    const sol = solicitudData.solicitud;

    const updateData = {
      // Client data (unchanged)
      cliente_id: sol.cliente_id,
      cuic: sol.cuic,
      razon_social: sol.razon_social,
      unidad_negocio: sol.unidad_negocio,
      marca_id: sol.marca_id,
      marca_nombre: sol.marca_nombre,
      asesor: sol.asesor,
      producto_id: sol.producto_id,
      producto_nombre: sol.producto_nombre,
      agencia: sol.agencia,
      categoria_id: sol.categoria_id,
      categoria_nombre: sol.categoria_nombre,
      // Editable campaign data
      nombre_campania: nombreCampania,
      descripcion,
      notas,
      presupuesto,
      // Articulo
      articulo: solicitudData.propuesta?.articulo || '',
      // Asignados
      asignados: selectedAsignados,
      // Dates
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      // IMU
      IMU: sol.IMU,
      // Caras
      caras: caras.map(c => ({
        ciudad: c.ciudad,
        estado: c.estado,
        tipo: c.tipo,
        flujo: c.flujo,
        bonificacion: c.bonificacion,
        caras: c.caras,
        nivel_socioeconomico: c.nivel_socioeconomico,
        formato: c.formato,
        costo: c.costo,
        tarifa_publica: c.tarifa_publica,
        inicio_periodo: c.inicio_periodo,
        fin_periodo: c.fin_periodo,
        caras_flujo: c.caras_flujo,
        caras_contraflujo: c.caras_contraflujo,
        descuento: c.descuento,
      })),
    };

    updateMutation.mutate(updateData);
  };

  const updateCara = (index: number, field: keyof EditableCaraEntry, value: any) => {
    setCaras(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const removeCara = (index: number) => {
    setCaras(prev => prev.filter((_, i) => i !== index));
  };

  const toggleAsignado = (user: UserOption) => {
    setSelectedAsignados(prev => {
      const exists = prev.find(a => a.id === user.id);
      if (exists) {
        return prev.filter(a => a.id !== user.id);
      }
      return [...prev, { id: user.id, nombre: user.nombre }];
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-gradient-to-r from-purple-900/30 to-fuchsia-900/30">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Editar Solicitud</h2>
            {solicitudData && (
              <span className="font-mono text-sm px-2 py-1 rounded-md bg-purple-500/20 text-purple-300">
                #{solicitudData.solicitud.id}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : solicitudData ? (
            <div className="space-y-6">
              {/* Client Info (Read-only) */}
              <div className="bg-zinc-800/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-purple-400" />
                  Información del Cliente (Solo lectura)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">CUIC</label>
                    <div className="px-3 py-2 bg-zinc-800 rounded-lg text-sm text-zinc-300">
                      {solicitudData.solicitud.cuic || '-'}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-zinc-500 mb-1">Razón Social</label>
                    <div className="px-3 py-2 bg-zinc-800 rounded-lg text-sm text-zinc-300">
                      {solicitudData.solicitud.razon_social || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Marca</label>
                    <div className="px-3 py-2 bg-zinc-800 rounded-lg text-sm text-zinc-300">
                      {solicitudData.solicitud.marca_nombre || '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Campaign Info (Editable) */}
              <div className="bg-zinc-800/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Package className="h-4 w-4 text-purple-400" />
                  Información de Campaña
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Nombre de Campaña</label>
                    <input
                      type="text"
                      value={nombreCampania}
                      onChange={(e) => setNombreCampania(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Presupuesto</label>
                    <input
                      type="number"
                      value={presupuesto}
                      onChange={(e) => setPresupuesto(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-zinc-400 mb-1">Descripción</label>
                    <textarea
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-zinc-400 mb-1">Notas</label>
                    <textarea
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="bg-zinc-800/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-400" />
                  Fechas
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Fecha Inicio</label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Fecha Fin</label>
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Asignados */}
              <div className="bg-zinc-800/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-400" />
                  Asignados
                </h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedAsignados.map(a => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full text-xs"
                    >
                      {a.nombre}
                      <button
                        onClick={() => setSelectedAsignados(prev => prev.filter(x => x.id !== a.id))}
                        className="hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                {users && users.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {users.filter(u => !selectedAsignados.find(a => a.id === u.id)).slice(0, 10).map(user => (
                      <button
                        key={user.id}
                        onClick={() => toggleAsignado(user)}
                        className="px-2.5 py-1 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-full text-xs hover:bg-zinc-700 hover:text-white transition-colors"
                      >
                        + {user.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Caras Table */}
              <div className="bg-zinc-800/30 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-700/50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-purple-400" />
                    Detalle de Caras ({caras.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-800/50">
                        <th className="px-3 py-2 text-left text-xs text-zinc-400">Ciudad</th>
                        <th className="px-3 py-2 text-left text-xs text-zinc-400">Estado</th>
                        <th className="px-3 py-2 text-left text-xs text-zinc-400">Formato</th>
                        <th className="px-3 py-2 text-left text-xs text-zinc-400">Tipo</th>
                        <th className="px-3 py-2 text-center text-xs text-zinc-400">Caras</th>
                        <th className="px-3 py-2 text-center text-xs text-zinc-400">Bonif.</th>
                        <th className="px-3 py-2 text-right text-xs text-zinc-400">Costo</th>
                        <th className="px-3 py-2 text-center text-xs text-zinc-400">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caras.map((cara, idx) => (
                        <tr key={idx} className="border-t border-zinc-800/30 hover:bg-zinc-800/20">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={cara.ciudad}
                              onChange={(e) => updateCara(idx, 'ciudad', e.target.value)}
                              className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={cara.estado}
                              onChange={(e) => updateCara(idx, 'estado', e.target.value)}
                              className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={cara.formato}
                              onChange={(e) => updateCara(idx, 'formato', e.target.value)}
                              className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={cara.tipo}
                              onChange={(e) => updateCara(idx, 'tipo', e.target.value)}
                              className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                            >
                              <option value="">-</option>
                              <option value="Tradicional">Tradicional</option>
                              <option value="Digital">Digital</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={cara.caras}
                              onChange={(e) => updateCara(idx, 'caras', Number(e.target.value))}
                              className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={cara.bonificacion}
                              onChange={(e) => updateCara(idx, 'bonificacion', Number(e.target.value))}
                              className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-emerald-400 text-xs text-center focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={cara.costo}
                              onChange={(e) => updateCara(idx, 'costo', Number(e.target.value))}
                              className="w-24 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-emerald-400 text-xs text-right focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => removeCara(idx)}
                              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                  <div className="text-zinc-500 text-xs mb-1">Caras en Renta</div>
                  <div className="text-2xl font-bold text-white">
                    {caras.reduce((sum, c) => sum + c.caras, 0)}
                  </div>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                  <div className="text-zinc-500 text-xs mb-1">Bonificadas</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {caras.reduce((sum, c) => sum + c.bonificacion, 0)}
                  </div>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                  <div className="text-zinc-500 text-xs mb-1">Caras Totales</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {caras.reduce((sum, c) => sum + c.caras + c.bonificacion, 0)}
                  </div>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                  <div className="text-zinc-500 text-xs mb-1">Inversión</div>
                  <div className="text-2xl font-bold text-cyan-400">
                    {formatCurrency(caras.reduce((sum, c) => sum + (c.costo * c.caras), 0))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-zinc-500 py-12">
              No se pudo cargar la información
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 border border-zinc-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
