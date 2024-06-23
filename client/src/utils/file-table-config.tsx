import type { IndexedFileMetadata } from '../types/types'
import type { ColumnDef } from '@tanstack/react-table'



export const fileTableColumns: ColumnDef<IndexedFileMetadata>[] = [
    {
        header: 'File Name',
        accessorKey: 'file_name',

    },
    {
        header: 'File Path',
        accessorKey: 'file_path',

    },
    {
        header: 'File Size',
        accessorKey: 'file_size',

    },
    {
        header: 'File Format',
        accessorKey: 'file_format',

    },
    {
        header: 'Date Created',
        accessorKey: 'date_created',

    },
    {
        header: 'Date Modified',
        accessorKey: 'date_modified',

    },
    {
        header: 'Hash',
        accessorKey: 'hash',

    },
    {
        header: 'Thumbnail Path',
        accessorKey: 'thumbnail_path',
    },
    {
        header: 'Thumbnail Path',
        accessorKey: 'thumbnail_path',
        cell: (info) => {
            const value = info.row.original
            return <img src={value.thumbnail_path} alt="thumbnail" />
        },

    },
]


