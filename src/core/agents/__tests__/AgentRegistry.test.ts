import { AgentRegistry, AgentRegistryError } from '../AgentRegistry';
import { MessageBus } from '../../bus/MessageBus';
import { BaseAgent } from '../BaseAgent';
import { RAGAgent } from '../RAGAgent';
import { TaskAgent } from '../TaskAgent';
import { Message, MessageType, Priority } from '../../bus/types';
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseRetriever } from "@langchain/core/retrievers";

// Mock dependencies
jest.mock('../../bus/MessageBus');
jest.mock('@langchain/anthropic');

// Mock retriever for RAG agent
class MockRetriever extends BaseRetriever {
  lc_namespace = ['test', 'mock'];
  async _getRelevantDocuments(): Promise<any[]> {
    return [];
  }
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  let messageBus: jest.Mocked<MessageBus>;
  let mockModel: jest.Mocked<ChatAnthropic>;

  beforeEach(() => {
    messageBus = new MessageBus({ redis: { url: 'mock' } }) as jest.Mocked<MessageBus>;
    mockModel = new ChatAnthropic({}) as jest.Mocked<ChatAnthropic>;
    registry = new AgentRegistry({ messageBus });
  });

  afterEach(async () => {
    await registry.shutdown();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await registry.initialize();

      expect(messageBus.initialize).toHaveBeenCalled();
      expect(messageBus.subscribe).toHaveBeenCalledWith(
        MessageType.SYSTEM_EVENT,
        expect.any(Function)
      );
    });

    it('should prevent double initialization', async () => {
      await registry.initialize();
      await expect(registry.initialize()).rejects.toThrow(AgentRegistryError);
    });
  });

  describe('agent registration', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should register agents successfully', async () => {
      const taskAgent = new TaskAgent({
        id: 'test-task-agent',
        name: 'Test Task Agent',
        description: 'Test agent',
        tools: [],
        messageBus,
        model: mockModel
      });

      await registry.registerAgent(taskAgent);
      
      const agentInfo = taskAgent.getInfo();
      expect(agentInfo.id).toBeDefined();
      const registeredAgent = registry.getAgent(agentInfo.id!);
      expect(registeredAgent).toBe(taskAgent);
    });

    it('should prevent duplicate agent registration', async () => {
      const taskAgent = new TaskAgent({
        id: 'test-task-agent',
        name: 'Test Task Agent',
        description: 'Test agent',
        tools: [],
        messageBus,
        model: mockModel
      });

      await registry.registerAgent(taskAgent);
      await expect(registry.registerAgent(taskAgent)).rejects.toThrow(AgentRegistryError);
    });

    it('should register multiple types of agents', async () => {
      const taskAgent = new TaskAgent({
        id: 'test-task-agent',
        name: 'Test Task Agent',
        description: 'Test task agent',
        tools: [],
        messageBus,
        model: mockModel
      });

      const ragAgent = new RAGAgent({
        id: 'test-rag-agent',
        name: 'Test RAG Agent',
        description: 'Test RAG agent',
        tools: [],
        messageBus,
        model: mockModel,
        retriever: new MockRetriever()
      });

      await registry.registerAgent(taskAgent);
      await registry.registerAgent(ragAgent);

      const taskAgents = registry.getAgentsByType(TaskAgent);
      const ragAgents = registry.getAgentsByType(RAGAgent);

      expect(taskAgents).toHaveLength(1);
      expect(ragAgents).toHaveLength(1);
    });
  });

  describe('agent unregistration', () => {
    let taskAgent: TaskAgent;

    beforeEach(async () => {
      await registry.initialize();
      taskAgent = new TaskAgent({
        id: 'test-task-agent',
        name: 'Test Task Agent',
        description: 'Test agent',
        tools: [],
        messageBus,
        model: mockModel
      });
      await registry.registerAgent(taskAgent);
    });

    it('should unregister agents successfully', async () => {
      const agentInfo = taskAgent.getInfo();
      expect(agentInfo.id).toBeDefined();
      await registry.unregisterAgent(agentInfo.id!);
      expect(registry.getAgent(agentInfo.id!)).toBeUndefined();
    });

    it('should fail to unregister non-existent agents', async () => {
      await expect(registry.unregisterAgent('non-existent-id')).rejects.toThrow(AgentRegistryError);
    });
  });

  describe('agent selection', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should select appropriate task agent', async () => {
      const taskAgent = new TaskAgent({
        id: 'test-task-agent',
        name: 'Test Task Agent',
        description: 'Test agent',
        tools: [],
        messageBus,
        model: mockModel
      });

      await registry.registerAgent(taskAgent);
      const selectedAgent = await registry.getAgentForTask('test task');
      expect(selectedAgent).toBe(taskAgent);
    });

    it('should select appropriate RAG agent', async () => {
      const ragAgent = new RAGAgent({
        id: 'test-rag-agent',
        name: 'Test RAG Agent',
        description: 'Test RAG agent',
        tools: [],
        messageBus,
        model: mockModel,
        retriever: new MockRetriever()
      });

      await registry.registerAgent(ragAgent);
      const selectedAgent = await registry.getAgentForQuery('test query');
      expect(selectedAgent).toBe(ragAgent);
    });

    it('should throw error when no appropriate agent is available', async () => {
      await expect(registry.getAgentForTask('test task')).rejects.toThrow('No task agents available');
      await expect(registry.getAgentForQuery('test query')).rejects.toThrow('No RAG agents available');
    });
  });

  describe('system events', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should handle agent error events', (done) => {
      registry.on('agent_error', (event) => {
        expect(event.agentId).toBe('test-agent');
        expect(event.error).toBe('Test error');
        done();
      });

      const messageHandler = messageBus.subscribe.mock.calls[0][1];
      messageHandler({
        type: MessageType.SYSTEM_EVENT,
        payload: {
          event: 'agent_error',
          agentId: 'test-agent',
          error: 'Test error',
          timestamp: Date.now()
        },
        metadata: {
          timestamp: Date.now(),
          sender: 'test',
          correlationId: 'test',
          priority: Priority.HIGH
        }
      } as Message);
    });

    it('should handle agent lifecycle events', async () => {
      const lifecycleEvents: string[] = [];
      
      registry.on('agent_initialized', () => lifecycleEvents.push('initialized'));
      registry.on('agent_shutdown', () => lifecycleEvents.push('shutdown'));

      const messageHandler = messageBus.subscribe.mock.calls[0][1];
      
      await messageHandler({
        type: MessageType.SYSTEM_EVENT,
        payload: {
          event: 'agent_initialized',
          agentId: 'test-agent',
          timestamp: Date.now()
        },
        metadata: {
          timestamp: Date.now(),
          sender: 'test',
          correlationId: 'test',
          priority: Priority.MEDIUM
        }
      } as Message);

      await messageHandler({
        type: MessageType.SYSTEM_EVENT,
        payload: {
          event: 'agent_shutdown',
          agentId: 'test-agent',
          timestamp: Date.now()
        },
        metadata: {
          timestamp: Date.now(),
          sender: 'test',
          correlationId: 'test',
          priority: Priority.MEDIUM
        }
      } as Message);

      expect(lifecycleEvents).toEqual(['initialized', 'shutdown']);
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should shutdown all agents and clear registry', async () => {
      const taskAgent = new TaskAgent({
        id: 'test-task-agent',
        name: 'Test Task Agent',
        description: 'Test agent',
        tools: [],
        messageBus,
        model: mockModel
      });

      await registry.registerAgent(taskAgent);
      await registry.shutdown();

      expect(registry.getAllAgents()).toHaveLength(0);
      expect(messageBus.shutdown).toHaveBeenCalled();
    });

    it('should handle shutdown when no agents are registered', async () => {
      await registry.shutdown();
      expect(messageBus.shutdown).toHaveBeenCalled();
    });
  });
});