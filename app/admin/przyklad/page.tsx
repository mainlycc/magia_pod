"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ReusableTable } from "@/components/reusable-table";

// Przykładowy typ danych
type ExampleData = {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
};

export default function PrzykladPage() {
  const [data, setData] = useState<ExampleData[]>([]);

  // Definicja kolumn
  const columns = useMemo<ColumnDef<ExampleData>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nazwa",
        enableSorting: true,
      },
      {
        accessorKey: "email",
        header: "Email",
        enableSorting: false,
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: true,
      },
      {
        accessorKey: "createdAt",
        header: "Data utworzenia",
        enableSorting: false,
      },
    ],
    []
  );

  const handleConfirmAdd = (formData: Record<string, string>) => {
    if (formData.name && formData.email) {
      const newItem: ExampleData = {
        id: Date.now().toString(),
        name: formData.name,
        email: formData.email,
        status: formData.status || "Aktywny",
        createdAt: new Date().toLocaleDateString("pl-PL"),
      };
      setData([...data, newItem]);
    }
  };

  const handleConfirmDelete = (selectedRows: ExampleData[]) => {
    const selectedIds = new Set(selectedRows.map((row) => row.id));
    setData(data.filter((item) => !selectedIds.has(item.id)));
  };

  return (
    <div className="space-y-4">
      <ReusableTable
        columns={columns}
        data={data}
        searchable={true}
        searchPlaceholder="Szukaj..."
        searchColumn="name"
        enableRowSelection={true}
        enablePagination={true}
        pageSize={10}
        emptyMessage="Brak danych"
        enableAddDialog={true}
        enableDeleteDialog={true}
        onConfirmAdd={handleConfirmAdd}
        onConfirmDelete={handleConfirmDelete}
        addButtonLabel="Dodaj"
        deleteButtonLabel="Usuń"
      />
    </div>
  );
}

