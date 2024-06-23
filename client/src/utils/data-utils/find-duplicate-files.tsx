import { useQuery } from "@tanstack/react-query";
import type { IndexedFileMetadata } from "../../types/types";
import { useInvalidator } from "./use-invalidator";

export type DuplicateFileGroup = IndexedFileMetadata[];

export const getDuplicateFiles = async (): Promise<DuplicateFileGroup[]> => {
    const response = await fetch("/api/v1/get-duplicate-files", {
        headers: {
            "Content-Type": "application/json",
        }
    });
    if (!response.ok) {
        throw new Error("Failed to fetch duplicate files");
    }
    return response.json();
};

export const useFindDuplicateFiles = () => {
    return useQuery({
        queryKey: ["duplicateFiles"],
        queryFn: getDuplicateFiles,
    });
};

export const useInvalidateDuplicateFiles = () => {
    return useInvalidator(["duplicateFiles"]);
};