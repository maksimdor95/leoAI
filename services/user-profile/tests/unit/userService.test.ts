import { UserService } from '../../src/services/userService';
import { UserRepository } from '../../src/models/userRepository';
import { User } from '../../src/models/User';
import { User } from '../../src/models/User';

// Mock dependencies
jest.mock('../../src/models/userRepository');
jest.mock('../../src/utils/password');
jest.mock('../../src/utils/jwt');

const mockUserRepository = UserRepository as jest.Mocked<typeof UserRepository>;
const mockHashPassword = jest.fn();
const mockComparePassword = jest.fn();
const mockGenerateToken = jest.fn();

// Import after mocking (needed for type checking but mocked, so eslint warnings are expected)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { hashPassword, comparePassword } from '../../src/utils/password';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { generateToken } from '../../src/utils/jwt';

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    (hashPassword as jest.Mock) = mockHashPassword;
    (comparePassword as jest.Mock) = mockComparePassword;
    (generateToken as jest.Mock) = mockGenerateToken;
  });

  describe('register', () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      first_name: 'John',
      last_name: 'Doe',
    };

    it('should register a new user successfully', async () => {
      // Mock user doesn't exist
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Mock password hashing
      mockHashPassword.mockResolvedValue('hashed_password');

      // Mock user creation
      const mockUser = {
        id: 'user-123',
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockUserRepository.create.mockResolvedValue(mockUser);

      // Mock token generation
      mockGenerateToken.mockReturnValue('jwt-token-123');

      const result = await UserService.register(userData);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(mockHashPassword).toHaveBeenCalledWith(userData.password);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        ...userData,
        password_hash: 'hashed_password',
      });
      expect(mockGenerateToken).toHaveBeenCalledWith({
        userId: mockUser.id,
        email: mockUser.email,
      });

      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          first_name: mockUser.first_name,
          last_name: mockUser.last_name,
        },
        token: 'jwt-token-123',
      });
    });

    it('should throw error if user already exists', async () => {
      const existingUser = {
        id: 'existing-user',
        email: userData.email,
      };

      mockUserRepository.findByEmail.mockResolvedValue(existingUser as User);

      await expect(UserService.register(userData)).rejects.toThrow(
        'User with this email already exists'
      );

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: loginData.email,
        first_name: 'John',
        last_name: 'Doe',
        password_hash: 'hashed_password',
      };

      mockUserRepository.findByEmail.mockResolvedValue(mockUser as User);
      mockComparePassword.mockResolvedValue(true);
      mockGenerateToken.mockReturnValue('jwt-token-123');

      const result = await UserService.login(loginData.email, loginData.password);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(loginData.email);
      expect(mockComparePassword).toHaveBeenCalledWith(loginData.password, mockUser.password_hash);
      expect(mockGenerateToken).toHaveBeenCalledWith({
        userId: mockUser.id,
        email: mockUser.email,
      });

      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          first_name: mockUser.first_name,
          last_name: mockUser.last_name,
        },
        token: 'jwt-token-123',
      });
    });

    it('should throw error if user not found', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(UserService.login(loginData.email, loginData.password)).rejects.toThrow(
        'Invalid email or password'
      );

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(loginData.email);
      expect(mockComparePassword).not.toHaveBeenCalled();
    });

    it('should throw error if password is invalid', async () => {
      const mockUser = {
        id: 'user-123',
        email: loginData.email,
        password_hash: 'hashed_password',
      };

      mockUserRepository.findByEmail.mockResolvedValue(mockUser as User);
      mockComparePassword.mockResolvedValue(false);

      await expect(UserService.login(loginData.email, loginData.password)).rejects.toThrow(
        'Invalid email or password'
      );

      expect(mockComparePassword).toHaveBeenCalledWith(loginData.password, mockUser.password_hash);
      expect(mockGenerateToken).not.toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepository.findById.mockResolvedValue(mockUser as User);

      const result = await UserService.getUserById('user-123');

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        first_name: mockUser.first_name,
        last_name: mockUser.last_name,
        created_at: mockUser.created_at,
        updated_at: mockUser.updated_at,
      });
    });

    it('should throw error if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(UserService.getUserById('user-123')).rejects.toThrow('User not found');
    });
  });

  describe('updateUser', () => {
    const updateData = {
      email: 'newemail@example.com',
      first_name: 'Jane',
      last_name: 'Smith',
    };

    it('should update user successfully', async () => {
      const mockUpdatedUser = {
        id: 'user-123',
        email: updateData.email,
        first_name: updateData.first_name,
        last_name: updateData.last_name,
        updated_at: new Date(),
      };

      mockUserRepository.update.mockResolvedValue(mockUpdatedUser as User);

      const result = await UserService.updateUser('user-123', updateData);

      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', updateData);
      expect(result).toEqual({
        id: mockUpdatedUser.id,
        email: mockUpdatedUser.email,
        first_name: mockUpdatedUser.first_name,
        last_name: mockUpdatedUser.last_name,
        updated_at: mockUpdatedUser.updated_at,
      });
    });
  });
});

