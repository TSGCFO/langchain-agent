/**
 * Message types for inter-agent communication
 */
export enum MessageType {
  TASK_REQUEST = 'TASK_REQUEST',
  TASK_RESPONSE = 'TASK_RESPONSE',
  RAG_REQUEST = 'RAG_REQUEST',
  RAG_RESPONSE = 'RAG_RESPONSE',
  TOOL_REQUEST = 'TOOL_REQUEST',
  TOOL_RESPONSE = 'TOOL_RESPONSE',
  OVERSIGHT_CHECK = 'OVERSIGHT_CHECK',
  LEARNING_UPDATE = 'LEARNING_UPDATE',
  SYSTEM_EVENT = 'SYSTEM_EVENT'
}

/**
 * Priority levels for messages
 */
export enum Priority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Metadata attached to each message
 */
export interface MessageMetadata {
  timestamp: number;
  sender: string;
  correlationId: string;
  priority: Priority;
  ttl?: number;
}

/**
 * Core message structure
 */
export interface Message {
  id: string;
  type: MessageType;
  payload: any;
  metadata: MessageMetadata;
}

/**
 * Message handler function type
 */
export type MessageHandler = (message: Message) => Promise<void>;

/**
 * Redis configuration interface
 */
export interface RedisConfig {
  url: string;
  prefix?: string;
  ttl?: number;
}

/**
 * Message bus events
 */
export enum MessageBusEvent {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  MESSAGE = 'message'
}

/**
 * Message bus configuration
 */
export interface MessageBusConfig {
  redis: RedisConfig;
  defaultTTL?: number;
  retryAttempts?: number;
  retryDelay?: number;
}