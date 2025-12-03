/**
 * RozoAI API Configuration Constants
 */
export const ROZO_API_URL = "https://intentapiv2.rozo.ai/functions/v1";
export const NEW_ROZO_API_URL = "https://intentapiv4.rozo.ai/functions/v1";
export const ROZO_API_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4Y3Zmb2xobmNtdXZmYXp1cXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4Mzg2NjYsImV4cCI6MjA2ODQxNDY2Nn0.B4dV5y_-zCMKSNm3_qyCbAvCPJmoOGv_xB783LfAVUA";

// HTTP methods type
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

// Request options type
export interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
  signal?: AbortSignal;
}

// Response type with generic data
export interface ApiResponse<T = any> {
  data: T | null;
  error: Error | null;
  status: number | null;
}

// Request state for hooks (used in connectkit)
export interface RequestState<T = any> extends ApiResponse<T> {
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
}

/**
 * API Version type
 */
export type ApiVersion = "v2" | "v4";

/**
 * API Configuration
 */
export interface ApiConfig {
  baseUrl: string;
  apiToken: string;
  version?: ApiVersion;
}

// Default configuration (can be overridden via setApiConfig)
// v4 is the default API version
let apiConfig: ApiConfig = {
  baseUrl: NEW_ROZO_API_URL,
  apiToken: ROZO_API_TOKEN,
  version: "v4",
};

/**
 * Sets the API configuration (baseUrl, apiToken, and version)
 * @param config - Partial API configuration to override defaults
 * @example
 * ```typescript
 * // Use v2 API
 * setApiConfig({ version: "v2" });
 *
 * // Use v4 API (default)
 * setApiConfig({ version: "v4" });
 *
 * // Custom configuration
 * setApiConfig({
 *   baseUrl: "https://custom-api.com",
 *   apiToken: "custom-token",
 *   version: "v4"
 * });
 * ```
 */
export const setApiConfig = (config: Partial<ApiConfig>): void => {
  if (config.version) {
    // Auto-set baseUrl based on version if not explicitly provided
    if (!config.baseUrl) {
      config.baseUrl =
        config.version === "v4" ? NEW_ROZO_API_URL : ROZO_API_URL;
    }
  }

  apiConfig = {
    ...apiConfig,
    ...config,
  };
};

/**
 * Gets the current API configuration
 * @returns Current API configuration
 */
export const getApiConfig = (): Readonly<ApiConfig> => {
  return { ...apiConfig };
};

/**
 * Creates a URL with query parameters
 * @param url - Base URL
 * @param params - Query parameters
 * @returns Full URL with query parameters
 */
const createUrl = (url: string, params?: Record<string, string>): string => {
  const fullUrl = url.startsWith("/")
    ? `${apiConfig.baseUrl}${url}`
    : `${apiConfig.baseUrl}/${url}`;

  if (!params) return fullUrl;

  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value);
    }
  });

  const queryString = queryParams.toString();
  return queryString ? `${fullUrl}?${queryString}` : fullUrl;
};

/**
 * Core fetch function for making API requests
 * @param url - API endpoint path
 * @param options - Request options
 * @returns Promise with response data
 */
export const fetchApi = async <T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> => {
  const { method = "GET", headers = {}, body, params, signal } = options;

  try {
    const fullUrl = createUrl(url, params);

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
      Authorization: `Bearer ${apiConfig.apiToken}`,
    };

    const requestOptions: {
      method: string;
      headers: Record<string, string>;
      signal?: AbortSignal;
      body?: string;
    } = {
      method,
      headers: requestHeaders,
      signal,
    };

    if (body && method !== "GET") {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(fullUrl, requestOptions);
    const status = response.status;

    // Handle non-JSON responses
    const contentType = response.headers.get("content-type");
    let data: T | null = null;

    if (contentType && contentType.includes("application/json")) {
      data = (await response.json()) as T;
    } else if (contentType && contentType.includes("text/")) {
      data = (await response.text()) as unknown as T;
    }

    if (!response.ok) {
      throw new Error(data ? JSON.stringify(data) : response.statusText);
    }

    return { data, error: null, status };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
      status: null,
    };
  }
};

/**
 * API client with methods for different HTTP verbs
 */
export const apiClient = {
  /**
   * GET request
   * @param url - API endpoint path
   * @param options - Request options
   * @returns Promise with response data
   */
  get: <T = any>(
    url: string,
    options: Omit<RequestOptions, "method" | "body"> = {}
  ) => fetchApi<T>(url, { ...options, method: "GET" }),

  /**
   * POST request
   * @param url - API endpoint path
   * @param body - Request body
   * @param options - Additional request options
   * @returns Promise with response data
   */
  post: <T = any>(
    url: string,
    body: any,
    options: Omit<RequestOptions, "method" | "body"> = {}
  ) => fetchApi<T>(url, { ...options, method: "POST", body }),

  /**
   * PUT request
   * @param url - API endpoint path
   * @param body - Request body
   * @param options - Additional request options
   * @returns Promise with response data
   */
  put: <T = any>(
    url: string,
    body: any,
    options: Omit<RequestOptions, "method" | "body"> = {}
  ) => fetchApi<T>(url, { ...options, method: "PUT", body }),

  /**
   * PATCH request
   * @param url - API endpoint path
   * @param body - Request body
   * @param options - Additional request options
   * @returns Promise with response data
   */
  patch: <T = any>(
    url: string,
    body: any,
    options: Omit<RequestOptions, "method" | "body"> = {}
  ) => fetchApi<T>(url, { ...options, method: "PATCH", body }),

  /**
   * DELETE request
   * @param url - API endpoint path
   * @param options - Request options
   * @returns Promise with response data
   */
  delete: <T = any>(
    url: string,
    options: Omit<RequestOptions, "method"> = {}
  ) => fetchApi<T>(url, { ...options, method: "DELETE" }),
};
