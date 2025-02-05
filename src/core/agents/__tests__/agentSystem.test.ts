import { createAgentSystem } from '../index';
import { MessageBus } from '../../bus/MessageBus';
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseRetriever } from "@langchain/core/retrievers";
import { DynamicStructuredTool } from "@langchain/core/tools";

// Mock dependencies
jest.mock('../../bus/MessageBus');
jest.mock('@langchain/anthropic');

// Mock retriever
class MockRetriever extends BaseRetriever {
  lc_namespace = ['test', 'mock'];
  async _getRelevantDocuments(): Promise<any[]> {
    return [];
  }
}

describe('Agent System', () => {
  let messageBus: jest.Mocked<MessageBus>;
  let mockModel: jest.Mocked<ChatAnthropic>;
  let mockTools: DynamicStructuredTool[];
  let mockRetriever: MockRetriever;

  beforeEach(() => {
    messageBus = new MessageBus({ redis: { url: 'mock' } }) as jest.Mocked<MessageBus>;
    mockModel = new ChatAnthropic({}) as jest.Mocked<ChatAnthropic>;
    mockTools = [
      {
        name: 'test_tool',
        description: 'Test tool',
        invoke: jest.fn().mockResolvedValue('Tool result')
      }
    ] as unknown as DynamicStructuredTool[];
    mockRetriever = new MockRetriever();

    // Mock model response
    (mockModel.invoke as jest.Mock).mockResolvedValue('Mocked response');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create system with default configuration', async () => {
      const system = await createAgentSystem();
      expect(system.registry).toBeDefined();
      expect(system.messageBus).toBeDefined();
      expect(system.model).toBeDefined();
      await system.shutdown();
    });

    it('should create system with custom configuration', async () => {
      const system = await createAgentSystem({
        messageBus,
        model: mockModel,
        tools: mockTools,
        retriever: mockRetriever
      });

      expect(system.messageBus).toBe(messageBus);
      expect(system.model).toBe(mockModel);
      await system.shutdown();
    });

    it('should create both task and RAG agents when retriever is provided', async () => {
      const system = await createAgentSystem({
        messageBus,
        model: mockModel,
        tools: mockTools,
        retriever: mockRetriever
      });

      const taskAgent = await system.registry.getAgentForTask('test task');
      const ragAgent = await system.registry.getAgentForQuery('test query');

      expect(taskAgent).toBeDefined();
      expect(ragAgent).toBeDefined();
      await system.shutdown();
    });

    it('should create only task agent when no retriever is provided', async () => {
      const system = await createAgentSystem({
        messageBus,
        model: mockModel,
        tools: mockTools
      });

      const taskAgent = await system.registry.getAgentForTask('test task');
      await expect(system.registry.getAgentForQuery('test query'))
        .rejects.toThrow('No RAG agents available');

      expect(taskAgent).toBeDefined();
      await system.shutdown();
    });
  });

  describe('task execution', () => {
    it('should execute tasks successfully', async () => {
      const system = await createAgentSystem({
        messageBus,
        model: mockModel,
        tools: mockTools
      });

      const result = await system.executeTask('test task');
      expect(result).toBeDefined();
      await system.shutdown();
    });

    it('should handle task execution errors', async () => {
      const system = await createAgentSystem({
        messageBus,
        model: mockModel,
        tools: mockTools
      });

      (mockModel.invoke as jest.Mock).mockRejectedValue(new Error('Task execution failed'));

      await expect(system.executeTask('test task')).rejects.toThrow();
      await system.shutdown();
    });
  });

  describe('knowledge queries', () => {
    it('should handle queries when RAG agent is available', async () => {
      const system = await createAgentSystem({
        messageBus,
        model: mockModel,
        tools: mockTools,
        retriever: mockRetriever
      });

      const result = await system.query('test query');
      expect(result).toBeDefined();
      await system.shutdown();
    });

    it('should handle queries with context', async () => {
      const system = await createAgentSystem({
        messageBus,
        model: mockModel,
        tools: mockTools,
        retriever: mockRetriever
      });

      const result = await system.query('test query', 'test context');
      expect(result).toBeDefined();
      await system.shutdown();
    });

    it('should fail queries when no RAG agent is available', async () => {
      const system = await createAgentSystem({
        messageBus,
        model: mockModel,
        tools: mockTools
      });

      await expect(system.query('test query')).rejects.toThrow('No RAG agents available');
      await system.shutdown();
    });
  });

  describe('agent management', () => {
    it('should allow registering custom agents', async () => {
      const system = await createAgentSystem({
        messageBus,
        model: mockModel
      });

      const customAgent = await system.registry.getAgentForTask('test task');
      await system.registerAgent(customAgent);

      expect(system.registry.getAgent(customAgent.getInfo().id!)).toBeDefined();
      await system.shutdown();
    });

    it('should allow unregistering agents', async () => {
      const system = await createAgentSystem({
        messageBus,
        model: mockModel
      });

      const agent = await system.registry.getAgentForTask('test task');
      const agentId = agent.getInfo().id!;
      
      await system.unregisterAgent(agentId);
      expect(system.registry.getAgent(agentId)).toBeUndefined();
      await system.shutdown();
    });
  });

  describe('shutdown', () => {
    it('should shutdown all components', async () => {
      const system = await createAgentSystem({
        messageBus,
        model: mockModel,
        tools: mockTools,
        retriever: mockRetriever
      });

      await system.shutdown();
      expect(messageBus.shutdown).toHaveBeenCalled();
    });

    it('should handle multiple shutdown calls gracefully', async () => {
      const system = await createAgentSystem({
        messageBus,
        model: mockModel
      });

      await system.shutdown();
      await system.shutdown(); // Should not throw
      expect(messageBus.shutdown).toHaveBeenCalledTimes(1);
    });
  });
});