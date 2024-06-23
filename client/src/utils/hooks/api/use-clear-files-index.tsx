import { useMutation, } from "@tanstack/react-query";
import { useInvalidateDuplicateFiles } from "./use-find-duplicate-files";
import { useInvalidateFiles } from "./use-files";

const clearFilesIndex = async (): Promise<{ message: string }> => {
    const response = await fetch("/api/v1/clear-files-index", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error("Failed to clear files index");
    }
    return response.json();
};

export const useClearFilesIndex = () => {
    const invalidateDuplicates = useInvalidateDuplicateFiles();
    const invalidateFiles = useInvalidateFiles();

    return useMutation({
        mutationFn: clearFilesIndex,
        onSuccess: () => {
            // Invalidate and refetch relevant queries
            invalidateFiles();
            invalidateDuplicates();
        },
    });
};