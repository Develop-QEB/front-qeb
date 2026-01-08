import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Map, List, Filter, History, X, Loader2, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { DataTable } from '../../components/tables/DataTable';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select } from '../../components/ui/select';
import { inventariosService } from '../../services/inventarios.service';
import { Inventario } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { InventarioMap } from './InventarioMap';

const estatusVariants: Record<string, 'success' | 'warning' | 'info' | 'secondary'> = {
  Disponible: 'success',
  Reservado: 'warning',
  Ocupado: 'info',
  Mantenimiento: 'secondary',
};

export function InventariosPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState('');
  const [estatus, setEstatus] = useState('');
  const [plaza, setPlaza] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [isHistorialModalOpen, setIsHistorialModalOpen] = useState(false);
  const [selectedInventarioId, setSelectedInventarioId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['inventarios', page, search, tipo, estatus, plaza],
    queryFn: () =>
      inventariosService.getAll({
        page,
        limit: 50,
        search,
        tipo: tipo || undefined,
        estatus: estatus || undefined,
        plaza: plaza || undefined,
      }),
  });

  const { data: tipos } = useQuery({
    queryKey: ['inventarios', 'tipos'],
    queryFn: () => inventariosService.getTipos(),
  });

  const { data: plazas } = useQuery({
    queryKey: ['inventarios', 'plazas'],
    queryFn: () => inventariosService.getPlazas(),
  });

  const { data: estatusList } = useQuery({
    queryKey: ['inventarios', 'estatus'],
    queryFn: () => inventariosService.getEstatus(),
  });

  const { data: historialData, isLoading: isLoadingHistorial } = useQuery({
    queryKey: ['inventario-historial', selectedInventarioId],
    queryFn: () => inventariosService.getHistorial(selectedInventarioId!),
    enabled: isHistorialModalOpen && selectedInventarioId !== null,
  });

  const columns = [
    {
      key: 'id',
      header: 'ID',
      render: (item: Inventario) => (
        <span className="font-mono text-xs text-zinc-400">{item.id}</span>
      ),
    },
    {
      key: 'codigo_unico',
      header: 'Codigo',
      render: (item: Inventario) => (
        <span className="font-mono text-xs font-medium">{item.codigo_unico || '-'}</span>
      ),
    },
    {
      key: 'tipo_de_mueble',
      header: 'Tipo',
      render: (item: Inventario) => (
        <span className="text-sm">{item.tipo_de_mueble || '-'}</span>
      ),
    },
    {
      key: 'ubicacion',
      header: 'Ubicacion',
      render: (item: Inventario) => (
        <span className="max-w-xs truncate block text-sm">{item.ubicacion || '-'}</span>
      ),
    },
    {
      key: 'plaza',
      header: 'Plaza',
      render: (item: Inventario) => item.plaza || '-',
    },
    {
      key: 'municipio',
      header: 'Municipio',
      render: (item: Inventario) => item.municipio || '-',
    },
    {
      key: 'dimensiones',
      header: 'Dimensiones',
      render: (item: Inventario) => (
        <span className="font-mono text-xs">
          {item.ancho}m x {item.alto}m
        </span>
      ),
    },
    {
      key: 'tarifa_publica',
      header: 'Tarifa',
      render: (item: Inventario) => formatCurrency(item.tarifa_publica),
    },
    {
      key: 'estatus',
      header: 'Estatus',
      render: (item: Inventario) => (
        <Badge variant={estatusVariants[item.estatus || ''] || 'secondary'}>
          {item.estatus || 'Sin estatus'}
        </Badge>
      ),
    },
    {
      key: 'coordenadas',
      header: 'Coordenadas',
      render: (item: Inventario) =>
        item.latitud && item.longitud ? (
          <span className="font-mono text-xs">
            {Number(item.latitud).toFixed(4)}, {Number(item.longitud).toFixed(4)}
          </span>
        ) : (
          '-'
        ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (item: Inventario) => (
        <button
          onClick={() => {
            setSelectedInventarioId(item.id);
            setIsHistorialModalOpen(true);
          }}
          className="p-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 hover:text-purple-300 transition-colors"
          title="Ver historial"
        >
          <History className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <Header title="Inventarios" />

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por ID, codigo o ubicacion..."
                className="pl-8"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: '', label: 'Todos los tipos' },
                  ...(tipos?.map((t) => ({ value: t, label: t })) || []),
                ]}
                className="w-40"
              />
              <Select
                value={plaza}
                onChange={(e) => {
                  setPlaza(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: '', label: 'Todas las plazas' },
                  ...(plazas?.map((p) => ({ value: p, label: p })) || []),
                ]}
                className="w-40"
              />
              <Select
                value={estatus}
                onChange={(e) => {
                  setEstatus(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: '', label: 'Todos los estatus' },
                  ...(estatusList?.map((e) => ({ value: e, label: e })) || []),
                ]}
                className="w-44"
              />
            </div>
          </div>

          <div className="flex gap-1 bg-slate-100 p-1 rounded-md">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              <List className="h-4 w-4 mr-1" />
              Tabla
            </Button>
            <Button
              variant={viewMode === 'map' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('map')}
            >
              <Map className="h-4 w-4 mr-1" />
              Mapa
            </Button>
          </div>
        </div>

        {viewMode === 'table' ? (
          <DataTable
            columns={columns}
            data={data?.data || []}
            loading={isLoading}
            pagination={
              data?.pagination
                ? {
                    page: data.pagination.page,
                    totalPages: data.pagination.totalPages,
                    onPageChange: setPage,
                  }
                : undefined
            }
            emptyMessage="No se encontraron inventarios"
          />
        ) : (
          <InventarioMap tipo={tipo} estatus={estatus} plaza={plaza} />
        )}
      </div>

      {/* Modal de Historial del Inventario */}
      {isHistorialModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-purple-500/30 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-600/20">
                  <History className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Historial del Inventario</h2>
                  {historialData?.inventario && (
                    <p className="text-sm text-zinc-400">
                      {historialData.inventario.codigo_unico} - {historialData.inventario.ubicacion}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setIsHistorialModalOpen(false);
                  setSelectedInventarioId(null);
                }}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {isLoadingHistorial ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                </div>
              ) : historialData ? (
                <div className="space-y-4">
                  {/* Info del inventario */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-zinc-800/50 rounded-lg">
                    <div>
                      <p className="text-xs text-zinc-500">Código</p>
                      <p className="text-sm text-white font-medium">{historialData.inventario.codigo_unico}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Formato</p>
                      <p className="text-sm text-white">{historialData.inventario.mueble}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Plaza</p>
                      <p className="text-sm text-white">{historialData.inventario.plaza}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Tipo</p>
                      <p className="text-sm text-white">{historialData.inventario.tradicional_digital}</p>
                    </div>
                  </div>

                  {/* Historial de reservas */}
                  <div>
                    <h3 className="text-sm font-medium text-zinc-300 mb-3">
                      Historial de Campañas ({historialData.historial.length})
                    </h3>
                    {historialData.historial.length === 0 ? (
                      <div className="text-center py-8 text-zinc-500">
                        <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No hay historial para este inventario</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {historialData.historial.map((item, index) => (
                          <div
                            key={`${item.reserva_id}-${index}`}
                            className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50 hover:border-purple-500/30 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded text-xs bg-purple-600/20 text-purple-300">
                                    Campaña #{item.campana_id}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    item.reserva_estatus === 'Vendido' ? 'bg-green-600/20 text-green-300' :
                                    item.reserva_estatus === 'Reservado' ? 'bg-yellow-600/20 text-yellow-300' :
                                    item.reserva_estatus === 'eliminada' ? 'bg-red-600/20 text-red-300' :
                                    'bg-zinc-600/20 text-zinc-300'
                                  }`}>
                                    Estatus Reserva: {item.reserva_estatus}
                                  </span>
                                  {item.instalado && (
                                    <span className="px-2 py-0.5 rounded text-xs bg-blue-600/20 text-blue-300">
                                      Instalado: Sí
                                    </span>
                                  )}
                                </div>
                                <p className="text-white font-medium">Nombre: {item.campana_nombre}</p>
                                <p className="text-sm text-zinc-400">Cliente: {item.cliente_nombre || 'Sin cliente'}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500 flex-wrap">
                                  {(() => {
                                    const today = new Date();
                                    const inicio = item.inicio_periodo ? new Date(item.inicio_periodo) : null;
                                    const fin = item.fin_periodo ? new Date(item.fin_periodo) : null;

                                    let statusLabel = '';
                                    let statusClass = '';

                                    if (inicio && fin) {
                                      if (today >= inicio && today <= fin) {
                                        statusLabel = 'OCUPADO AHORA';
                                        statusClass = 'bg-green-600/30 text-green-300 px-1.5 py-0.5 rounded';
                                      } else if (today < inicio) {
                                        statusLabel = 'RESERVADO';
                                        statusClass = 'bg-blue-600/30 text-blue-300 px-1.5 py-0.5 rounded';
                                      } else {
                                        statusLabel = 'FINALIZADO';
                                        statusClass = 'bg-zinc-600/30 text-zinc-400 px-1.5 py-0.5 rounded';
                                      }
                                    }

                                    return (
                                      <>
                                        <span className="flex items-center gap-1">
                                          <CalendarIcon className="h-3 w-3" />
                                          Periodo: {item.inicio_periodo?.split('T')[0]} - {item.fin_periodo?.split('T')[0]}
                                        </span>
                                        {statusLabel && <span className={statusClass}>{statusLabel}</span>}
                                      </>
                                    );
                                  })()}
                                  <span>Catorcena: {item.numero_catorcena}/{item.anio_catorcena}</span>
                                  {item.APS && <span>APS: {item.APS}</span>}
                                </div>
                              </div>
                              {item.archivo && (
                                <div className="flex-shrink-0 text-center">
                                  <p className="text-xs text-zinc-500 mb-1">Arte</p>
                                  <img
                                    src={item.archivo?.startsWith('http') ? item.archivo : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${item.archivo}`}
                                    alt="Arte"
                                    className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80"
                                    onClick={() => {
                                      if (item.archivo) {
                                        window.open(item.archivo.startsWith('http') ? item.archivo : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${item.archivo}`, '_blank');
                                      }
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Error al cargar el historial</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
