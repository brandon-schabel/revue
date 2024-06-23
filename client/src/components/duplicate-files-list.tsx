import type React from 'react';
import { useState } from 'react';
import { Button } from '@ui/button';
import { useDeleteFile } from '../utils/data-utils/delete-file';
import type { DuplicateFileGroup } from '../utils/data-utils/find-duplicate-files';
import type { IndexedFileMetadata } from '../types/types';
import { LoaderCircle } from 'lucide-react';

interface DuplicateFilesListProps {
    duplicates: DuplicateFileGroup[];
    onDelete: () => void;
}

export const DuplicateFilesList: React.FC<DuplicateFilesListProps> = ({ duplicates, onDelete }) => {
    const deleteFileMutation = useDeleteFile();
    const [deletingGroup, setDeletingGroup] = useState<number | null>(null);
    const [deletingFile, setDeletingFile] = useState<string | null>(null);

    const handleDelete = async (filePath: string, groupIndex: number) => {
        setDeletingGroup(groupIndex);
        setDeletingFile(filePath);
        try {
            await deleteFileMutation.mutateAsync(filePath);
            onDelete();
        } finally {
            setDeletingGroup(null);
            setDeletingFile(null);
        }
    };

    const getFileAge = (dateCreated: string): string => {
        const now = new Date();
        const created = new Date(dateCreated);
        const diffInDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 3600 * 24));

        if (diffInDays === 0) return 'Today';
        if (diffInDays === 1) return 'Yesterday';
        if (diffInDays < 30) return `${diffInDays} days ago`;
        if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
        return `${Math.floor(diffInDays / 365)} years ago`;
    };

    return (
        <div>
            {duplicates?.map((group, groupIndex) => {
                const newestFile = group.reduce((newest, current) =>
                    new Date(current.date_created) > new Date(newest.date_created) ? current : newest
                );

                const isGroupDeleting = deletingGroup === groupIndex;

                return (
                    <div key={groupIndex} className="mb-4 p-4 border rounded">
                        <h3 className="font-bold mb-2">Hash: {group[0].hash}</h3>
                        <ul>
                            {group.map((file: IndexedFileMetadata, fileIndex: number) => {
                                const isNewest = file.file_path === newestFile.file_path;
                                const isDeleting = isGroupDeleting && deletingFile === file.file_path;
                                return (
                                    <li key={fileIndex} className={`flex justify-between items-center mb-2 ${isNewest ? 'bg-blue-100' : ''}`}>
                                        <div className="flex-grow">
                                            <span className="truncate mr-2">{file.file_path}</span>
                                            <span className="text-sm text-gray-500">({getFileAge(file.date_created)})</span>
                                            {isNewest && <span className="ml-2 text-sm font-semibold text-blue-600">Newest</span>}
                                        </div>
                                        <Button
                                            onClick={() => handleDelete(file.file_path, groupIndex)}
                                            disabled={isGroupDeleting}
                                            variant="destructive"
                                            size="sm"
                                        >
                                            {isDeleting ? <LoaderCircle className="animate-spin mr-2" /> : null}
                                            {isDeleting ? "Deleting..." : "Delete"}
                                        </Button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
};