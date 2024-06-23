import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ImageAnalysis } from "../../../types/types";

export const analyzeImage = async (imageId: number): Promise<ImageAnalysis> => {
    const response = await fetch(`/api/v1/analyze-image/${imageId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error("Failed to analyze image");
    }
    return response.json();
};

export const useAnalyzeImage = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: analyzeImage,
        onSuccess: () => {
            // Invalidate and refetch the images query
            queryClient.invalidateQueries({ queryKey: ["images"] });
        },
    });
};