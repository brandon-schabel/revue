import { useState, useEffect, useCallback } from 'react';

export function useUrlParams<T extends Record<string, string>>(): [T, (params: Partial<T>) => void] {
    const [params, setParams] = useState<T>({} as T);

    // Read from URL
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const urlParams: Record<string, string> = {};
        searchParams.forEach((value, key) => {
            urlParams[key] = value;
        });
        setParams(urlParams as T);
    }, []);

    // Update URL and state
    const updateParams = useCallback((newParams: Partial<T>) => {
        setParams(prevParams => {
            const updatedParams = { ...prevParams, ...newParams };
            const searchParams = new URLSearchParams();
            for (const [key, value] of Object.entries(updatedParams)) {
                if (value !== undefined && value !== null) {
                    searchParams.set(key, value);
                }
            }
            const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
            window.history.pushState({}, '', newUrl);
            return updatedParams;
        });
    }, []);

    return [params, updateParams];
}