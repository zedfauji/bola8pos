export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  // Add other user properties as needed
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
