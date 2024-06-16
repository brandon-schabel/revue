import { useMutation } from "@tanstack/react-query"

const startIndexImages = async (path: string) => {
    const body = JSON.stringify(
      {
        path,
        reindex: true
      }
    )
    const result = await fetch("/index", {
      method: "POST",
      body
    })
  
    return result.json()
  }
  
  
  export const useStartIndexImages = () => {
    return useMutation({
      mutationFn: startIndexImages,
  
    })
  }
  