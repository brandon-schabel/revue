import { useQuery } from "@tanstack/react-query";
import type { Drive } from "../../types/types";
import { useInvalidator } from "./use-invalidator";

export const getDrives = async (): Promise<Drive[]> => {
    const response = await fetch("/api/v1/list-drives", {
        headers: {
            "Content-Type": "application/json",
        }
    });
    if (!response.ok) {
        throw new Error("Failed to fetch drives");
    }
    return response.json();
};

export const useListDrives = () => {
    return useQuery({
        queryKey: ["drives"],
        queryFn: getDrives,
    });
};

export const useInvalidateDrives = () => {
    return useInvalidator(["drives"]);
};