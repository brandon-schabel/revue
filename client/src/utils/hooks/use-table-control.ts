import {
    type ColumnDef,
    type SortingState,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";

export const useTableControl = <T,>({ columns, data }: { columns: ColumnDef<T>[]; data: T[] }) => {
    const [sorting, setSorting] = useState<SortingState>([]);

    return useReactTable({
        data,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });
};

export type UseTableControl<T> = ReturnType<typeof useTableControl<T>>;