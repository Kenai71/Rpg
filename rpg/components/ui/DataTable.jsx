'use client';

import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { Input } from './Input';
import { EmptyState } from './EmptyState';

export function DataTable({
  data = [],
  columns = [],
  searchPlaceholder = 'Buscar...',
  searchValue,
  onSearchChange,
  pageSize = 8,
  filterSlot,
  emptyTitle = 'Nenhum registro encontrado',
  emptyDescription = 'Tente ajustar os filtros ou adicione um novo item.',
  emptyIcon,
  renderMobileCard,
}) {
  const [sorting, setSorting] = useState([]);
  const [internalSearch, setInternalSearch] = useState('');

  const globalFilter = searchValue !== undefined ? searchValue : internalSearch;
  const setGlobalFilter = onSearchChange || setInternalSearch;

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize },
    },
  });

  const rows = table.getRowModel().rows;
  const totalFiltered = table.getFilteredRowModel().rows.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:max-w-xs">
          <Input
            icon={Search}
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>
        {filterSlot && <div className="flex flex-wrap items-center gap-2">{filterSlot}</div>}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          {renderMobileCard && (
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {rows.map((row) => (
                <div key={row.id}>{renderMobileCard(row.original)}</div>
              ))}
            </div>
          )}

          <div
            className={cn(
              'rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] overflow-hidden',
              renderMobileCard ? 'hidden md:block' : 'block overflow-x-auto'
            )}
          >
            <table className="w-full text-left border-collapse">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr
                    key={headerGroup.id}
                    className="border-b border-[var(--border-subtle)] bg-[var(--surface-2)]/60"
                  >
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      return (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 select-none"
                        >
                          {header.isPlaceholder ? null : canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-white/[0.025] transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3.5 text-sm text-slate-200 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 text-xs text-slate-400">
            <span className="tabular-nums">
              Exibindo {rows.length} de {totalFiltered} registro(s)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="px-2 font-mono tabular-nums text-slate-300">
                {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
