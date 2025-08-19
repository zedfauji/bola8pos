declare module '@/lib/auth' {
  export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    permissions?: string[];
  }

  export interface AuthResponse {
    user: User;
    token: string;
    expiresIn: number;
  }

  export function login(credentials: { email: string; password: string }): Promise<AuthResponse>;
  export function logout(): Promise<void>;
  export function getCurrentUser(): User | null;
  export function isAuthenticated(): boolean;
  export function hasPermission(permission: string): boolean;
}
