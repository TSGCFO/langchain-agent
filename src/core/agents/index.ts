import { BaseRetriever } from "@langchain/core/retrievers";
import { ChatAnthropic } from "@langchain/anthropic";
import { AgentRegistry } from "./AgentRegistry";
import { TaskAgent } from "./TaskAgent";
import { RAGAgent } from "./RAGAgent";
import { MessageBus } from "../bus/MessageBus";
import { DynamicStructuredTool } from "@langchain/core/tools";

export interface AgentSystemConfig {
  model: ChatAnthropic;
  retriever: BaseRetriever;
  messageBus: MessageBus;
  tools?: DynamicStructuredTool[];
}

export interface AgentSystem {
  executeTask: (task: string) => Promise<any>;
  query: (query: string, context?: string) => Promise<string>;
  shutdown: () => Promise<void>;
}

/**
 * Create a new agent system
 */
export async function createAgentSystem(config: AgentSystemConfig): Promise<AgentSystem> {
  const tools = config.tools || [];
  const registry = new AgentRegistry(config.messageBus);

  // Create task agent
  const taskAgent = new TaskAgent({
    name: 'Task Agent',
    description: 'Handles task decomposition and execution',
    tools,
    messageBus: config.messageBus,
    model: config.model
  });

  // Create RAG agent
  const ragAgent = new RAGAgent({
    name: 'RAG Agent',
    description: 'Handles knowledge retrieval and generation',
    tools,
    messageBus: config.messageBus,
    model: config.model,
    retriever: config.retriever
  });

  // Register agents
  await registry.registerAgent(taskAgent);
  await registry.registerAgent(ragAgent);

  return {
    /**
     * Execute a task using the task agent
     */
    executeTask: async (task: string) => {
      return await taskAgent.executeTask(task);
    },

    /**
     * Query the knowledge base using the RAG agent
     */
    query: async (query: string, context?: string) => {
      return await ragAgent.query(query, context);
    },

    /**
     * Shutdown the agent system
     */
    shutdown: async () => {
      await registry.shutdown();
    }
  };
}