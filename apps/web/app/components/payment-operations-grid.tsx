"use client";

import { useMemo, useRef, useState } from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {
  buildPaymentOperationRows,
  type PaymentOperation,
  type PaymentOperationGridRow,
} from "./payment-operations-grid-data";

ModuleRegistry.registerModules([AllCommunityModule]);

const columnDefs: ColDef<PaymentOperationGridRow>[] = [
  { field: "providerOrderId", headerName: "PayPal order", flex: 2, minWidth: 170 },
  { field: "amount", headerName: "Amount", flex: 1, minWidth: 120 },
  { field: "status", headerName: "Status", flex: 1, minWidth: 120 },
  { field: "observedProviderStatus", headerName: "Provider status", flex: 1, minWidth: 145 },
  { field: "reconciliationState", headerName: "Reconciliation", flex: 1, minWidth: 135 },
  { field: "captureId", headerName: "Capture", flex: 1, minWidth: 145 },
  { field: "executionState", headerName: "Execution", flex: 1, minWidth: 120 },
  { field: "updatedAt", headerName: "Updated", flex: 1.4, minWidth: 175 },
];

const columnLabels: Array<{ field: keyof PaymentOperationGridRow; label: string }> = [
  { field: "providerOrderId", label: "PayPal order" },
  { field: "amount", label: "Amount" },
  { field: "status", label: "Status" },
  { field: "observedProviderStatus", label: "Provider status" },
  { field: "reconciliationState", label: "Reconciliation" },
  { field: "captureId", label: "Capture" },
  { field: "executionState", label: "Execution" },
  { field: "updatedAt", label: "Updated" },
];

export function PaymentOperationsGrid({ operations }: { operations: PaymentOperation[] }) {
  const apiRef = useRef<GridApi<PaymentOperationGridRow> | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    Object.fromEntries(columnLabels.map((column) => [column.field, true])),
  );
  const rows = useMemo(() => buildPaymentOperationRows(operations), [operations]);

  function onGridReady(event: GridReadyEvent<PaymentOperationGridRow>) {
    apiRef.current = event.api;
  }

  function setColumnVisibility(field: string, visible: boolean) {
    setVisibleColumns((current) => ({ ...current, [field]: visible }));
    apiRef.current?.setColumnsVisible([field], visible);
  }

  return (
    <div className="payment-grid-block">
      <details className="column-controls">
        <summary>Columns</summary>
        <div className="column-options">
          {columnLabels.map((column) => (
            <label key={column.field}>
              <input
                type="checkbox"
                checked={visibleColumns[column.field]}
                onChange={(event) =>
                  setColumnVisibility(String(column.field), event.target.checked)
                }
              />
              {column.label}
            </label>
          ))}
        </div>
      </details>
      <div
        className="payment-grid ag-theme-quartz"
        aria-label="Recent PayPal operations"
        data-testid="payment-operations-grid"
      >
        <AgGridReact<PaymentOperationGridRow>
          rowData={rows}
          columnDefs={columnDefs}
          theme={themeQuartz}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          pagination
          paginationPageSize={10}
          getRowId={({ data }) => data.id}
          onGridReady={onGridReady}
          overlayNoRowsTemplate="No PayPal operations for this environment."
        />
      </div>
    </div>
  );
}
