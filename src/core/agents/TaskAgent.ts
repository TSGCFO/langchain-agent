import { BaseAgent, AgentConfig, AgentError } from './BaseAgent';
import { Message, MessageType, Priority } from '../bus/types';
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { generateStructuredOutput } from '../llm/anthropic';

export interface TaskAgentConfig extends AgentConfig {
  maxSubtasks?: number;
  systemPrompt?: string;
}

interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  parentId?: string;
  metadata?: Record<string, any>;
}

// Schema for subtask structure
const SubtaskSchema = z.object({
  subtasks: z.array(z.object({
    description: z.string(),
    toolName: z.string().optional(),
    parameters: z.record(z.any()).optional(),
    dependencies: z.array(z.string()).optional()
  }))
});

type SubtaskOutput = z.infer<typeof SubtaskSchema>;

export class TaskAgent extends BaseAgent {
  private maxSubtasks: number;
  private systemPrompt: string;

  constructor(config: TaskAgentConfig) {
    super({
      ...config,
      name: config.name || 'Task Agent',
      description: config.description || 'Task Decomposition and Execution Agent',
      messageTypes: [
        ...(config.messageTypes || []),
        MessageType.TASK_REQUEST,
        MessageType.TASK_RESPONSE
      ]
    });

    this.maxSubtasks = config.maxSubtasks || 10;
    this.systemPrompt = config.systemPrompt || this.getDefaultSystemPrompt();
  }

  private getDefaultSystemPrompt(): string {
    return `You are a task planning assistant that helps break down complex tasks into smaller, manageable subtasks.
    When given a task, analyze it and break it down into logical subtasks. Each subtask should be clear and actionable.
    Consider dependencies between subtasks and specify which tools (if any) are needed for each subtask.

    Available tools:
    ${this.tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}`;
  }

  protected async processMessage(message: Message): Promise<void> {
    try {
      if (message.type !== MessageType.TASK_REQUEST) {
        throw new AgentError(`Unsupported message type: ${message.type}`);
      }

      const task: Task = {
        id: message.id,
        description: message.payload.task,
        status: 'pending',
        metadata: message.payload.metadata
      };

      await this.handleTask(task, message.metadata.correlationId);
    } catch (error) {
      if (error instanceof Error) {
        throw new AgentError(`Task processing failed: ${error.message}`);
      }
      throw error;
    }
  }

  private async handleTask(task: Task, correlationId: string): Promise<void> {
    try {
      // Store task
      task.status = 'in_progress';

      // Generate subtasks using structured output
      const result = await generateStructuredOutput<SubtaskOutput>(
        this.model,
        [new HumanMessage(task.description)],
        SubtaskSchema,
        this.systemPrompt
      );

      const { subtasks } = result;

      if (subtasks.length > this.maxSubtasks) {
        throw new AgentError(`Too many subtasks generated (${subtasks.length} > ${this.maxSubtasks})`);
      }

      // Execute subtasks
      const results = await this.executeSubtasks(subtasks, task.id);

      // Update task status
      task.status = 'completed';

      // Send response
      await this.sendMessage(
        MessageType.TASK_RESPONSE,
        {
          taskId: task.id,
          status: 'completed',
          results
        },
        Priority.MEDIUM,
        correlationId
      );
    } catch (error) {
      // Update task status
      task.status = 'failed';

      throw error;
    }
  }

  private async executeSubtasks(subtasks: SubtaskOutput['subtasks'], taskId: string): Promise<any[]> {
    const results: any[] = [];

    for (const subtask of subtasks) {
      try {
        let result;
        if (subtask.toolName && this.tools.find(t => t.name === subtask.toolName)) {
          result = await this.executeTool(subtask.toolName, subtask.parameters || {});
        } else {
          // If no tool specified or tool not found, store the subtask description as the result
          result = subtask.description;
        }
        results.push({ description: subtask.description, result });
      } catch (error) {
        throw new AgentError(
          `Failed to execute subtask "${subtask.description}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return results;
  }

  /**
   * Direct task execution method for convenience
   */
  public async executeTask(description: string): Promise<any[]> {
    const taskId = crypto.randomUUID();
    const task: Task = {
      id: taskId,
      description,
      status: 'pending'
    };

    await this.handleTask(task, taskId);
    return task.status === 'completed' ? task.metadata?.results || [] : [];
  }
}