import { useEffect, useMemo, useRef } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "../../../shared/components/ui/button";
import { ORDER_COLUMNS } from "../constants/order-columns";
import {
  ORDER_OVERSCAN,
  ORDER_PREFETCH_ROWS,
  ORDER_ROW_HEIGHT,
  ORDER_VIEWPORT_HEIGHT,
} from "../constants/order.constants";
import { useOrders } from "../hooks/use-orders";

export function OrdersTable() {
  const query = useOrders();
  const data = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const table = useReactTable({
    data,
    columns: ORDER_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (order) => order.id,
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
  });
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ORDER_ROW_HEIGHT,
    getItemKey: (index) => rows[index].id,
    overscan: ORDER_OVERSCAN,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const lastVisibleIndex = virtualRows.at(-1)?.index ?? -1;
  const { fetchNextPage, hasNextPage, isFetching, isFetchNextPageError } =
    query;
  useEffect(() => {
    if (
      lastVisibleIndex >= 0 &&
      lastVisibleIndex >= rows.length - ORDER_PREFETCH_ROWS &&
      hasNextPage &&
      !isFetching &&
      !isFetchNextPageError
    ) {
      void fetchNextPage({ cancelRefetch: false });
    }
  }, [
    lastVisibleIndex,
    rows.length,
    hasNextPage,
    isFetching,
    isFetchNextPageError,
    fetchNextPage,
  ]);

  if (query.isPending)
    return (
      <p role="status" className="mt-6">
        Loading orders…
      </p>
    );
  if (query.isError && !query.data)
    return (
      <div className="mt-6">
        <p role="alert">Unable to load orders.</p>
        <Button className="mt-3" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  if (!rows.length)
    return (
      <p role="status" className="mt-6">
        No orders found.
      </p>
    );

  return (
    <section className="mt-6" aria-label="Customer orders">
      <p className="mb-3 text-sm text-slate-600">
        {rows.length} orders loaded · Newest first
      </p>
      <div
        ref={scrollRef}
        role="region"
        aria-label="Scrollable orders"
        tabIndex={0}
        className="overflow-auto rounded-lg border border-slate-200 bg-white focus-visible:outline-2 focus-visible:outline-indigo-700"
        style={{ height: ORDER_VIEWPORT_HEIGHT }}
      >
        <table
          aria-label="Orders"
          aria-rowcount={-1}
          className="grid w-full text-left text-sm"
          style={{ minWidth: table.getTotalSize() }}
        >
          <thead className="sticky top-0 z-10 grid bg-slate-100">
            {table.getHeaderGroups().map((group) => (
              <tr
                key={group.id}
                className="flex"
                style={{ height: ORDER_ROW_HEIGHT }}
              >
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="flex shrink-0 items-center px-3 font-semibold"
                    style={{ width: header.getSize() }}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody
            className="relative grid"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  aria-rowindex={virtualRow.index + 2}
                  className="absolute flex w-full border-b border-slate-100 hover:bg-slate-50"
                  style={{
                    height: ORDER_ROW_HEIGHT,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="shrink-0 truncate px-3 py-3"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-3">
        {query.isFetchNextPageError && (
          <p role="alert">Could not load more orders. Please retry.</p>
        )}
        {query.hasNextPage ? (
          <Button
            disabled={query.isFetching}
            onClick={() => void query.fetchNextPage({ cancelRefetch: false })}
          >
            {query.isFetchingNextPage
              ? "Loading more…"
              : query.isFetchNextPageError
                ? "Retry loading more"
                : "Load more"}
          </Button>
        ) : (
          <p role="status" className="text-sm text-slate-600">
            All matching orders loaded.
          </p>
        )}
      </div>
    </section>
  );
}
