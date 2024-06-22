import { useQuery } from "@tanstack/react-query";
import type { FileMetadata } from "../../types/types";
import { useInvalidator } from "./use-invalidator";

export type DuplicateImageGroup = FileMetadata[];

export const getDuplicateImages = async (): Promise<DuplicateImageGroup[]> => {
    const response = await fetch("/get-duplicate-images", {
        headers: {
            "Content-Type": "application/json",
        }
    });
    if (!response.ok) {
        throw new Error("Failed to fetch duplicate images");
    }
    return response.json();
};

export const useFindDuplicateImages = () => {
    return useQuery({
        queryKey: ["duplicateImages"],
        queryFn: getDuplicateImages,
    });
};

export const useInvalidateDuplicateImages = () => {
    return useInvalidator(["duplicateImages"]);
};