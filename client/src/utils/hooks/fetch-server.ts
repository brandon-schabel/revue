
export const fetchServer = async (resource: string, init?: RequestInit) => {
	let baseUrl = "";

	if (process.env.NODE_ENV === "production") {
		baseUrl = "/api/v1";
	}

	if (process.env.NODE_ENV === "development") {
		baseUrl = "http://localhost:8080/api/v1";
	}

	return fetch(baseUrl + resource, init);
};
