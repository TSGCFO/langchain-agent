import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

interface InteractionLog {
  timestamp: string;
  command: string;
  analysis: {
    toolName: string;
    parameters: Record<string, unknown>;
    reasoning: string;
  };
  result: unknown;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

interface ToolUsageLog {
  toolName: string;
  parameters: Record<string, unknown>;
  result: unknown;
  success: boolean;
  error?: string;
  timestamp: string;
}

interface EvaluationLog {
  timestamp: string;
  interactionId: string;
  metrics: {
    toolSelectionAccuracy: number;
    reasoningQuality: number;
    taskCompletionSuccess: number;
  };
  feedback?: string;
}

export class Logger {
  private logDir: string;
  private interactionsFile: string;
  private toolUsageFile: string;
  private evaluationFile: string;

  constructor(baseDir: string = 'logs') {
    this.logDir = join(process.cwd(), baseDir);
    this.interactionsFile = join(this.logDir, 'interactions.jsonl');
    this.toolUsageFile = join(this.logDir, 'tool_usage.jsonl');
    this.evaluationFile = join(this.logDir, 'evaluation.jsonl');
  }

  async initialize(): Promise<void> {
    try {
      // Create log directory if it doesn't exist
      await mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize logger:', error);
      throw error;
    }
  }

  private async appendToLog(filePath: string, data: unknown): Promise<void> {
    try {
      const logEntry = JSON.stringify(data) + '\n';
      await writeFile(filePath, logEntry, { flag: 'a' });
    } catch (error) {
      console.error(`Failed to write to log file ${filePath}:`, error);
      throw error;
    }
  }

  async logInteraction(data: Omit<InteractionLog, 'timestamp'>): Promise<void> {
    const logEntry: InteractionLog = {
      ...data,
      timestamp: new Date().toISOString()
    };
    await this.appendToLog(this.interactionsFile, logEntry);
  }

  async logToolUsage(data: Omit<ToolUsageLog, 'timestamp'>): Promise<void> {
    const logEntry: ToolUsageLog = {
      ...data,
      timestamp: new Date().toISOString()
    };
    await this.appendToLog(this.toolUsageFile, logEntry);
  }

  async logEvaluation(evaluation: Omit<EvaluationLog, 'timestamp'>): Promise<void> {
    const logEntry: EvaluationLog = {
      ...evaluation,
      timestamp: new Date().toISOString()
    };
    await this.appendToLog(this.evaluationFile, logEntry);
  }

  async getInteractionHistory(limit: number = 100): Promise<InteractionLog[]> {
    return await this.readLastLinesAsJSON<InteractionLog>(this.interactionsFile, limit);
  }

  async getToolUsageStats(days: number = 7): Promise<Record<string, {
    totalUses: number;
    successRate: number;
    averageResponseTime: number;
  }>> {
    const logs = await this.readLastLinesAsJSON<ToolUsageLog>(this.toolUsageFile);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const stats: Record<string, {
      totalUses: number;
      successCount: number;
      totalResponseTime: number;
    }> = {};

    logs.forEach(log => {
      const logDate = new Date(log.timestamp);
      if (logDate >= cutoffDate) {
        if (!stats[log.toolName]) {
          stats[log.toolName] = {
            totalUses: 0,
            successCount: 0,
            totalResponseTime: 0
          };
        }
        stats[log.toolName].totalUses++;
        if (log.success) {
          stats[log.toolName].successCount++;
        }
      }
    });

    return Object.entries(stats).reduce((acc, [toolName, data]) => {
      acc[toolName] = {
        totalUses: data.totalUses,
        successRate: data.successCount / data.totalUses,
        averageResponseTime: data.totalResponseTime / data.totalUses
      };
      return acc;
    }, {} as Record<string, {
      totalUses: number;
      successRate: number;
      averageResponseTime: number;
    }>);
  }

  private async readLastLinesAsJSON<T>(filePath: string, maxLines: number = 1000): Promise<T[]> {
    try {
      const lines: string[] = [];
      const fileStream = createReadStream(filePath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        lines.push(line);
        if (lines.length > maxLines) {
          lines.shift();
        }
      }

      return lines
        .filter(Boolean)
        .map(line => JSON.parse(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      console.error(`Failed to read from ${filePath}:`, error);
      throw error;
    }
  }

  async generateTrainingData(): Promise<{
    interactions: InteractionLog[];
    toolUsage: ToolUsageLog[];
    evaluations: EvaluationLog[];
  }> {
    try {
      const [interactions, toolUsage, evaluations] = await Promise.all([
        this.getInteractionHistory(1000),
        this.readLastLinesAsJSON<ToolUsageLog>(this.toolUsageFile, 1000),
        this.readLastLinesAsJSON<EvaluationLog>(this.evaluationFile, 1000)
      ]);

      return {
        interactions,
        toolUsage,
        evaluations
      };
    } catch (error) {
      console.error('Failed to generate training data:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const logger = new Logger();

// Initialize logger when importing this module
logger.initialize().catch(console.error);