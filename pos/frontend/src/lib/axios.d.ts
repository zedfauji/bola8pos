import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError extends Error {
  response?: {
    status: number;
    data: {
      message?: string;
      error?: string;
      errors?: Record<string, string[]>;
    };
  };
  config: AxiosRequestConfig;
  isAxiosError: boolean;
}

declare const api: {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>>;
  post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>>;
  put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>>;
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>>;
  patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>>;
  setAuthToken(token: string | null): void;
  setBaseURL(baseURL: string): void;
};

export default api;
