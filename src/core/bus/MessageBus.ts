import { EventEmitter } from 'events';
import { Message, MessageType, Priority } from './types';

interface MessageBusConfig {
  redis?: {
    url: string;
  };
}

export class MessageBus {
  private eventEmitter: EventEmitter;
  private initialized: boolean = false;

  constructor(_config: MessageBusConfig) {
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(100); // Allow more listeners
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
    this.eventEmitter.emit(message.type, message);
  }

  subscribe(type: MessageType, handler: (message: Message) => void): void {
    if (!this.initialized) {
      throw new Error('MessageBus not initialized');
    }

    this.eventEmitter.on(type, handler);
  }

  unsubscribe(type: MessageType, handler: (message: Message) => void): void {
    if (!this.initialized) {
      throw new Error('MessageBus not initialized');
    }

    this.eventEmitter.off(type, handler);
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.eventEmitter.removeAllListeners();
    this.initialized = false;
  }
}