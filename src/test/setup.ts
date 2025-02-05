import { config } from 'dotenv';
import { MessageBus } from '../core/bus/MessageBus';
import { ChatAnthropic } from "@langchain/anthropic";

// Load environment variables from .env.test if it exists, otherwise from .env
config({ path: '.env.test' });
config();

// Set default environment variables for testing
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.OPENAI_API_KEY = 'test-openai-key';

// Mock Redis
jest.mock('ioredis', () => {
  const RedisMock = require('ioredis-mock');
  return RedisMock;
});

// Mock MessageBus
jest.mock('../core/bus/MessageBus', () => {
  return {
    MessageBus: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

// Mock Anthropic
jest.mock('@langchain/anthropic', () => {
  return {
    ChatAnthropic: jest.fn().mockImplementation(() => ({
      invoke: jest.fn().mockResolvedValue('Mocked response'),
      stream: jest.fn().mockResolvedValue('Mocked stream response'),
      _streamIterator: jest.fn().mockResolvedValue(['Mocked', 'stream', 'response'])
    }))
  };
});

// Mock OpenAI
jest.mock('@langchain/openai', () => {
  return {
    OpenAIEmbeddings: jest.fn().mockImplementation(() => ({
      embedQuery: jest.fn().mockResolvedValue(new Array(1536).fill(0)),
      embedDocuments: jest.fn().mockResolvedValue([new Array(1536).fill(0)])
    }))
  };
});

// Global test setup
beforeAll(() => {
  // Clear all mocks before each test suite
  jest.clearAllMocks();
});

beforeEach(() => {
  // Reset all mocks before each test
  jest.resetAllMocks();
});

afterEach(() => {
  // Clean up any resources after each test
});

afterAll(() => {
  // Clean up any resources after all tests
});

// Global test utilities
global.testUtils = {
  createMockMessage: (type: string, payload: any) => ({
    id: 'test-message-id',
    type,
    payload,
    metadata: {
      timestamp: Date.now(),
      sender: 'test',
      correlationId: 'test-correlation-id',
      priority: 1
    }
  }),

  createMockAgent: (config: any) => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    processMessage: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    getInfo: jest.fn().mockReturnValue({
      id: 'test-agent-id',
      name: 'Test Agent',
      description: 'Test agent for testing',
      ...config
    })
  }),

  waitForAsync: async (ms: number = 0) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Add custom matchers
expect.extend({
  toBeValidMessage(received) {
    const hasValidStructure = 
      received &&
      typeof received.id === 'string' &&
      typeof received.type === 'string' &&
      received.metadata &&
      typeof received.metadata.timestamp === 'number' &&
      typeof received.metadata.sender === 'string' &&
      typeof received.metadata.correlationId === 'string';

    return {
      message: () => `expected ${received} to be a valid message`,
      pass: hasValidStructure
    };
  }
});

// Type declarations
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidMessage(): R;
    }
  }

  var testUtils: {
    createMockMessage: (type: string, payload: any) => any;
    createMockAgent: (config: any) => any;
    waitForAsync: (ms?: number) => Promise<void>;
  };
}