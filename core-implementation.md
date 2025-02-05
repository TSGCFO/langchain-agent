# Core Implementation Details

## 1. Message Bus (Priority: High)

The message bus is the backbone of our multi-agent system, enabling communication and coordination between agents.

```typescript
// src/core/bus/types.ts
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

export enum Priority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3
}

export interface MessageMetadata {
  timestamp: number;
  sender: string;
  correlationId: string;
  priority: Priority;
  ttl?: number;
}

export interface Message {
  id: string;
  type: MessageType;
  payload: any;
  metadata: MessageMetadata;
}
```

```typescript
// src/core/bus/MessageBus.ts
import { Redis } from 'ioredis';
import { Message, MessageType } from './types';

export class MessageBus {
  private redis: Redis;
  private subscribers: Map<MessageType, Set<(message: Message) => Promise<void>>>;

  constructor(redisConfig: RedisConfig) {
    this.redis = new Redis(redisConfig);
    this.subscribers = new Map();
  }

  async publish(message: Message): Promise<void> {
    await this.redis.publish(message.type, JSON.stringify(message));
    await this.redis.set(
      `message:${message.id}`,
      JSON.stringify(message),
      'EX',
      message.metadata.ttl || 86400
    );
  }

  subscribe(type: MessageType, handler: (message: Message) => Promise<void>): void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type)!.add(handler);
  }

  async start(): Promise<void> {
    const subscriber = this.redis.duplicate();
    
    await subscriber.subscribe(...Object.values(MessageType));
    
    subscriber.on('message', async (channel, message) => {
      const parsedMessage = JSON.parse(message) as Message;
      const handlers = this.subscribers.get(channel as MessageType);
      
      if (handlers) {
        await Promise.all(
          Array.from(handlers).map(handler => handler(parsedMessage))
        );
      }
    });
  }
}
```

## 2. Agent Base Class (Priority: High)

The base agent class provides common functionality for all specialized agents.

```typescript
// src/agents/base/BaseAgent.ts
import { Message, MessageBus, ToolRegistry, MemoryManager } from '../core';

export abstract class BaseAgent {
  protected id: string;
  protected messageBus: MessageBus;
  protected tools: ToolRegistry;
  protected memory: MemoryManager;
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.id = config.id;
    this.messageBus = config.messageBus;
    this.tools = config.tools;
    this.memory = config.memory;
    this.config = config;
  }

  abstract async processMessage(message: Message): Promise<void>;

  protected async sendMessage(message: Partial<Message>): Promise<void> {
    const fullMessage: Message = {
      id: crypto.randomUUID(),
      metadata: {
        timestamp: Date.now(),
        sender: this.id,
        correlationId: message.metadata?.correlationId || crypto.randomUUID(),
        priority: message.metadata?.priority || Priority.MEDIUM
      },
      ...message
    };

    await this.messageBus.publish(fullMessage);
  }

  protected async storeMemory(key: string, value: any): Promise<void> {
    await this.memory.store(this.id, key, value);
  }

  protected async retrieveMemory(key: string): Promise<any> {
    return await this.memory.retrieve(this.id, key);
  }

  async initialize(): Promise<void> {
    // Subscribe to relevant message types
    for (const type of this.config.messageTypes) {
      this.messageBus.subscribe(type, this.processMessage.bind(this));
    }
  }

  protected async executeTool(name: string, params: any): Promise<any> {
    return await this.tools.executeTool(name, params);
  }
}
```

## 3. Memory Management (Priority: High)

The memory system provides both short-term and long-term storage for agents.

```typescript
// src/core/memory/MemoryManager.ts
import { Redis } from 'ioredis';
import { VectorStore } from './VectorStore';

export class MemoryManager {
  private redis: Redis;
  private vectorStore: VectorStore;

  constructor(redisConfig: RedisConfig, vectorStore: VectorStore) {
    this.redis = new Redis(redisConfig);
    this.vectorStore = vectorStore;
  }

  async store(agentId: string, key: string, value: any, longTerm: boolean = false): Promise<void> {
    // Store in short-term memory (Redis)
    await this.redis.set(
      `memory:${agentId}:${key}`,
      JSON.stringify(value),
      'EX',
      86400 // 24 hours
    );

    if (longTerm) {
      // Store in long-term memory (Vector Store)
      await this.vectorStore.store({
        id: `${agentId}:${key}`,
        content: value,
        metadata: {
          agentId,
          key,
          timestamp: Date.now()
        }
      });
    }
  }

  async retrieve(agentId: string, key: string): Promise<any> {
    // Try short-term memory first
    const shortTerm = await this.redis.get(`memory:${agentId}:${key}`);
    if (shortTerm) {
      return JSON.parse(shortTerm);
    }

    // Fall back to long-term memory
    const results = await this.vectorStore.query({
      filter: {
        agentId,
        key
      },
      limit: 1
    });

    return results[0]?.content || null;
  }

  async search(query: string, filter?: any): Promise<any[]> {
    return await this.vectorStore.semanticSearch(query, filter);
  }
}
```

## 4. Tool Registry (Priority: High)

The tool registry manages available tools and their execution.

```typescript
// src/core/tools/ToolRegistry.ts
export interface Tool {
  name: string;
  description: string;
  category: string;
  parameters: Record<string, any>;
  execute: (params: any) => Promise<any>;
}

export class ToolRegistry {
  private tools: Map<string, Tool>;

  constructor() {
    this.tools = new Map();
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  async executeTool(name: string, params: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      return await tool.execute(params);
    } catch (error) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }

  listTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  findToolsByCategory(category: string): Tool[] {
    return this.listTools().filter(tool => tool.category === category);
  }
}
```

These core components form the foundation of our multi-agent system. Implementation should proceed in this order:

1. Message Bus
2. Base Agent
3. Memory Management
4. Tool Registry

After these components are implemented and tested, we can proceed with building specialized agents and advanced features.

## Next Steps

1. Set up Redis for message bus and short-term memory
2. Configure vector store for long-term memory
3. Implement basic tools
4. Create first specialized agent

## Testing Strategy

Each component should have:
- Unit tests for core functionality
- Integration tests for component interaction
- Performance tests for scalability
- Error handling tests