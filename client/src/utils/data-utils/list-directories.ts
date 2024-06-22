import { useQuery } from "@tanstack/react-query";
import type { Directory } from "../../types/types";
import { useInvalidator } from "./use-invalidator";

export const getDiretories = async () => {
	const fetcher = fetch("/list-directories", {
        headers: {
            "Content-Type": "application/json",
        }
    });
	return fetcher.then((response) => response.json()) as Promise<Directory[]>;
};

export const useDirectories = ({ path }: { path: string }) => {
	return useQuery({
		queryKey: ["directories", path],
		queryFn: getDiretories,
	});
};


export const useInvalidateDirectories = () => {
    return useInvalidator(["directories"])
}