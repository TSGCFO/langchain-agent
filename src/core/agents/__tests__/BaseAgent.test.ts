import { BaseAgent, AgentConfig, AgentError, AgentContext } from '../BaseAgent';
import { MessageBus } from '../../bus/MessageBus';
import { Message, MessageType, Priority } from '../../bus/types';
import { DynamicStructuredTool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";

// Mock MessageBus
jest.mock('../../bus/MessageBus');

// Create a concrete implementation of BaseAgent for testing
class TestAgent extends BaseAgent {
  public lastProcessedMessage: Message | null = null;

  protected async processMessage(message: Message): Promise<void> {
    this.lastProcessedMessage = message;
    if (message.payload?.shouldError) {
      throw new Error('Test error');
    }
  }

  // Expose protected methods for testing
  public async testSendMessage(
    type: MessageType,
    payload: any,
    priority?: Priority
  ): Promise<void> {
    return this.sendMessage(type, payload, priority);
  }

  public async testExecuteTool(name: string, args: any): Promise<any> {
    return this.executeTool(name, args);
  }

  public testAddToContext(message: HumanMessage): void {
    this.addToContext(message);
  }

  public testGetContext(): AgentContext {
    return this.context;
  }

  public async testRemember(key: string, value: any): Promise<void> {
    return this.remember(key, value);
  }

  public testRecall(key: string): any {
    return this.recall(key);
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let messageBus: jest.Mocked<MessageBus>;
  let mockTool: DynamicStructuredTool;

  beforeEach(() => {
    messageBus = new MessageBus({ redis: { url: 'mock' } }) as jest.Mocked<MessageBus>;
    mockTool = {
      name: 'test_tool',
      description: 'A test tool',
      invoke: jest.fn()
    } as unknown as DynamicStructuredTool;

    const config: AgentConfig = {
      name: 'Test Agent',
      description: 'A test agent',
      tools: [mockTool],
      messageBus,
      messageTypes: [MessageType.TASK_REQUEST]
    };

    agent = new TestAgent(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', async () => {
      await agent.initialize();
      
      expect(messageBus.subscribe).toHaveBeenCalledWith(
        MessageType.TASK_REQUEST,
        expect.any(Function)
      );

      expect(messageBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SYSTEM_EVENT,
          payload: expect.objectContaining({
            event: 'agent_initialized',
            agentName: 'Test Agent'
          })
        })
      );
    });
  });

  describe('message handling', () => {
    it('should process messages correctly', async () => {
      const message: Message = {
        id: '123',
        type: MessageType.TASK_REQUEST,
        payload: { task: 'test' },
        metadata: {
          timestamp: Date.now(),
          sender: 'test',
          correlationId: '456',
          priority: Priority.MEDIUM
        }
      };

      await agent.initialize();
      const messageHandler = messageBus.subscribe.mock.calls[0][1];
      await messageHandler(message);

      expect(agent.lastProcessedMessage).toEqual(message);
    });

    it('should handle errors during message processing', async () => {
      const message: Message = {
        id: '123',
        type: MessageType.TASK_REQUEST,
        payload: { shouldError: true },
        metadata: {
          timestamp: Date.now(),
          sender: 'test',
          correlationId: '456',
          priority: Priority.MEDIUM
        }
      };

      await agent.initialize();
      const messageHandler = messageBus.subscribe.mock.calls[0][1];
      await messageHandler(message);

      expect(messageBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SYSTEM_EVENT,
          payload: expect.objectContaining({
            event: 'agent_error',
            error: 'Test error'
          })
        })
      );
    });
  });

  describe('tool execution', () => {
    it('should execute tools correctly', async () => {
      const args = { test: 'value' };
      (mockTool.invoke as jest.Mock).mockResolvedValue('result');

      const result = await agent.testExecuteTool('test_tool', args);
      
      expect(mockTool.invoke).toHaveBeenCalledWith(args);
      expect(result).toBe('result');
    });

    it('should handle tool execution errors', async () => {
      const args = { test: 'value' };
      (mockTool.invoke as jest.Mock).mockRejectedValue(new Error('Tool error'));

      await expect(agent.testExecuteTool('test_tool', args))
        .rejects
        .toThrow(AgentError);
    });

    it('should throw error for non-existent tools', async () => {
      await expect(agent.testExecuteTool('non_existent', {}))
        .rejects
        .toThrow('Tool not found: non_existent');
    });
  });

  describe('context management', () => {
    it('should manage message context correctly', () => {
      const message = new HumanMessage('test message');
      
      // Add messages up to the limit
      for (let i = 0; i < 55; i++) {
        agent.testAddToContext(message);
      }

      // Context should be limited to 50 messages
      expect(agent.testGetContext().messages.length).toBe(50);
    });

    it('should manage memory correctly', async () => {
      await agent.testRemember('test_key', 'test_value');
      const value = agent.testRecall('test_key');
      
      expect(value).toBe('test_value');
    });
  });

  describe('shutdown', () => {
    it('should shutdown correctly', async () => {
      await agent.initialize();
      await agent.shutdown();

      expect(messageBus.unsubscribe).toHaveBeenCalled();
      expect(messageBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SYSTEM_EVENT,
          payload: expect.objectContaining({
            event: 'agent_shutdown'
          })
        })
      );
    });
  });
});