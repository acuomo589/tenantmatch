"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/app/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { WorkbookRow } from "@/lib/workbookCsv";
import type { WorkbookResult } from "@/lib/workspace-client";

function WorkbookPanel({
  listingWorkbooks,
  activeWorkbook,
  onSelectWorkbook,
  onExportWorkbook,
  onOpenOutreach,
}: {
  listingWorkbooks: WorkbookResult[];
  activeWorkbook: WorkbookResult | null;
  onSelectWorkbook: (workbookId: string) => void;
  onExportWorkbook: (workbook: WorkbookResult) => void;
  onOpenOutreach: (row: WorkbookRow) => void;
}) {
  const columns = useMemo<ColumnDef<WorkbookRow>[]>(
    () => [
      {
        accessorKey: "priority_rank",
        header: "Rank",
        cell: ({ row }) => <span className="font-semibold">{row.original.priority_rank}</span>,
      },
      {
        accessorKey: "business_name",
        header: "Business",
        cell: ({ row }) => (
          <div className="grid gap-1">
            <span className="font-semibold text-foreground">{row.original.business_name}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.category} · {row.original.property_type}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "city",
        header: "Location",
        cell: ({ row }) => `${row.original.city}, ${row.original.state}`,
      },
      {
        accessorKey: "distance_miles",
        header: "Miles",
        cell: ({ row }) => `${row.original.distance_miles} mi`,
      },
      {
        accessorKey: "tenant_fit_score_100",
        header: "Fit",
        cell: ({ row }) => `${row.original.tenant_fit_score_100}/100`,
      },
      {
        accessorKey: "move_probability_1_10",
        header: "Move",
        cell: ({ row }) => `${row.original.move_probability_1_10}/10`,
      },
      {
        accessorKey: "fit_summary",
        header: "Fit & rationale",
        cell: ({ row }) => (
          <div className="grid gap-1 text-sm">
            <span className="line-clamp-3 text-muted-foreground">{row.original.fit_summary}</span>
            <span className="line-clamp-2 font-medium text-foreground/80">{row.original.rationale}</span>
          </div>
        ),
      },
      {
        id: "action",
        header: "Action",
        enableSorting: false,
        cell: ({ row }) => (
          <Button variant="secondary" size="sm" onClick={() => onOpenOutreach(row.original)}>
            Contact
          </Button>
        ),
      },
    ],
    [onOpenOutreach],
  );

  return (
    <Card data-surface>
      <CardContent className="grid gap-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold tracking-tight">Workbook</h2>
            <p className="text-sm text-muted-foreground">Turn the listing into a prioritized target list of occupiers or buyers.</p>
          </div>
          {activeWorkbook ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={activeWorkbook.id} onChange={(event) => onSelectWorkbook(event.target.value)} className="min-w-[16rem]">
                {listingWorkbooks.map((workbook) => (
                  <option key={workbook.id} value={workbook.id}>
                    {new Date(workbook.createdAt).toLocaleString()}
                  </option>
                ))}
              </Select>
              <Button variant="outline" onClick={() => onExportWorkbook(activeWorkbook)}>
                Export CSV
              </Button>
            </div>
          ) : null}
        </div>

        {activeWorkbook ? (
          <DataTable
            columns={columns}
            data={activeWorkbook.rows}
            searchPlaceholder="Search businesses, categories, or cities"
            emptyTitle="No workbook rows"
            emptyDescription="Regenerate the workbook if no rows are available."
          />
        ) : (
          <div className="rounded-[1.5rem] border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
            Generate a workbook to see the target list here.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { WorkbookPanel };
