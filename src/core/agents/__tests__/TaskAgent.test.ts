import { TaskAgent, TaskAgentConfig } from '../TaskAgent';
import { MessageBus } from '../../bus/MessageBus';
import { Message, MessageType, Priority } from '../../bus/types';
import { ChatAnthropic } from "@langchain/anthropic";
import { DynamicStructuredTool } from "@langchain/core/tools";

// Mock dependencies
jest.mock('../../bus/MessageBus');
jest.mock('@langchain/anthropic');

describe('TaskAgent', () => {
  let agent: TaskAgent;
  let messageBus: jest.Mocked<MessageBus>;
  let mockModel: jest.Mocked<ChatAnthropic>;
  let mockTools: DynamicStructuredTool[];

  beforeEach(() => {
    messageBus = new MessageBus({ redis: { url: 'mock' } }) as jest.Mocked<MessageBus>;
    mockModel = new ChatAnthropic({}) as jest.Mocked<ChatAnthropic>;
    
    // Create mock tools
    mockTools = [
      {
        name: 'test_tool_1',
        description: 'Test tool 1',
        invoke: jest.fn().mockResolvedValue('Tool 1 result')
      },
      {
        name: 'test_tool_2',
        description: 'Test tool 2',
        invoke: jest.fn().mockResolvedValue('Tool 2 result')
      }
    ] as unknown as DynamicStructuredTool[];

    // Mock model to return subtasks
    (mockModel.invoke as jest.Mock).mockResolvedValue({
      subtasks: [
        {
          description: 'Subtask 1',
          toolName: 'test_tool_1',
          parameters: { param1: 'value1' }
        },
        {
          description: 'Subtask 2',
          toolName: 'test_tool_2',
          parameters: { param2: 'value2' },
          dependencies: ['Subtask 1']
        }
      ]
    });

    const config: TaskAgentConfig = {
      name: 'Test Task Agent',
      description: 'A test task agent',
      tools: mockTools,
      messageBus,
      model: mockModel,
      maxSubtasks: 5
    };

    agent = new TaskAgent(config);
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
            agentName: 'Test Task Agent'
          })
        })
      );
    });
  });

  describe('task processing', () => {
    it('should process tasks and execute subtasks in order', async () => {
      const message: Message = {
        id: '123',
        type: MessageType.TASK_REQUEST,
        payload: {
          task: 'Test task'
        },
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

      // Verify task was processed
      const taskStatus = agent.getTaskStatus('123');
      expect(taskStatus?.status).toBe('completed');

      // Verify tools were executed in correct order
      const tool1 = mockTools[0];
      const tool2 = mockTools[1];
      
      expect(tool1.invoke).toHaveBeenCalledWith({ param1: 'value1' });
      expect(tool2.invoke).toHaveBeenCalledWith({ param2: 'value2' });
      
      // Tool 2 should be called after Tool 1
      const tool1CallTime = (tool1.invoke as jest.Mock).mock.invocationCallOrder[0];
      const tool2CallTime = (tool2.invoke as jest.Mock).mock.invocationCallOrder[0];
      expect(tool2CallTime).toBeGreaterThan(tool1CallTime);
    });

    it('should handle circular dependencies', async () => {
      // Mock model to return circular dependencies
      (mockModel.invoke as jest.Mock).mockResolvedValue({
        subtasks: [
          {
            description: 'Subtask 1',
            toolName: 'test_tool_1',
            dependencies: ['Subtask 2']
          },
          {
            description: 'Subtask 2',
            toolName: 'test_tool_2',
            dependencies: ['Subtask 1']
          }
        ]
      });

      const message: Message = {
        id: '123',
        type: MessageType.TASK_REQUEST,
        payload: { task: 'Test task' },
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

      // Verify error was published
      expect(messageBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SYSTEM_EVENT,
          payload: expect.objectContaining({
            event: 'agent_error',
            error: expect.stringContaining('Circular dependency')
          })
        })
      );

      // Verify task status
      const taskStatus = agent.getTaskStatus('123');
      expect(taskStatus?.status).toBe('failed');
    });

    it('should respect maxSubtasks limit', async () => {
      // Mock model to return too many subtasks
      (mockModel.invoke as jest.Mock).mockResolvedValue({
        subtasks: Array(6).fill(null).map((_, i) => ({
          description: `Subtask ${i + 1}`,
          toolName: 'test_tool_1'
        }))
      });

      const message: Message = {
        id: '123',
        type: MessageType.TASK_REQUEST,
        payload: { task: 'Test task' },
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

      // Verify error was published
      expect(messageBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SYSTEM_EVENT,
          payload: expect.objectContaining({
            event: 'agent_error',
            error: expect.stringContaining('Too many subtasks')
          })
        })
      );
    });
  });

  describe('direct task execution', () => {
    it('should execute tasks directly', async () => {
      const results = await agent.executeTask('Test direct task');
      
      expect(results).toHaveLength(2);
      expect(mockTools[0].invoke).toHaveBeenCalled();
      expect(mockTools[1].invoke).toHaveBeenCalled();
    });

    it('should handle tool execution errors', async () => {
      const error = new Error('Tool execution failed');
      (mockTools[0].invoke as jest.Mock).mockRejectedValue(error);

      await expect(agent.executeTask('Test task')).rejects.toThrow('Tool execution failed');

      const tasks = agent.getAllTasks();
      const failedTask = tasks.find(t => t.status === 'failed');
      expect(failedTask).toBeTruthy();
    });
  });

  describe('task management', () => {
    it('should maintain task history', async () => {
      await agent.executeTask('Task 1');
      await agent.executeTask('Task 2');

      const tasks = agent.getAllTasks();
      expect(tasks).toHaveLength(2);
    });

    it('should clear task history', async () => {
      await agent.executeTask('Task 1');
      agent.clearTasks();

      const tasks = agent.getAllTasks();
      expect(tasks).toHaveLength(0);
    });
  });
});