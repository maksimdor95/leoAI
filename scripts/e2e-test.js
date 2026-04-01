#!/usr/bin/env node

/**
 * E2E Test Script for Jack AI MVP
 * Tests the complete flow: Registration → Dialogue → Job Matching → Email
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080'; // Gateway URL

// Test user data
const testUser = {
  email: `e2e-test-${Date.now()}@example.com`,
  password: 'testpassword123',
  first_name: 'E2E',
  last_name: 'Test',
};

let authToken = '';
let userId = '';
let conversationId = '';

// Sample dialogue responses
const dialogueResponses = [
  'Привет! Я хочу найти работу в IT', // Introduction
  'Мне 25 лет', // Age
  'Middle разработчик', // Experience level
  '2 года опыта', // Experience years
  'Frontend разработчик', // Role
  'React, JavaScript, TypeScript', // Skills
  'Москва', // Location
  'Удаленная работа', // Work format
  '100000 рублей', // Salary
  'Разработка современных веб-приложений', // Tasks
  'Инновации, дружный коллектив', // Culture
  'Высшее техническое', // Education
  'Английский - intermediate', // Languages
  'Через месяц', // Availability
  'Все данные корректны', // Confirmation
];

async function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function makeRequest(method, url, data = null, useAuth = false) {
  try {
    const config = {
      method,
      url,
      headers: {},
    };

    if (data) {
      config.data = data;
      config.headers['Content-Type'] = 'application/json';
    }

    if (useAuth && authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    log(`❌ Request failed: ${method} ${url}`, error.response?.data || error.message);
    throw error;
  }
}

async function testUserRegistration() {
  log('🚀 Testing user registration...');

  const response = await makeRequest('POST', `${API_BASE_URL}/api/users/register`, {
    email: testUser.email,
    password: testUser.password,
    first_name: testUser.first_name,
    last_name: testUser.last_name,
  });

  authToken = response.token;
  userId = response.user.id;

  log('✅ User registration successful', { userId, email: testUser.email });
}

async function testUserLogin() {
  log('🔐 Testing user login...');

  const response = await makeRequest('POST', `${API_BASE_URL}/api/users/login`, {
    email: testUser.email,
    password: testUser.password,
  });

  authToken = response.token;

  log('✅ User login successful');
}

async function testConversationFlow() {
  log('💬 Testing conversation flow...');

  // Connect to conversation service via WebSocket
  const io = require('socket.io-client');
  const socket = io(`${API_BASE_URL.replace('http', 'ws')}`, {
    auth: { token: authToken },
    transports: ['websocket'],
  });

  return new Promise((resolve, reject) => {
    let messageCount = 0;
    let responsesSent = 0;

    socket.on('connect', () => {
      log('✅ Connected to conversation service');
      conversationId = socket.id;
    });

    socket.on('session:joined', (data) => {
      log('✅ Session joined', data);
      conversationId = data.sessionId;
    });

    socket.on('session:history', (data) => {
      log(`📜 Received session history with ${data.messages.length} messages`);
    });

    socket.on('message:received', async (data) => {
      const message = data.message;
      messageCount++;

      if (message.type === 'question') {
        log(`❓ Received question: ${message.question?.substring(0, 50)}...`);

        // Send response if we have predefined answers
        if (responsesSent < dialogueResponses.length) {
          const response = dialogueResponses[responsesSent];

          setTimeout(() => {
            socket.emit('message:send', { content: response });
            responsesSent++;
            log(`📤 Sent response: ${response}`);
          }, 1000); // Small delay to simulate typing
        } else {
          log('✅ All dialogue responses sent');
          setTimeout(() => {
            socket.disconnect();
            resolve();
          }, 2000); // Wait for completion
        }
      } else if (message.type === 'info_card') {
        log(`📋 Received info card: ${message.title}`);

        // Auto-continue for profile_snapshot
        if (message.title === 'Ваш профиль') {
          setTimeout(() => {
            socket.emit('message:send', { content: 'Продолжить' });
            log('📤 Sent continue command');
          }, 1000);
        }
      } else if (message.type === 'command') {
        log(`🎛️ Received command: ${JSON.stringify(message.commands)}`);
      } else {
        log(`💬 Received message: ${message.content?.substring(0, 50)}...`);
      }
    });

    socket.on('error', (error) => {
      log('❌ Socket error:', error);
      reject(error);
    });

    socket.on('disconnect', () => {
      log('🔌 Disconnected from conversation service');
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      socket.disconnect();
      reject(new Error('Conversation test timeout'));
    }, 120000);
  });
}

async function testJobMatching() {
  log('🔍 Testing job matching...');

  // Wait a bit for job matching to complete
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const response = await makeRequest('GET', `${API_BASE_URL}/api/jobs/match/${userId}`, null, true);

  log('✅ Job matching completed', {
    jobsCount: response.jobs?.length || 0,
    sampleJob: response.jobs?.[0]
      ? {
          title: response.jobs[0].job.title,
          score: response.jobs[0].score,
        }
      : null,
  });

  return response.jobs || [];
}

async function testEmailNotification(jobs) {
  log('📧 Testing email notification...');

  if (jobs.length === 0) {
    log('⚠️ No jobs found, skipping email test');
    return;
  }

  // Get top 3 jobs
  const jobIds = jobs.slice(0, 3).map((match) => match.job.id);

  const response = await makeRequest(
    'POST',
    `${API_BASE_URL}/api/email/send-jobs`,
    {
      userId,
      jobIds,
    },
    true
  );

  log('✅ Email notification sent');
}

async function checkConversations() {
  log('📋 Checking user conversations...');

  const response = await makeRequest('GET', `${API_BASE_URL}/api/conversations`, null, true);

  log('✅ Conversations retrieved', {
    conversationsCount: response.conversations?.length || 0,
  });
}

async function runE2ETest() {
  try {
    log('🎯 Starting Jack AI MVP E2E Test');

    // Test user registration
    await testUserRegistration();

    // Test user login
    await testUserLogin();

    // Test conversation flow
    await testConversationFlow();

    // Test job matching
    const jobs = await testJobMatching();

    // Test email notification
    await testEmailNotification(jobs);

    // Check conversations
    await checkConversations();

    log('🎉 E2E Test completed successfully!');
  } catch (error) {
    log('💥 E2E Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runE2ETest();
}

module.exports = { runE2ETest };
