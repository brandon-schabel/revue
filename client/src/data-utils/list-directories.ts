import { useQuery } from "@tanstack/react-query"
import { Directory} from "../types/types"

export const getDiretories = async () => {
    const fetcher = fetch("/list-directories")
    return fetcher.then(response => response.json()) as Promise<Directory[]>
}


export const useDirectories = ({path}: {path: string}) => {
    return useQuery({
        queryKey: ["directories", path],
        queryFn: getDiretories,
    })
}