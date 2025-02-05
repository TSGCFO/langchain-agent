import { logAnalyzer } from '../core/logging/LogAnalyzer';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { logger } from '../core/logging/Logger';

interface TrainingConfig {
  minSuccessRate: number;
  minSampleSize: number;
  maxSamplesPerTool: number;
  excludePatterns: string[];
}

const DEFAULT_CONFIG: TrainingConfig = {
  minSuccessRate: 0.9,
  minSampleSize: 100,
  maxSamplesPerTool: 1000,
  excludePatterns: [
    'error',
    'failed',
    'timeout',
    'invalid'
  ]
};

async function prepareTrainingData(config: TrainingConfig = DEFAULT_CONFIG) {
  console.log('Preparing training data...');
  
  const trainingDir = join(process.cwd(), 'training');
  await mkdir(trainingDir, { recursive: true });

  try {
    // Get raw dataset
    const dataset = await logAnalyzer.generateFineTuningDataset();
    console.log(`Total raw samples: ${dataset.length}`);

    // Filter and clean the dataset
    const cleanedDataset = dataset.filter(sample => {
      // Check success rate
      if (!sample.metadata.success) return false;

      // Check for excluded patterns
      const hasExcludedPattern = config.excludePatterns.some(pattern =>
        sample.input.toLowerCase().includes(pattern) ||
        sample.output.reasoning.toLowerCase().includes(pattern)
      );
      if (hasExcludedPattern) return false;

      return true;
    });

    console.log(`Cleaned samples: ${cleanedDataset.length}`);

    // Group by tool
    const toolGroups = new Map<string, typeof dataset>();
    cleanedDataset.forEach(sample => {
      const tool = sample.output.toolName;
      if (!toolGroups.has(tool)) {
        toolGroups.set(tool, []);
      }
      toolGroups.get(tool)!.push(sample);
    });

    // Balance the dataset
    const balancedDataset: typeof dataset = [];
    for (const [tool, samples] of toolGroups.entries()) {
      if (samples.length < config.minSampleSize) {
        console.log(`Skipping tool ${tool}: insufficient samples (${samples.length})`);
        continue;
      }

      // Sort by execution time (prefer faster executions)
      const sortedSamples = samples.sort(
        (a, b) => a.metadata.executionTime - b.metadata.executionTime
      );

      // Take top performing samples up to max limit
      const selectedSamples = sortedSamples.slice(0, config.maxSamplesPerTool);
      balancedDataset.push(...selectedSamples);

      console.log(`Selected ${selectedSamples.length} samples for tool ${tool}`);
    }

    // Prepare training formats
    const anthropicFormat = balancedDataset.map(sample => ({
      input: sample.input,
      output: `Tool: ${sample.output.toolName}
Parameters: ${JSON.stringify(sample.output.parameters, null, 2)}
Reasoning: ${sample.output.reasoning}`
    }));

    const openAIFormat = balancedDataset.map(sample => ({
      messages: [
        {
          role: 'system',
          content: 'You are a task planning assistant that helps execute commands using available tools.'
        },
        {
          role: 'user',
          content: sample.input
        },
        {
          role: 'assistant',
          content: JSON.stringify({
            tool: sample.output.toolName,
            parameters: sample.output.parameters,
            reasoning: sample.output.reasoning
          }, null, 2)
        }
      ]
    }));

    // Save training files
    const timestamp = Date.now();
    const files = [
      {
        name: `anthropic-training-${timestamp}.jsonl`,
        data: anthropicFormat
      },
      {
        name: `openai-training-${timestamp}.jsonl`,
        data: openAIFormat
      },
      {
        name: `raw-training-${timestamp}.jsonl`,
        data: balancedDataset
      }
    ];

    for (const file of files) {
      const filepath = join(trainingDir, file.name);
      await writeFile(
        filepath,
        file.data.map(item => JSON.stringify(item)).join('\n')
      );
      console.log(`Saved ${file.name}`);
    }

    // Convert config to Record<string, unknown> for logging
    const configForLog: Record<string, unknown> = {
      minSuccessRate: config.minSuccessRate,
      minSampleSize: config.minSampleSize,
      maxSamplesPerTool: config.maxSamplesPerTool,
      excludePatterns: config.excludePatterns
    };

    // Log training data preparation
    await logger.logInteraction({
      command: 'prepare_training_data',
      analysis: {
        toolName: 'training',
        parameters: configForLog,
        reasoning: 'Preparing fine-tuning datasets from system logs'
      },
      result: {
        totalSamples: balancedDataset.length,
        toolCoverage: toolGroups.size,
        filesGenerated: files.map(f => f.name)
      },
      success: true,
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'training_preparation'
      }
    });

    return {
      totalSamples: balancedDataset.length,
      toolCoverage: toolGroups.size,
      files: files.map(f => f.name)
    };

  } catch (error) {
    // Convert config to Record<string, unknown> for logging
    const configForLog: Record<string, unknown> = {
      minSuccessRate: config.minSuccessRate,
      minSampleSize: config.minSampleSize,
      maxSamplesPerTool: config.maxSamplesPerTool,
      excludePatterns: config.excludePatterns
    };

    // Log failure
    await logger.logInteraction({
      command: 'prepare_training_data',
      analysis: {
        toolName: 'training',
        parameters: configForLog,
        reasoning: 'Preparing fine-tuning datasets from system logs'
      },
      result: null,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'training_preparation'
      }
    });

    throw error;
  }
}

// Run training data preparation if this script is executed directly
if (require.main === module) {
  prepareTrainingData().catch(error => {
    console.error('Failed to prepare training data:', error);
    process.exit(1);
  });
}

export { prepareTrainingData, TrainingConfig };