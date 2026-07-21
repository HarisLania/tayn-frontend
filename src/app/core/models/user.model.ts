/** CustomerProfile serializer. */
export interface CustomerProfile {
  phone: string;
  delivery_address: string;
  dietary_notes: string;
  stripe_customer_id: string;
}

/** accounts.User serializer. */
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  profile: CustomerProfile | null;
}

export interface JwtTokens {
  access: string;
  refresh: string;
}

/** POST /auth/login/ body. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** POST /auth/register/ body. */
export interface RegisterRequest {
  name: string;
  email: string;
  phone: string;
  delivery_address: string;
  dietary_notes?: string;
  password: string;
  confirm_password: string;
}

/** Response from /auth/login/ and /auth/register/. */
export interface AuthResponse {
  user: User;
  tokens: JwtTokens;
}
