import { EventEmitter } from 'events';
import { Message, MessageType } from './types';

type MessageHandler = (message: Message) => void;

export class MessageBus {
  private eventEmitter: EventEmitter;
  private initialized: boolean = false;
  private handlers: Map<MessageType, Set<MessageHandler>>;

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(100); // Allow more listeners
    this.handlers = new Map();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('MessageBus already initialized');
    }
    this.initialized = true;
  }

  async publish(message: Message): Promise<void> {
    if (!this.initialized) {
      throw new Error('MessageBus not initialized');
    }

    // Add timestamp if not present
    if (!message.metadata?.timestamp) {
      message.metadata = {
        ...message.metadata,
        timestamp: Date.now(),
      };
    }

    // Emit the message to all subscribers
    const handlers = this.handlers.get(message.type) || new Set();
    for (const handler of handlers) {
      try {
        await handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    }
  }

  subscribe(type: MessageType, handler: MessageHandler): void {
    if (!this.initialized) {
      throw new Error('MessageBus not initialized');
    }

    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    this.handlers.get(type)!.add(handler);
  }

  unsubscribe(type: MessageType, handler: MessageHandler): void {
    if (!this.initialized) {
      throw new Error('MessageBus not initialized');
    }

    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(type);
      }
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Clear all handlers
    this.handlers.clear();
    this.initialized = false;
  }
}