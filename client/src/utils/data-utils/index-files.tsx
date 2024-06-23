import { useMutation } from "@tanstack/react-query"
import { useInvalidateFiles } from "./image-data"

const startIndexFiles = async (path: string) => {
  const body = JSON.stringify(
    {
      path,
    }
  )
  const result = await fetch("/api/v1/index-files", {
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
