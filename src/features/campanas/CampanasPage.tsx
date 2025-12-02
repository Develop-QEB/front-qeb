import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { DataTable } from '../../components/tables/DataTable';
import { Badge } from '../../components/ui/badge';
import { Select } from '../../components/ui/select';
import { campanasService } from '../../services/campanas.service';
import { Campana } from '../../types';
import { formatDate } from '../../lib/utils';

const statusVariants: Record<string, 'secondary' | 'success' | 'warning' | 'info'> = {
  activa: 'success',
  inactiva: 'secondary',
};

export function CampanasPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['campanas', page, status],
    queryFn: () =>
      campanasService.getAll({
        page,
        limit: 20,
        status: status || undefined,
      }),
  });

  const columns = [
    {
      key: 'id',
      header: 'ID',
      render: (item: Campana) => (
        <span className="font-mono text-xs">#{item.id}</span>
      ),
    },
    {
      key: 'nombre',
      header: 'Nombre',
      render: (item: Campana) => (
        <span className="font-medium">{item.nombre}</span>
      ),
    },
    {
      key: 'articulo',
      header: 'Articulo',
      render: (item: Campana) => item.articulo || '-',
    },
    {
      key: 'total_caras',
      header: 'Total Caras',
      render: (item: Campana) => item.total_caras || '-',
    },
    {
      key: 'bonificacion',
      header: 'Bonificacion',
      render: (item: Campana) => item.bonificacion ? `${item.bonificacion}%` : '-',
    },
    {
      key: 'fecha_inicio',
      header: 'Inicio',
      render: (item: Campana) => formatDate(item.fecha_inicio),
    },
    {
      key: 'fecha_fin',
      header: 'Fin',
      render: (item: Campana) => formatDate(item.fecha_fin),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Campana) => (
        <Badge variant={statusVariants[item.status] || 'secondary'}>
          {item.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <Header title="Campanas" />

      <div className="p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'Todos los status' },
                { value: 'activa', label: 'Activa' },
                { value: 'inactiva', label: 'Inactiva' },
              ]}
              className="w-44"
            />
          </div>
        </div>

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
          emptyMessage="No se encontraron campanas"
        />
      </div>
    </div>
  );
}
