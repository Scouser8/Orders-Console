import { TextField } from "../../../shared/components/ui/text-field";
import { SelectField } from "../../../shared/components/ui/select-field";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
} from "../constants/order.constants";
import {
  ORDER_SEARCH_MAX_LENGTH,
  ORDER_SORT_OPTIONS,
  ORDER_STATUS_COLUMN_ID,
} from "../constants/order-filter.constants";
import type { OrderTableProps } from "../types/order-table.types";
import { getOrderSortOption } from "../utils/get-order-sort-option";

export function OrderControls({ table }: OrderTableProps) {
  const state = table.getState();
  const selectedSort = getOrderSortOption(state.sorting);
  const statusColumn = table.getColumn(ORDER_STATUS_COLUMN_ID);
  const selectedStatus =
    ORDER_STATUSES.find(
      (status) => status === statusColumn?.getFilterValue(),
    ) ?? "";
  return (
    <div
      role="group"
      aria-label="Order filters"
      className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]"
    >
      <TextField
        label="Search customers"
        type="search"
        placeholder="Customer name or email"
        maxLength={ORDER_SEARCH_MAX_LENGTH}
        value={state.globalFilter}
        onChange={(event) => table.setGlobalFilter(event.target.value)}
      />
      <SelectField
        label="Status"
        value={selectedStatus}
        onChange={(event) => statusColumn?.setFilterValue(event.target.value)}
      >
        <option value="">All statuses</option>
        {ORDER_STATUSES.map((status) => (
          <option key={status} value={status}>
            {ORDER_STATUS_LABELS[status]}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Sort orders"
        value={selectedSort.value}
        onChange={(event) => {
          const option = ORDER_SORT_OPTIONS.find(
            (option) => option.value === event.target.value,
          );
          if (option)
            table.setSorting([
              { id: option.sortBy, desc: option.sortDirection === "desc" },
            ]);
        }}
      >
        {ORDER_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
