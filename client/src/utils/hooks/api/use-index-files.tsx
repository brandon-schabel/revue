import { useMutation } from "@tanstack/react-query"
import { useInvalidateFiles } from "./use-files"
import { fetchServer } from "../fetch-server"

const startIndexFiles = async (path: string) => {
  const body = JSON.stringify(
    {
      path,
    }
  )
  const result = await fetchServer("/index-files", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
    }
  })

  return result.json()
}


export const useStartIndexFiles = () => {
  const invalidateFiles = useInvalidateFiles()
  return useMutation({
    mutationFn: startIndexFiles,
    onSuccess: () => {
      invalidateFiles()
    }
  })
}
