import { BaseAgent, AgentConfig, AgentError } from './BaseAgent';
import { Message, MessageType, Priority } from '../bus/types';
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

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

interface Subtask {
  description: string;
  toolName?: string;
  parameters?: Record<string, any>;
  dependencies?: string[];
}

const SubtaskSchema = z.object({
  subtasks: z.array(z.object({
    description: z.string(),
    toolName: z.string().optional(),
    parameters: z.record(z.any()).optional(),
    dependencies: z.array(z.string()).optional()
  }))
});

export class TaskAgent extends BaseAgent {
  private chain: RunnableSequence;
  private tasks: Map<string, Task>;
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

    this.tasks = new Map();
    this.maxSubtasks = config.maxSubtasks || 10;
    this.systemPrompt = config.systemPrompt || this.getDefaultSystemPrompt();
    this.chain = this.createChain();
  }

  private getDefaultSystemPrompt(): string {
    return `You are a task planning assistant that helps break down complex tasks into smaller, manageable subtasks.
    When given a task:
    1. Analyze the requirements
    2. Break it down into logical subtasks
    3. Identify any dependencies between subtasks
    4. Specify which tools are needed for each subtask
    
    Available tools:
    ${this.tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}`;
  }

  private createChain(): RunnableSequence {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', this.systemPrompt],
      new MessagesPlaceholder('chat_history'),
      ['human', 'Task: {task}\n\nBreak this task down into subtasks.'],
    ]);

    const parser = StructuredOutputParser.fromZodSchema(SubtaskSchema);

    return RunnableSequence.from([
      {
        task: (input: { task: string }) => input.task,
        chat_history: () => this.context.messages
      },
      prompt,
      this.model,
      parser
    ]);
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
      this.tasks.set(task.id, { ...task, status: 'in_progress' });

      // Decompose task into subtasks
      const { subtasks } = await this.chain.invoke({ task: task.description });

      if (subtasks.length > this.maxSubtasks) {
        throw new AgentError(`Too many subtasks generated (${subtasks.length} > ${this.maxSubtasks})`);
      }

      // Execute subtasks
      const results = await this.executeSubtasks(subtasks, task.id);

      // Update task status
      this.tasks.set(task.id, { ...task, status: 'completed' });

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
      this.tasks.set(task.id, { ...task, status: 'failed' });

      throw error;
    }
  }

  private async executeSubtasks(subtasks: Subtask[], taskId: string): Promise<any[]> {
    const results: any[] = [];

    // Sort subtasks based on dependencies
    const sortedSubtasks = this.sortSubtasksByDependencies(subtasks);

    for (const subtask of sortedSubtasks) {
      try {
        let result;
        if (subtask.toolName) {
          result = await this.executeTool(subtask.toolName, subtask.parameters || {});
        } else {
          // If no tool specified, store the subtask description as the result
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

  private sortSubtasksByDependencies(subtasks: Subtask[]): Subtask[] {
    const sorted: Subtask[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (subtask: Subtask) => {
      const subtaskId = subtask.description; // Use description as ID
      
      if (visiting.has(subtaskId)) {
        throw new AgentError('Circular dependency detected in subtasks');
      }
      
      if (visited.has(subtaskId)) return;

      visiting.add(subtaskId);

      if (subtask.dependencies) {
        for (const depId of subtask.dependencies) {
          const depSubtask = subtasks.find(s => s.description === depId);
          if (depSubtask) {
            visit(depSubtask);
          }
        }
      }

      visiting.delete(subtaskId);
      visited.add(subtaskId);
      sorted.push(subtask);
    };

    for (const subtask of subtasks) {
      if (!visited.has(subtask.description)) {
        visit(subtask);
      }
    }

    return sorted;
  }

  /**
   * Get task status
   */
  public getTaskStatus(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  public getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Clear task history
   */
  public clearTasks(): void {
    this.tasks.clear();
  }

  /**
   * Direct task execution method for convenience
   */
  public async executeTask(
    description: string,
    metadata?: Record<string, any>
  ): Promise<any[]> {
    const taskId = crypto.randomUUID();
    const task: Task = {
      id: taskId,
      description,
      status: 'pending',
      metadata
    };

    await this.handleTask(task, taskId);
    return this.getTaskStatus(taskId)?.metadata?.results || [];
  }
}