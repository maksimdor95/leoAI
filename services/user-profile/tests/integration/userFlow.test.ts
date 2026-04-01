import request from 'supertest';
import express from 'express';
import { userRoutes } from '../../src/routes/userRoutes';
import { errorHandler } from '../../src/middleware/errorHandler';
import { connectDatabase } from '../../src/config/database';

// Mock database connection for tests
jest.mock('../../src/config/database');

describe('User Registration and Login Flow', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Create test app
    app = express();
    app.use(express.json());
    app.use('/api/users', userRoutes);
    app.use(errorHandler);

    // Mock database connection
    (connectDatabase as jest.Mock).mockResolvedValue(undefined);
  });

  beforeEach(async () => {
    // Clean up test data - in a real scenario, this would truncate tables
    // For now, we'll rely on unique test data
  });

  describe('POST /api/users/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: 'testpassword123',
        first_name: 'Test',
        last_name: 'User',
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'User registered successfully');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.first_name).toBe(userData.first_name);
      expect(response.body.user.last_name).toBe(userData.last_name);
    });

    it('should return 400 for invalid email', async () => {
      const invalidUserData = {
        email: 'invalid-email',
        password: 'testpassword123',
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(invalidUserData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(Array.isArray(response.body.errors)).toBe(true);
    });

    it('should return 400 for short password', async () => {
      const invalidUserData = {
        email: 'test@example.com',
        password: '123', // Too short
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(invalidUserData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(Array.isArray(response.body.errors)).toBe(true);
    });

    it('should return 409 for existing user', async () => {
      const userData = {
        email: `existing-${Date.now()}@example.com`,
        password: 'testpassword123',
      };

      // Register user first
      await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      // Try to register again
      const response = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(409);

      expect(response.body).toHaveProperty('error', 'User with this email already exists');
    });
  });

  describe('POST /api/users/login', () => {
    let testUser: { email: string; password: string; token?: string };

    beforeEach(async () => {
      // Create a test user for login tests
      testUser = {
        email: `login-test-${Date.now()}@example.com`,
        password: 'testpassword123',
      };

      const registerResponse = await request(app)
        .post('/api/users/register')
        .send(testUser)
        .expect(201);

      testUser.token = registerResponse.body.token;
    });

    it('should login user successfully', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid email or password');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/users/profile', () => {
    let testUser: { email: string; password: string; token?: string; id?: string };

    beforeEach(async () => {
      // Create and login test user
      testUser = {
        email: `profile-test-${Date.now()}@example.com`,
        password: 'testpassword123',
      };

      const registerResponse = await request(app)
        .post('/api/users/register')
        .send(testUser)
        .expect(201);

      testUser.token = registerResponse.body.token;
      testUser.id = registerResponse.body.user.id;
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testUser.id);
      expect(response.body).toHaveProperty('email', testUser.email);
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('updated_at');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized: No token provided');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized: Invalid token');
    });
  });

  describe('PUT /api/users/profile', () => {
    let testUser: { email: string; password: string; token?: string; id?: string };

    beforeEach(async () => {
      // Create and login test user
      testUser = {
        email: `update-test-${Date.now()}@example.com`,
        password: 'testpassword123',
      };

      const registerResponse = await request(app)
        .post('/api/users/register')
        .send(testUser)
        .expect(201);

      testUser.token = registerResponse.body.token;
      testUser.id = registerResponse.body.user.id;
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        first_name: 'Updated',
        last_name: 'Name',
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testUser.token}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Profile updated successfully');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.first_name).toBe(updateData.first_name);
      expect(response.body.user.last_name).toBe(updateData.last_name);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .send({ first_name: 'Test' })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });
  });
});

