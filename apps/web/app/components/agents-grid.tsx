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
import { buildAgentRows, type AgentGridAgent, type AgentGridRow } from "./agent-grid-data";

ModuleRegistry.registerModules([AllCommunityModule]);

const columnDefs: ColDef<AgentGridRow>[] = [
  { field: "name", headerName: "Agent", flex: 2, minWidth: 170 },
  { field: "kind", headerName: "Type", flex: 1, minWidth: 120 },
  { field: "parentName", headerName: "Parent", flex: 1, minWidth: 150 },
];

const columnLabels: Array<{ field: keyof AgentGridRow; label: string }> = [
  { field: "name", label: "Agent" },
  { field: "kind", label: "Type" },
  { field: "parentName", label: "Parent" },
];

export function AgentsGrid({ agents }: { agents: AgentGridAgent[] }) {
  const apiRef = useRef<GridApi<AgentGridRow> | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    kind: true,
    parentName: true,
  });
  const rows = useMemo(() => buildAgentRows(agents), [agents]);

  function onGridReady(event: GridReadyEvent<AgentGridRow>) {
    apiRef.current = event.api;
  }

  function setColumnVisibility(field: string, visible: boolean) {
    setVisibleColumns((current) => ({ ...current, [field]: visible }));
    apiRef.current?.setColumnsVisible([field], visible);
  }

  return (
    <div className="agent-grid-block">
      <details className="column-controls">
        <summary>Columns</summary>
        <div className="column-options">
          {columnLabels.map((column) => (
            <label key={column.field}>
              <input
                type="checkbox"
                checked={visibleColumns[column.field]}
                onChange={(event) => setColumnVisibility(column.field, event.target.checked)}
              />
              {column.label}
            </label>
          ))}
        </div>
      </details>
      <div
        className="agent-grid ag-theme-quartz"
        aria-label="Registered agents"
        data-testid="agents-grid"
      >
        <AgGridReact<AgentGridRow>
          rowData={rows}
          columnDefs={columnDefs}
          theme={themeQuartz}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          pagination
          paginationPageSize={25}
          getRowId={({ data }) => data.id}
          onGridReady={onGridReady}
          overlayNoRowsTemplate="No agents registered for this environment."
        />
      </div>
    </div>
  );
}
