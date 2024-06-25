import { useMutation } from "@tanstack/react-query";
import { useInvalidateFiles } from "./use-files";
import { fetchServer } from "../fetch-server";

const deleteFile = async (filePath: string): Promise<{ message: string }> => {
    const response = await fetchServer("/delete-file", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ filePath }),
    });
    if (!response.ok) {
        throw new Error("Failed to delete file");
    }
    return response.json();
};

export const useDeleteFile = () => {
    const invalidateFiles = useInvalidateFiles();

    return useMutation({
        mutationFn: deleteFile,
        onSuccess: () => {
            invalidateFiles();
        },
    });
};