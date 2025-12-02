import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Map, List, Filter } from 'lucide-react';
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

  const columns = [
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
                placeholder="Buscar por codigo o ubicacion..."
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
    </div>
  );
}
