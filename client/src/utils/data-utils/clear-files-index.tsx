import { useMutation, } from "@tanstack/react-query";
import { useInvalidateDuplicateImages } from "./duplicate-images";
import { useInvalidateFiles } from "./image-data";

const clearFilesIndex = async (): Promise<{ message: string }> => {
    const response = await fetch("/clear-files-index", {
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
    const invalidateDuplicates = useInvalidateDuplicateImages();
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