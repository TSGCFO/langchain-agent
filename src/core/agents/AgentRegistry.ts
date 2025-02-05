import { EventEmitter } from 'events';
import { BaseAgent } from './BaseAgent';
import { RAGAgent } from './RAGAgent';
import { TaskAgent } from './TaskAgent';
import { MessageBus } from '../bus/MessageBus';
import { Message, MessageType, Priority } from '../bus/types';

export interface AgentRegistryConfig {
  messageBus: MessageBus;
}

export class AgentRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentRegistryError';
  }
}

interface SystemEventPayload {
  event: string;
  agentId?: string;
  agentName?: string;
  error?: string;
  timestamp: number;
}

export class AgentRegistry extends EventEmitter {
  private agents: Map<string, BaseAgent>;
  private messageBus: MessageBus;
  private initialized: boolean = false;

  constructor(config: AgentRegistryConfig) {
    super();
    this.agents = new Map();
    this.messageBus = config.messageBus;
  }

  /**
   * Initialize the agent registry
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new AgentRegistryError('Agent registry already initialized');
    }

    try {
      await this.messageBus.initialize();
      this.initialized = true;

      // Subscribe to system events
      this.messageBus.subscribe(MessageType.SYSTEM_EVENT, this.handleSystemEvent.bind(this));

      await this.messageBus.publish({
        type: MessageType.SYSTEM_EVENT,
        payload: {
          event: 'registry_initialized',
          timestamp: Date.now()
        } as SystemEventPayload
      });
    } catch (error) {
      throw new AgentRegistryError(
        `Failed to initialize agent registry: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Register an agent
   */
  async registerAgent(agent: BaseAgent): Promise<void> {
    if (!this.initialized) {
      throw new AgentRegistryError('Agent registry not initialized');
    }

    const agentInfo = agent.getInfo();
    if (!agentInfo.id) {
      throw new AgentRegistryError('Agent must have an ID');
    }

    if (this.agents.has(agentInfo.id)) {
      throw new AgentRegistryError(`Agent with ID ${agentInfo.id} already registered`);
    }

    try {
      await agent.initialize();
      this.agents.set(agentInfo.id, agent);

      await this.messageBus.publish({
        type: MessageType.SYSTEM_EVENT,
        payload: {
          event: 'agent_registered',
          agentId: agentInfo.id,
          agentName: agentInfo.name,
          timestamp: Date.now()
        } as SystemEventPayload
      });
    } catch (error) {
      throw new AgentRegistryError(
        `Failed to register agent ${agentInfo.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new AgentRegistryError(`Agent with ID ${agentId} not found`);
    }

    try {
      await agent.shutdown();
      this.agents.delete(agentId);

      await this.messageBus.publish({
        type: MessageType.SYSTEM_EVENT,
        payload: {
          event: 'agent_unregistered',
          agentId,
          timestamp: Date.now()
        } as SystemEventPayload
      });
    } catch (error) {
      throw new AgentRegistryError(
        `Failed to unregister agent ${agentId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by type
   */
  getAgentsByType<T extends BaseAgent>(type: new (...args: any[]) => T): T[] {
    return Array.from(this.agents.values()).filter(
      (agent): agent is T => agent instanceof type
    );
  }

  /**
   * Handle system events
   */
  private async handleSystemEvent(message: Message): Promise<void> {
    const payload = message.payload as SystemEventPayload;
    if (!payload || !payload.event) return;

    switch (payload.event) {
      case 'agent_error':
        if (payload.agentId) {
          this.emit('agent_error', {
            agentId: payload.agentId,
            error: payload.error || 'Unknown error',
            timestamp: message.metadata.timestamp
          });
        }
        break;

      case 'agent_initialized':
      case 'agent_shutdown':
        if (payload.agentId) {
          this.emit(payload.event, {
            agentId: payload.agentId,
            timestamp: message.metadata.timestamp
          });
        }
        break;
    }
  }

  /**
   * Get the most suitable agent for a task
   */
  async getAgentForTask(task: string): Promise<BaseAgent> {
    // Get all task agents
    const taskAgents = this.getAgentsByType(TaskAgent);
    if (taskAgents.length === 0) {
      throw new AgentRegistryError('No task agents available');
    }

    // For now, just return the first task agent
    // TODO: Implement more sophisticated agent selection based on task requirements
    return taskAgents[0];
  }

  /**
   * Get the most suitable RAG agent for a query
   */
  async getAgentForQuery(query: string): Promise<RAGAgent> {
    // Get all RAG agents
    const ragAgents = this.getAgentsByType(RAGAgent);
    if (ragAgents.length === 0) {
      throw new AgentRegistryError('No RAG agents available');
    }

    // For now, just return the first RAG agent
    // TODO: Implement more sophisticated agent selection based on query requirements
    return ragAgents[0];
  }

  /**
   * Shutdown the registry and all agents
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      // Shutdown all agents
      await Promise.all(
        Array.from(this.agents.values()).map(agent => agent.shutdown())
      );

      // Clear agents
      this.agents.clear();

      // Publish shutdown event
      await this.messageBus.publish({
        type: MessageType.SYSTEM_EVENT,
        payload: {
          event: 'registry_shutdown',
          timestamp: Date.now()
        } as SystemEventPayload
      });

      // Shutdown message bus
      await this.messageBus.shutdown();

      this.initialized = false;
    } catch (error) {
      throw new AgentRegistryError(
        `Failed to shutdown agent registry: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}