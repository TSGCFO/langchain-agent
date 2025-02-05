import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { MessageBus } from '../bus/MessageBus';
import { Message, MessageType, Priority } from '../bus/types';
import { DynamicStructuredTool } from "@langchain/core/tools";
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseMessage } from "@langchain/core/messages";

export interface AgentConfig {
  id?: string;
  name: string;
  description: string;
  tools: DynamicStructuredTool[];
  messageBus: MessageBus;
  model?: ChatAnthropic;
  messageTypes?: MessageType[];
}

export interface AgentContext {
  messages: BaseMessage[];
  memory: Map<string, any>;
}

export class AgentError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'AgentError';
  }
}

export abstract class BaseAgent extends EventEmitter {
  protected id: string;
  protected name: string;
  protected description: string;
  protected tools: DynamicStructuredTool[];
  protected messageBus: MessageBus;
  protected model: ChatAnthropic;
  protected context: AgentContext;
  protected subscriptions: MessageType[];

  constructor(config: AgentConfig) {
    super();
    this.id = config.id || uuidv4();
    this.name = config.name;
    this.description = config.description;
    this.tools = config.tools;
    this.messageBus = config.messageBus;
    this.model = config.model || new ChatAnthropic({
      modelName: "claude-3-opus-20240229",
      temperature: 0
    });
    this.subscriptions = config.messageTypes || [];
    this.context = {
      messages: [],
      memory: new Map()
    };
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    // Subscribe to message types
    for (const type of this.subscriptions) {
      this.messageBus.subscribe(type, this.handleMessage.bind(this));
    }

    // Announce agent presence
    await this.messageBus.publish({
      type: MessageType.SYSTEM_EVENT,
      payload: {
        event: 'agent_initialized',
        agentId: this.id,
        agentName: this.name,
        capabilities: this.tools.map(tool => ({
          name: tool.name,
          description: tool.description
        }))
      }
    });
  }

  /**
   * Handle incoming messages
   */
  protected async handleMessage(message: Message): Promise<void> {
    try {
      await this.processMessage(message);
    } catch (error) {
      const agentError = error instanceof Error 
        ? new AgentError(error.message, error)
        : new AgentError('Unknown error occurred');
      
      await this.handleError(agentError, message);
    }
  }

  /**
   * Process a message (to be implemented by specific agents)
   */
  protected abstract processMessage(message: Message): Promise<void>;

  /**
   * Send a message through the message bus
   */
  protected async sendMessage(
    type: MessageType,
    payload: any,
    priority: Priority = Priority.MEDIUM,
    correlationId?: string
  ): Promise<void> {
    await this.messageBus.publish({
      type,
      payload,
      metadata: {
        sender: this.id,
        correlationId: correlationId || uuidv4(),
        priority
      }
    });
  }

  /**
   * Execute a tool
   */
  protected async executeTool(name: string, args: any): Promise<any> {
    const tool = this.tools.find(t => t.name === name);
    if (!tool) {
      throw new AgentError(`Tool not found: ${name}`);
    }

    try {
      return await tool.invoke(args);
    } catch (error) {
      throw new AgentError(
        `Tool execution failed: ${name}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Store data in agent's memory
   */
  protected async remember(key: string, value: any): Promise<void> {
    this.context.memory.set(key, value);
  }

  /**
   * Retrieve data from agent's memory
   */
  protected recall(key: string): any {
    return this.context.memory.get(key);
  }

  /**
   * Add a message to the context
   */
  protected addToContext(message: BaseMessage): void {
    this.context.messages.push(message);
    // Keep context size manageable
    if (this.context.messages.length > 50) {
      this.context.messages.shift();
    }
  }

  /**
   * Handle errors
   */
  protected async handleError(error: AgentError, sourceMessage?: Message): Promise<void> {
    await this.sendMessage(
      MessageType.SYSTEM_EVENT,
      {
        event: 'agent_error',
        agentId: this.id,
        error: error.message,
        details: error.details,
        sourceMessage
      },
      Priority.HIGH
    );
  }

  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    // Unsubscribe from all message types
    for (const type of this.subscriptions) {
      this.messageBus.unsubscribe(type, this.handleMessage.bind(this));
    }

    // Announce agent shutdown
    await this.messageBus.publish({
      type: MessageType.SYSTEM_EVENT,
      payload: {
        event: 'agent_shutdown',
        agentId: this.id,
        agentName: this.name
      }
    });
  }

  /**
   * Get agent information
   */
  getInfo(): Omit<AgentConfig, 'messageBus' | 'model'> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      tools: this.tools,
      messageTypes: this.subscriptions
    };
  }
}