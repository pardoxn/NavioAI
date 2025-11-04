import { useMemo } from "react";

export function useApi() {
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const authedFetch = useMemo(() => {
    return (path, opts = {}) => {
      const url = path.startsWith("http") ? path : baseUrl + path;
      const headers = {
        Accept: "application/json",
        ...(opts.headers || {}),
      };
      // Falls du einen Token speicherst, wird er hier optional mitgeschickt
      try {
        const tok = JSON.parse(localStorage.getItem("auth:token") || "null");
        const bearer = tok?.access || tok?.token;
        if (bearer) headers.Authorization = `Bearer ${bearer}`;
      } catch {}

      return fetch(url, {
        credentials: "include",
        ...opts,
        headers,
      });
    };
  }, [baseUrl]);

  return { baseUrl, authedFetch };
}
