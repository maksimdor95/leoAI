/**
 * User Model
 * Defines the structure of a user in the database
 */

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface UpdateUserData {
  email?: string;
  first_name?: string;
  last_name?: string;
}
