"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  RowSelectionState,
} from "@tanstack/react-table";
import { Plus, Search, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export interface ReusableTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchColumn?: string;
  onAdd?: () => void;
  addButtonLabel?: string;
  onEdit?: (row: TData) => void;
  onDelete?: (row: TData) => void;
  onRowClick?: (row: TData) => void;
  enableRowSelection?: boolean;
  enablePagination?: boolean;
  pageSize?: number;
  emptyMessage?: string;
  filters?: React.ReactNode;
  onSelectionChange?: (selectedRows: TData[]) => void;
  onDeleteSelected?: () => void;
  deleteButtonLabel?: string;
  // Wbudowane dialogi
  enableAddDialog?: boolean;
  enableDeleteDialog?: boolean;
  onConfirmAdd?: (formData: Record<string, string>) => void;
  onConfirmDelete?: (selectedRows: TData[]) => void;
  addDialogTitle?: string;
  addDialogDescription?: string;
  deleteDialogTitle?: string;
  deleteDialogDescription?: string;
  addFormFields?: React.ReactNode;
}

export function ReusableTable<TData, TValue>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = "Szukaj...",
  searchColumn,
  onAdd,
  addButtonLabel = "Dodaj",
  onEdit,
  onDelete,
  onRowClick,
  enableRowSelection = true,
  enablePagination = true,
  pageSize = 10,
  emptyMessage = "Brak danych",
  filters,
  onSelectionChange,
  onDeleteSelected,
  deleteButtonLabel = "Usuń",
  enableAddDialog = false,
  enableDeleteDialog = false,
  onConfirmAdd,
  onConfirmDelete,
  addDialogTitle = "Dodaj nowy element",
  addDialogDescription = "Wypełnij formularz, aby dodać nowy element do tabeli.",
  deleteDialogTitle = "Usuń zaznaczone elementy?",
  deleteDialogDescription,
  addFormFields,
}: ReusableTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedRows, setSelectedRows] = React.useState<TData[]>([]);
  const [formData, setFormData] = React.useState<Record<string, string>>({});

  // Dodaj kolumnę wyboru jeśli włączona
  const tableColumns = React.useMemo<ColumnDef<TData, TValue>[]>(() => {
    if (!enableRowSelection) return columns;

    const selectionColumn: ColumnDef<TData, TValue> = {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Wybierz wszystkie"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Wybierz wiersz"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };

    return [selectionColumn, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: searchColumn
      ? (row, columnId, filterValue) => {
          const value = (row.original as any)[searchColumn];
          return value?.toString().toLowerCase().includes(filterValue.toLowerCase());
        }
      : undefined,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  // Aktualizuj selectedRows gdy zmienia się rowSelection
  React.useEffect(() => {
    const currentSelectedRows = table
      .getRowModel()
      .rows.filter((row) => rowSelection[row.id])
      .map((row) => row.original);
    
    setSelectedRows(currentSelectedRows);
    
    if (onSelectionChange) {
      onSelectionChange(currentSelectedRows);
    }
  }, [rowSelection, table, onSelectionChange]);

  const handleAddClick = () => {
    if (enableAddDialog) {
      setAddDialogOpen(true);
    } else if (onAdd) {
      onAdd();
    }
  };

  const handleDeleteClick = () => {
    if (enableDeleteDialog) {
      setDeleteDialogOpen(true);
    } else if (onDeleteSelected) {
      onDeleteSelected();
    }
  };

  const handleConfirmAdd = () => {
    if (onConfirmAdd) {
      onConfirmAdd(formData);
      setFormData({});
      setAddDialogOpen(false);
    }
  };

  const handleConfirmDelete = () => {
    if (onConfirmDelete) {
      onConfirmDelete(selectedRows);
      setRowSelection({});
      setDeleteDialogOpen(false);
    }
  };

  // Domyślne pola formularza (jeśli nie podano addFormFields)
  const defaultAddFormFields = !addFormFields ? (
    <>
      <div className="grid gap-2">
        <Label htmlFor="name">Nazwa *</Label>
        <Input
          id="name"
          value={formData.name || ""}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Nazwa elementu"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email || ""}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="email@example.com"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="status">Status</Label>
        <Input
          id="status"
          value={formData.status || ""}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          placeholder="Status"
        />
      </div>
    </>
  ) : (
    addFormFields
  );

  const defaultDeleteDescription = deleteDialogDescription || 
    `Czy na pewno chcesz usunąć ${selectedRows.length} zaznaczonych${
      selectedRows.length === 1 ? " element" : " elementów"
    }? Ta operacja nie może być cofnięta.`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-8"
              />
            </div>
          )}
          {filters && <div className="flex items-center gap-2">{filters}</div>}
        </div>
        <div className="flex items-center gap-2">
          {(onDeleteSelected || enableDeleteDialog) && 
           table.getFilteredSelectedRowModel().rows.length > 0 && (
            <Button onClick={handleDeleteClick} size="sm" variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              {deleteButtonLabel}
            </Button>
          )}
          {(onAdd || enableAddDialog) && (
            <Button onClick={handleAddClick} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {addButtonLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();
                  
                  return (
                    <TableHead 
                      key={header.id}
                      className={canSort ? "cursor-pointer select-none" : ""}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="inline-flex">
                            {sortDirection === "asc" ? (
                              <ArrowUp className="h-4 w-4" />
                            ) : sortDirection === "desc" ? (
                              <ArrowDown className="h-4 w-4" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4 opacity-50" />
                            )}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={onRowClick ? "cursor-pointer" : ""}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {enablePagination && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length > 0 && (
              <span>
                {table.getFilteredSelectedRowModel().rows.length} z{" "}
                {table.getFilteredRowModel().rows.length} wybrano
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Poprzednia
            </Button>
            <div className="text-sm text-muted-foreground">
              Strona {table.getState().pagination.pageIndex + 1} z {table.getPageCount()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Następna
            </Button>
          </div>
        </div>
      )}

      {/* Dialog dodawania */}
      {enableAddDialog && (
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{addDialogTitle}</DialogTitle>
              <DialogDescription>{addDialogDescription}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {defaultAddFormFields}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Anuluj
              </Button>
              <Button
                onClick={handleConfirmAdd}
                disabled={!addFormFields && (!formData.name || !formData.email)}
              >
                Dodaj
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog usuwania */}
      {enableDeleteDialog && (
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{deleteDialogTitle}</DialogTitle>
              <DialogDescription>{defaultDeleteDescription}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Anuluj
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>
                Usuń
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

