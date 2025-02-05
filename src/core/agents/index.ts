export { BaseAgent, AgentConfig, AgentError } from './BaseAgent';
export { RAGAgent, RAGAgentConfig } from './RAGAgent';
export { TaskAgent, TaskAgentConfig } from './TaskAgent';
export { AgentRegistry, AgentRegistryConfig, AgentRegistryError } from './AgentRegistry';

import { BaseAgent } from './BaseAgent';
import { RAGAgent } from './RAGAgent';
import { TaskAgent } from './TaskAgent';
import { AgentRegistry } from './AgentRegistry';
import { MessageBus } from '../bus/MessageBus';
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseRetriever } from "@langchain/core/retrievers";
import { DynamicStructuredTool } from "@langchain/core/tools";

/**
 * Create a new agent system with the specified configuration
 */
export interface AgentSystemConfig {
  messageBus?: MessageBus;
  model?: ChatAnthropic;
  tools?: DynamicStructuredTool[];
  retriever?: BaseRetriever;
  maxSubtasks?: number;
}

export async function createAgentSystem(config: AgentSystemConfig = {}) {
  // Create message bus if not provided
  const messageBus = config.messageBus || new MessageBus({
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    }
  });

  // Create agent registry
  const registry = new AgentRegistry({ messageBus });
  await registry.initialize();

  // Create default model if not provided
  const model = config.model || new ChatAnthropic({
    modelName: "claude-3-opus-20240229",
    temperature: 0
  });

  // Create and register task agent
  const taskAgent = new TaskAgent({
    name: 'Primary Task Agent',
    description: 'Handles task decomposition and execution',
    tools: config.tools || [],
    messageBus,
    model,
    maxSubtasks: config.maxSubtasks
  });
  await registry.registerAgent(taskAgent);

  // Create and register RAG agent if retriever is provided
  if (config.retriever) {
    const ragAgent = new RAGAgent({
      name: 'Primary RAG Agent',
      description: 'Handles knowledge retrieval and generation',
      tools: config.tools || [],
      messageBus,
      model,
      retriever: config.retriever
    });
    await registry.registerAgent(ragAgent);
  }

  return {
    registry,
    messageBus,
    model,
    
    /**
     * Execute a task using the task agent
     */
    async executeTask(task: string) {
      const agent = await registry.getAgentForTask(task);
      return await (agent as TaskAgent).executeTask(task);
    },

    /**
     * Query knowledge using the RAG agent
     */
    async query(query: string, context?: string) {
      const agent = await registry.getAgentForQuery(query);
      return await agent.query(query, context);
    },

    /**
     * Register a new agent
     */
    async registerAgent(agent: BaseAgent) {
      await registry.registerAgent(agent);
    },

    /**
     * Unregister an agent
     */
    async unregisterAgent(agentId: string) {
      await registry.unregisterAgent(agentId);
    },

    /**
     * Shutdown the agent system
     */
    async shutdown() {
      await registry.shutdown();
    }
  };
}