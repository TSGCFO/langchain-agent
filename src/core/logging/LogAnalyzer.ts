import { logger } from './Logger';

interface ToolAnalysis {
  name: string;
  totalUses: number;
  successRate: number;
  averageResponseTime: number;
  commonParameters: Record<string, number>;
  commonErrors: Array<{ error: string; count: number }>;
}

interface ReasoningAnalysis {
  patterns: Array<{
    pattern: string;
    count: number;
    successRate: number;
  }>;
  averageLength: number;
  commonPhrases: Array<{ phrase: string; count: number }>;
}

interface PerformanceMetrics {
  overallSuccessRate: number;
  averageExecutionTime: number;
  toolSelectionAccuracy: number;
  reasoningQuality: number;
  taskCompletionRate: number;
}

export class LogAnalyzer {
  async analyzeToolUsage(days: number = 7): Promise<ToolAnalysis[]> {
    const logs = await logger.generateTrainingData();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const toolStats = new Map<string, {
      uses: number;
      successes: number;
      totalTime: number;
      parameters: Map<string, number>;
      errors: Map<string, number>;
    }>();

    logs.toolUsage
      .filter(log => new Date(log.timestamp) >= cutoffDate)
      .forEach(log => {
        if (!toolStats.has(log.toolName)) {
          toolStats.set(log.toolName, {
            uses: 0,
            successes: 0,
            totalTime: 0,
            parameters: new Map(),
            errors: new Map()
          });
        }

        const stats = toolStats.get(log.toolName)!;
        stats.uses++;
        if (log.success) {
          stats.successes++;
        }

        // Track parameter usage
        Object.keys(log.parameters).forEach(param => {
          const count = stats.parameters.get(param) || 0;
          stats.parameters.set(param, count + 1);
        });

        // Track errors
        if (log.error) {
          const count = stats.errors.get(log.error) || 0;
          stats.errors.set(log.error, count + 1);
        }
      });

    return Array.from(toolStats.entries()).map(([name, stats]) => ({
      name,
      totalUses: stats.uses,
      successRate: stats.successes / stats.uses,
      averageResponseTime: stats.totalTime / stats.uses,
      commonParameters: Object.fromEntries(
        Array.from(stats.parameters.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
      ),
      commonErrors: Array.from(stats.errors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([error, count]) => ({ error, count }))
    }));
  }

  async analyzeReasoning(): Promise<ReasoningAnalysis> {
    const logs = await logger.generateTrainingData();
    const reasonings = logs.interactions
      .filter(log => log.analysis?.reasoning)
      .map(log => log.analysis.reasoning);

    const patterns = this.extractReasoningPatterns(reasonings);
    const phrases = this.extractCommonPhrases(reasonings);
    const totalLength = reasonings.reduce((sum, r) => sum + r.length, 0);

    return {
      patterns: patterns.map(([pattern, stats]) => ({
        pattern,
        count: stats.count,
        successRate: stats.successes / stats.count
      })),
      averageLength: totalLength / reasonings.length,
      commonPhrases: phrases.map(([phrase, count]) => ({ phrase, count }))
    };
  }

  async calculatePerformanceMetrics(days: number = 7): Promise<PerformanceMetrics> {
    const logs = await logger.generateTrainingData();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentLogs = logs.interactions.filter(
      log => new Date(log.timestamp) >= cutoffDate
    );

    const totalInteractions = recentLogs.length;
    const successfulInteractions = recentLogs.filter(log => log.success).length;
    
    // Calculate total execution time from metadata
    const totalExecutionTime = recentLogs.reduce((sum, log) => {
      const executionTime = log.metadata?.executionTime;
      return sum + (typeof executionTime === 'number' ? executionTime : 0);
    }, 0);

    const evaluations = logs.evaluations.filter(
      evaluation => new Date(evaluation.timestamp) >= cutoffDate
    );

    const avgToolSelection = evaluations.reduce(
      (sum, evaluation) => sum + evaluation.metrics.toolSelectionAccuracy,
      0
    ) / evaluations.length;

    const avgReasoning = evaluations.reduce(
      (sum, evaluation) => sum + evaluation.metrics.reasoningQuality,
      0
    ) / evaluations.length;

    return {
      overallSuccessRate: successfulInteractions / totalInteractions,
      averageExecutionTime: totalExecutionTime / totalInteractions,
      toolSelectionAccuracy: avgToolSelection,
      reasoningQuality: avgReasoning,
      taskCompletionRate: successfulInteractions / totalInteractions
    };
  }

  private extractReasoningPatterns(reasonings: string[]): Array<[string, { count: number; successes: number }]> {
    const patterns = new Map<string, { count: number; successes: number }>();

    reasonings.forEach(reasoning => {
      // Extract patterns like "I'll use X because Y" or "X is the best tool for Y"
      const patternMatches = reasoning.match(
        /(using|chose|selected|need) \w+ (because|since|as|to) .+?[.]/gi
      ) || [];

      patternMatches.forEach(pattern => {
        const stats = patterns.get(pattern) || { count: 0, successes: 0 };
        stats.count++;
        patterns.set(pattern, stats);
      });
    });

    return Array.from(patterns.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
  }

  private extractCommonPhrases(reasonings: string[]): Array<[string, number]> {
    const phrases = new Map<string, number>();
    const minPhraseLength = 5;
    const maxPhraseLength = 15;

    reasonings.forEach(reasoning => {
      const words = reasoning.split(/\s+/);
      for (let len = minPhraseLength; len <= maxPhraseLength; len++) {
        for (let i = 0; i <= words.length - len; i++) {
          const phrase = words.slice(i, i + len).join(' ');
          phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
        }
      }
    });

    return Array.from(phrases.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }

  async generateFineTuningDataset(): Promise<Array<{
    input: string;
    output: {
      toolName: string;
      parameters: Record<string, unknown>;
      reasoning: string;
    };
    metadata: {
      success: boolean;
      executionTime: number;
    };
  }>> {
    const logs = await logger.generateTrainingData();
    
    return logs.interactions
      .filter(log => log.success && log.analysis)
      .map(log => ({
        input: log.command,
        output: {
          toolName: log.analysis.toolName,
          parameters: log.analysis.parameters,
          reasoning: log.analysis.reasoning
        },
        metadata: {
          success: log.success,
          executionTime: typeof log.metadata?.executionTime === 'number' ? 
            log.metadata.executionTime : 0
        }
      }));
  }
}

// Create a singleton instance
export const logAnalyzer = new LogAnalyzer();