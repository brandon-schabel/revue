import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/table";
import { flexRender } from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { UseTableControl } from "../utils/hooks/use-table-control";

export type ControlledTableProps = {
    // biome-ignore lint/suspicious/noExplicitAny: expected any
    table: UseTableControl<any>;
};

export const ControlledTable = ({ table }: ControlledTableProps) => {
    return (
        <Table>
            <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                            const sortingStatus = header.column.getIsSorted();

                            return (
                                <TableHead
                                    key={header.id}
                                    onClick={header.column.getToggleSortingHandler()}
                                    className="cursor-pointer select-none"
                                >
                                    {header.isPlaceholder ? null : (
                                        <div className="flex items-center">
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {{
                                                asc: <ChevronUp />,
                                                desc: <ChevronDown />,
                                            }[sortingStatus as string] ?? null}
                                        </div>
                                    )}
                                </TableHead>
                            );
                        })}
                    </TableRow>
                ))}
            </TableHeader>
            <TableBody>
                {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                                <div className="max-w-64 max-h-32 overflow-auto">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </div>
                            </TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};