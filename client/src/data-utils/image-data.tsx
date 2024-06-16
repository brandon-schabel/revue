import { useQuery } from "@tanstack/react-query"
import { ImageMetadata } from "../types/types"

export const getImages = async () => {
    const fetcher = fetch("/images")
    return fetcher.then(response => response.json()) as Promise<ImageMetadata[]>
}


export const useImages = () => {
    return useQuery({
        queryKey: ["images"],
        queryFn: getImages,
    })
}