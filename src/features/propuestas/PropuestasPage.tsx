import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { DataTable } from '../../components/tables/DataTable';
import { Badge } from '../../components/ui/badge';
import { Select } from '../../components/ui/select';
import { propuestasService } from '../../services/propuestas.service';
import { Propuesta } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';

const statusVariants: Record<string, 'secondary' | 'info' | 'success' | 'destructive' | 'warning'> = {
  Pendiente: 'warning',
  Aprobada: 'success',
  Rechazada: 'destructive',
};

export function PropuestasPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['propuestas', page, status],
    queryFn: () =>
      propuestasService.getAll({
        page,
        limit: 20,
        status: status || undefined,
      }),
  });

  const columns = [
    {
      key: 'id',
      header: 'ID',
      render: (item: Propuesta) => (
        <span className="font-mono text-xs">#{item.id}</span>
      ),
    },
    {
      key: 'solicitud_id',
      header: 'Solicitud',
      render: (item: Propuesta) => (
        <span className="font-mono text-xs">#{item.solicitud_id}</span>
      ),
    },
    {
      key: 'articulo',
      header: 'Articulo',
      render: (item: Propuesta) => item.articulo || '-',
    },
    {
      key: 'precio',
      header: 'Precio',
      render: (item: Propuesta) => formatCurrency(item.precio),
    },
    {
      key: 'inversion',
      header: 'Inversion',
      render: (item: Propuesta) => formatCurrency(item.inversion),
    },
    {
      key: 'asignado',
      header: 'Asignado a',
      render: (item: Propuesta) => item.asignado || '-',
    },
    {
      key: 'descripcion',
      header: 'Descripcion',
      render: (item: Propuesta) => (
        <span className="max-w-xs truncate block">{item.descripcion || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Propuesta) => (
        <Badge variant={statusVariants[item.status] || 'secondary'}>
          {item.status}
        </Badge>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      render: (item: Propuesta) => formatDate(item.fecha),
    },
  ];

  return (
    <div className="min-h-screen">
      <Header title="Propuestas" />

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
                { value: 'Pendiente', label: 'Pendiente' },
                { value: 'Aprobada', label: 'Aprobada' },
                { value: 'Rechazada', label: 'Rechazada' },
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
          emptyMessage="No se encontraron propuestas"
        />
      </div>
    </div>
  );
}
