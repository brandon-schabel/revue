import { useQuery } from "@tanstack/react-query";
import type { DirectoryContents } from "../../types/types";
import { useInvalidator } from "./use-invalidator";

export const getDirectoryContents = async (path: string) => {
	const fetcher = fetch("/api/v1/list-directory", {
		method: "POST",
		body: JSON.stringify({ path }),
		headers: {
			"Content-Type": "application/json",
		},
	});
	return fetcher.then((response) => response.json()) as Promise<DirectoryContents>;
};

export const useDirectoryContents = ({ path }: { path: string }) => {
	return useQuery({
		queryKey: ["directoryContents", path],
		queryFn: () => getDirectoryContents(path),
	});
};

export const useInvalidateDirectoryContents = () => {
	return useInvalidator(["directoryContents"]);
};