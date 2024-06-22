import { useQuery } from "@tanstack/react-query"
import type { FileMetadata } from "../../types/types"
import { useInvalidator } from "./use-invalidator"

export const getFiles = async () => {
    const fetcher = fetch("/images", {
        headers: {
            "Content-Type": "application/json",
        }
    })
    return fetcher.then(response => response.json()) as Promise<FileMetadata[]>
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