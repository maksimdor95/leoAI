/**
 * User Model
 * Defines the structure of a user in the database
 */

export interface User {
  id: string;
  email: string;
  password_hash: string;
  google_id?: string;
  yandex_id?: string;
  first_name?: string;
  last_name?: string;
  /** Relative filename under avatars dir, e.g. `{uuid}.jpg` */
  avatar_path?: string | null;
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
  avatar_path?: string | null;
}

/** Safe user fields returned by API (no password_hash). */
export interface PublicUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  /** App-relative URL for <img src>, or undefined if no avatar */
  avatar_url?: string;
  created_at?: Date;
  updated_at?: Date;
}

export function toPublicUser(user: User): PublicUser {
  const avatar_url = user.avatar_path
    ? `/api/users/${user.id}/avatar?v=${new Date(user.updated_at).getTime()}`
    : undefined;
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name || undefined,
    last_name: user.last_name || undefined,
    avatar_url,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}
