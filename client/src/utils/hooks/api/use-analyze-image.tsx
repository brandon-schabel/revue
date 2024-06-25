import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ImageAnalysis } from "../../../types/types";
import { fetchServer } from "../fetch-server";





export const analyzeImage = async (imageId: number, options: {
    service?: "claude" | "ollama";
    model?: string;
} = {
        service: "ollama",
        model: "llava",
    }): Promise<ImageAnalysis> => {
    const response = await fetchServer(`/analyze-image/${imageId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            service: options.service,
            model: options.model,
        }),
    });
    if (!response.ok) {
        throw new Error("Failed to analyze image");
    }
    return response.json();
};

export const useAnalyzeImage = ({
    service = "ollama",
    model = "llava",
}: {
    service?: "claude" | "ollama";
    model?: string;
} = {
        service: "ollama",
        model: "llava",
    }) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (imageId: number) => analyzeImage(imageId, {
            service,
            model,
        }),
        onSuccess: () => {
            // Invalidate and refetch the images query
            queryClient.invalidateQueries({ queryKey: ["images"] });
        },
    });
};