import { useQuery } from "@tanstack/react-query"
import { FileMetadata } from "../types/types"

export const getFiles = async () => {
    const fetcher = fetch("/images")
    return fetcher.then(response => response.json()) as Promise<FileMetadata[]>
}


export const useFiles = () => {
    return useQuery({
        queryKey: ["images"],
        queryFn: getFiles,
    })
}