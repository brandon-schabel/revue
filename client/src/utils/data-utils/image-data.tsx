import { useQuery } from "@tanstack/react-query"
import type { IndexedFileMetadata } from "../../types/types"
import { useInvalidator } from "./use-invalidator"

export const getFiles = async () => {
    const fetcher = fetch("/api/v1/images", {
        headers: {
            "Content-Type": "application/json",
        }
    })
    return fetcher.then(response => response.json()) as Promise<IndexedFileMetadata[]>
}


export const useFiles = () => {
    return useQuery({
        queryKey: ["images"],
        queryFn: getFiles,
    })
}

export const useInvalidateFiles = () => {
    return useInvalidator(["images"])
}