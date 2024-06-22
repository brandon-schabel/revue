import { useMutation } from "@tanstack/react-query"
import { useInvalidateFiles } from "./image-data"

const startIndexImages = async (path: string) => {
  const body = JSON.stringify(
    {
      path,
      reindex: true
    }
  )
  const result = await fetch("/index", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
    }
  })

  return result.json()
}


export const useStartIndexImages = () => {
  const invalidateFiles = useInvalidateFiles()
  return useMutation({
    mutationFn: startIndexImages,
    onSuccess: () => {
      invalidateFiles()
    }
  })
}
