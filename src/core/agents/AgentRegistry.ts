import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseAgent } from './BaseAgent';
import { Message, MessageType, Priority } from '../bus/types';
import { MessageBus } from '../bus/MessageBus';

interface SystemEventPayload {
  event: string;
  agentId: string;
  [key: string]: any;
}

export class AgentRegistry extends EventEmitter {
  private agents: Map<string, BaseAgent>;
  private messageBus: MessageBus;

  constructor(messageBus: MessageBus) {
    super();
    this.agents = new Map();
    this.messageBus = messageBus;

    // Subscribe to system events
    this.messageBus.subscribe(MessageType.SYSTEM_EVENT, this.handleSystemEvent.bind(this));
  }

  /**
   * Register a new agent
   */
  async registerAgent(agent: BaseAgent): Promise<void> {
    const info = agent.getInfo();
    if (!info.id) {
      throw new Error('Agent must have an ID');
    }

    this.agents.set(info.id, agent);

    // Announce agent registration
    await this.messageBus.publish({
      id: uuidv4(),
      type: MessageType.SYSTEM_EVENT,
      payload: {
        event: 'agent_registered',
        agentId: info.id,
        agentName: info.name,
        agentDescription: info.description,
        capabilities: info.tools.map(tool => ({
          name: tool.name,
          description: tool.description
        }))
      },
      metadata: {
        timestamp: Date.now(),
        sender: 'agent_registry',
        correlationId: uuidv4(),
        priority: Priority.MEDIUM
      }
    });
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return;
    }

    await agent.shutdown();
    this.agents.delete(agentId);

    // Announce agent unregistration
    await this.messageBus.publish({
      id: uuidv4(),
      type: MessageType.SYSTEM_EVENT,
      payload: {
        event: 'agent_unregistered',
        agentId,
        agentName: agent.getInfo().name
      },
      metadata: {
        timestamp: Date.now(),
        sender: 'agent_registry',
        correlationId: uuidv4(),
        priority: Priority.MEDIUM
      }
    });
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
   * Handle system events
   */
  private async handleSystemEvent(message: Message): Promise<void> {
    if (message.type !== MessageType.SYSTEM_EVENT) {
      return;
    }

    const payload = message.payload as SystemEventPayload;

    switch (payload.event) {
      case 'agent_error':
        // Log agent errors
        console.error(`Agent ${payload.agentId} error:`, payload.error);
        break;

      case 'agent_shutdown':
        // Remove agent on shutdown
        if (payload.agentId) {
          await this.unregisterAgent(payload.agentId);
        }
        break;

      default:
        // Emit other events for external handlers
        this.emit(payload.event, payload);
    }
  }

  /**
   * Shutdown all agents
   */
  async shutdown(): Promise<void> {
    // Unsubscribe from system events
    this.messageBus.unsubscribe(MessageType.SYSTEM_EVENT, this.handleSystemEvent.bind(this));

    // Shutdown all agents
    const shutdowns = Array.from(this.agents.keys()).map(id => this.unregisterAgent(id));
    await Promise.all(shutdowns);

    // Announce registry shutdown
    await this.messageBus.publish({
      id: uuidv4(),
      type: MessageType.SYSTEM_EVENT,
      payload: {
        event: 'registry_shutdown',
        agentCount: this.agents.size
      },
      metadata: {
        timestamp: Date.now(),
        sender: 'agent_registry',
        correlationId: uuidv4(),
        priority: Priority.HIGH
      }
    });
  }
}