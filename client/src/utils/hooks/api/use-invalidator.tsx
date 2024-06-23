import { useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"

export const useInvalidator = (queryKey: string[]) => {
    const queryClient = useQueryClient()
    return useMemo(() => {
        return () => queryClient.invalidateQueries({
            queryKey,
        })
    }, [queryKey, queryClient])

}

