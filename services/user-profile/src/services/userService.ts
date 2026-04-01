/**
 * User Service
 * Business logic for user operations
 */

import { UserRepository } from '../models/userRepository';
import { CreateUserData, UpdateUserData } from '../models/User';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';

export interface RegisterResult {
  user: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
  token: string;
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
  token: string;
}

export class UserService {
  /**
   * Register a new user
   */
  static async register(userData: CreateUserData): Promise<RegisterResult> {
    // Check if user already exists
    const existingUser = await UserRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const password_hash = await hashPassword(userData.password);

    // Create user
    const user = await UserRepository.create({
      ...userData,
      password_hash,
    });

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name || undefined,
        last_name: user.last_name || undefined,
      },
      token,
    };
  }

  /**
   * Login user
   */
  static async login(email: string, password: string): Promise<LoginResult> {
    // Find user by email
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name || undefined,
        last_name: user.last_name || undefined,
      },
      token,
    };
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name || undefined,
      last_name: user.last_name || undefined,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  /**
   * Update user
   */
  static async updateUser(userId: string, userData: UpdateUserData) {
    const user = await UserRepository.update(userId, userData);

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name || undefined,
      last_name: user.last_name || undefined,
      updated_at: user.updated_at,
    };
  }
}
