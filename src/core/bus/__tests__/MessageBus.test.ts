import { MessageBus } from '../MessageBus';
import { Message, MessageType, Priority } from '../types';
import Redis from 'ioredis-mock';

// Mock ioredis
jest.mock('ioredis', () => require('ioredis-mock'));

describe('MessageBus', () => {
  let messageBus: MessageBus;
  const config = {
    redis: {
      url: 'redis://localhost:6379',
    },
    defaultTTL: 3600,
  };

  beforeEach(async () => {
    messageBus = new MessageBus(config);
    await messageBus.initialize();
  });

  afterEach(async () => {
    await messageBus.shutdown();
  });

  it('should successfully initialize', () => {
    expect(messageBus.isReady()).toBe(true);
  });

  it('should publish and receive messages', (done) => {
    const testMessage = {
      type: MessageType.TASK_REQUEST,
      payload: { task: 'test task' },
    };

    messageBus.subscribe(MessageType.TASK_REQUEST, async (message: Message) => {
      try {
        expect(message.type).toBe(testMessage.type);
        expect(message.payload).toEqual(testMessage.payload);
        expect(message.metadata.priority).toBe(Priority.MEDIUM);
        done();
      } catch (error) {
        done(error);
      }
    });

    messageBus.publish(testMessage);
  });

  it('should store messages with TTL', async () => {
    const testMessage = {
      type: MessageType.TASK_REQUEST,
      payload: { task: 'test task' },
      metadata: {
        ttl: 100,
      },
    };

    await messageBus.publish(testMessage);
    
    // Get the message ID from the stored message
    const storedMessages = await (messageBus as any).redis.keys('message:*');
    expect(storedMessages.length).toBe(1);
    
    const messageId = storedMessages[0].split(':')[1];
    const message = await messageBus.getMessage(messageId);
    
    expect(message).toBeTruthy();
    expect(message!.type).toBe(testMessage.type);
    expect(message!.payload).toEqual(testMessage.payload);
  });

  it('should handle multiple subscribers', (done) => {
    let count = 0;
    const testMessage = {
      type: MessageType.TASK_REQUEST,
      payload: { task: 'test task' },
    };

    const handler1 = async () => {
      count++;
      if (count === 2) done();
    };

    const handler2 = async () => {
      count++;
      if (count === 2) done();
    };

    messageBus.subscribe(MessageType.TASK_REQUEST, handler1);
    messageBus.subscribe(MessageType.TASK_REQUEST, handler2);

    messageBus.publish(testMessage);
  });

  it('should unsubscribe handlers', async () => {
    const handler = jest.fn().mockImplementation(async () => {});
    const testMessage = {
      type: MessageType.TASK_REQUEST,
      payload: { task: 'test task' },
    };

    messageBus.subscribe(MessageType.TASK_REQUEST, handler);
    messageBus.unsubscribe(MessageType.TASK_REQUEST, handler);

    await messageBus.publish(testMessage);
    
    // Wait for any async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(handler).not.toHaveBeenCalled();
  });

  it('should emit error events', (done) => {
    const errorHandler = jest.fn();
    messageBus.on('error', errorHandler);

    // Force an error by passing invalid JSON
    (messageBus as any).subscriber.emit('message', MessageType.TASK_REQUEST, 'invalid json');

    setTimeout(() => {
      expect(errorHandler).toHaveBeenCalled();
      done();
    }, 100);
  });

  it('should handle shutdown gracefully', async () => {
    await messageBus.shutdown();
    expect(messageBus.isReady()).toBe(false);
  });
});