import { BaseAgent, AgentConfig, AgentError } from './BaseAgent';
import { Message, MessageType, Priority } from '../bus/types';
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { generateStructuredOutput } from '../llm/anthropic';
import { DynamicStructuredTool } from "@langchain/core/tools";
import { logger } from '../logging/Logger';

export interface TaskAgentConfig extends AgentConfig {
  maxSubtasks?: number;
  systemPrompt?: string;
}

interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  parentId?: string;
  metadata?: Record<string, unknown>;
}

// Schema for task analysis
const TaskAnalysisSchema = z.object({
  toolName: z.string().describe("The name of the tool to use"),
  parameters: z.record(z.any()).describe("Parameters for the tool"),
  reasoning: z.string().describe("Reasoning behind the tool selection and parameters")
});

type TaskAnalysis = z.infer<typeof TaskAnalysisSchema>;

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

  private getToolParameterDescription(tool: DynamicStructuredTool): string {
    try {
      const schema = tool.schema as z.ZodObject<any>;
      const shape = schema.shape;
      
      return Object.entries(shape).map(([name, field]) => {
        const description = (field as z.ZodType)._def.description || name;
        return `    - ${name}: ${description}`;
      }).join('\n');
    } catch (error) {
      return '    (No parameter description available)';
    }
  }

  private getDefaultSystemPrompt(): string {
    const toolDescriptions = this.tools.map(tool => {
      const paramDescriptions = this.getToolParameterDescription(tool);
      return `- ${tool.name}: ${tool.description}
  Parameters:
${paramDescriptions}`;
    }).join('\n\n');

    return `You are a task planning assistant that helps execute commands using available tools.
    When given a task, analyze it and determine which tool to use and what parameters to provide.
    Consider the available tools and their capabilities carefully.

    Available tools:
${toolDescriptions}

    Respond with:
    1. The name of the tool to use (toolName)
    2. The parameters for the tool (parameters)
    3. Your reasoning (reasoning)

    IMPORTANT: Make sure to use the exact parameter names as specified in the tool schemas.`;
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
    const startTime = Date.now();
    let success = false;
    let error: Error | undefined;
    let analysis: TaskAnalysis | undefined;
    let result: unknown;

    try {
      // Store task
      task.status = 'in_progress';

      // Analyze task using LLM
      analysis = await generateStructuredOutput<TaskAnalysis>(
        this.model,
        [new HumanMessage(task.description)],
        TaskAnalysisSchema,
        this.systemPrompt
      );

      console.log('Task analysis:', analysis);

      // Log the interaction before executing the tool
      await logger.logInteraction({
        command: task.description,
        analysis,
        result: null,
        success: false,
        metadata: {
          agentId: this.id,
          correlationId
        }
      });

      // Execute the tool
      result = await this.executeTool(analysis.toolName, analysis.parameters);

      // Log tool usage
      await logger.logToolUsage({
        toolName: analysis.toolName,
        parameters: analysis.parameters,
        result,
        success: true
      });

      // Update task status
      task.status = 'completed';
      task.metadata = {
        ...task.metadata,
        analysis,
        result
      };

      success = true;

      // Send response
      await this.sendMessage(
        MessageType.TASK_RESPONSE,
        {
          taskId: task.id,
          status: 'completed',
          result,
          analysis
        },
        Priority.MEDIUM,
        correlationId
      );

      // Log final interaction state
      await logger.logInteraction({
        command: task.description,
        analysis,
        result,
        success: true,
        metadata: {
          agentId: this.id,
          correlationId,
          executionTime: Date.now() - startTime
        }
      });

      // Log evaluation metrics
      await logger.logEvaluation({
        interactionId: task.id,
        metrics: {
          toolSelectionAccuracy: 1.0, // We could implement more sophisticated metrics
          reasoningQuality: 1.0,
          taskCompletionSuccess: 1.0
        }
      });

    } catch (err) {
      // Update task status
      task.status = 'failed';
      error = err instanceof Error ? err : new Error('Unknown error');
      success = false;

      // Log failure
      await logger.logInteraction({
        command: task.description,
        analysis: analysis || { toolName: 'unknown', parameters: {}, reasoning: '' },
        result: null,
        success: false,
        error: error.message,
        metadata: {
          agentId: this.id,
          correlationId,
          executionTime: Date.now() - startTime
        }
      });

      if (analysis) {
        await logger.logToolUsage({
          toolName: analysis.toolName,
          parameters: analysis.parameters,
          result: null,
          success: false,
          error: error.message
        });
      }

      throw error;
    }
  }

  /**
   * Direct task execution method for convenience
   */
  public async executeTask(description: string): Promise<any> {
    const taskId = crypto.randomUUID();
    const task: Task = {
      id: taskId,
      description,
      status: 'pending'
    };

    await this.handleTask(task, taskId);
    return task.metadata?.result;
  }
}