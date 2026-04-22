/**
 * Socket.io types
 */

export interface SocketAuth {
  token?: string;
  email?: string;
  userId?: string;
  sessionId?: string;
  createNew?: boolean;
  product?: 'jack' | 'wannanew';
}
