import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { useThemeStore } from '../../store/themeStore';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function DataTable<T extends { id: number | string }>({
  columns,
  data,
  loading,
  pagination,
  onRowClick,
  emptyMessage = 'No hay datos disponibles',
}: DataTableProps<T>) {
  const isDark = useThemeStore((s) => s.theme === 'dark');

  const containerClass = isDark
    ? 'border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 shadow-xl shadow-purple-500/5'
    : 'border-purple-200/60 bg-white shadow-lg shadow-purple-100/30';

  const headClass = isDark
    ? 'border-b border-purple-500/20 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30'
    : 'border-b border-purple-100 bg-gradient-to-r from-purple-50 via-fuchsia-50/50 to-purple-50';

  const thClass = isDark
    ? 'text-purple-300'
    : 'text-purple-700';

  const rowBorderClass = isDark
    ? 'border-purple-500/10'
    : 'border-purple-100/60';

  const rowHoverClass = onRowClick
    ? isDark
      ? 'cursor-pointer hover:bg-purple-500/10 hover:shadow-lg hover:shadow-purple-500/5'
      : 'cursor-pointer hover:bg-purple-50/80'
    : isDark
      ? 'hover:bg-purple-500/5'
      : 'hover:bg-gray-50/80';

  const cellClass = isDark
    ? 'text-zinc-300'
    : 'text-gray-700';

  const skeletonClass = isDark
    ? 'bg-purple-500/10'
    : 'bg-purple-100/50';

  const paginationBarClass = isDark
    ? 'border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-transparent to-fuchsia-900/20'
    : 'border-purple-100 bg-gradient-to-r from-purple-50/50 via-transparent to-fuchsia-50/50';

  const paginationTextClass = isDark
    ? 'text-purple-300/70'
    : 'text-purple-600/70';

  const paginationBoldClass = isDark
    ? 'text-purple-300'
    : 'text-purple-700';

  const btnClass = isDark
    ? 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:text-purple-200 hover:border-purple-500/50 disabled:opacity-40 disabled:hover:bg-purple-500/10'
    : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 hover:border-purple-300 disabled:opacity-40 disabled:hover:bg-purple-50';

  if (loading) {
    return (
      <div className={`rounded-2xl border backdrop-blur-xl overflow-hidden ${containerClass}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={headClass}>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider ${thClass}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className={`border-b ${rowBorderClass}`}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-5 py-4">
                      <Skeleton className={`h-5 w-full max-w-[200px] ${skeletonClass}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`rounded-2xl border backdrop-blur-xl p-12 text-center ${containerClass}`}>
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${isDark ? 'bg-purple-500/10' : 'bg-purple-100'}`}>
          <svg className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p className={`text-sm ${isDark ? 'text-purple-300/70' : 'text-purple-600/70'}`}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border backdrop-blur-xl overflow-hidden ${containerClass}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={headClass}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider ${thClass} ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr
                key={item.id}
                className={`border-b ${rowBorderClass} last:border-0 transition-all duration-200 ${rowHoverClass}`}
                onClick={() => onRowClick?.(item)}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-5 py-4 text-sm ${cellClass} ${col.className || ''}`}>
                    {col.render
                      ? col.render(item)
                      : (item as Record<string, unknown>)[col.key]?.toString() || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className={`flex items-center justify-between border-t px-5 py-4 ${paginationBarClass}`}>
          <p className={`text-sm ${paginationTextClass}`}>
            Pagina <span className={`font-semibold ${paginationBoldClass}`}>{pagination.page}</span> de <span className={`font-semibold ${paginationBoldClass}`}>{pagination.totalPages}</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className={`${btnClass} transition-all duration-200`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className={`${btnClass} transition-all duration-200`}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
