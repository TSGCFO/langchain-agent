#!/usr/bin/env node
import { Command } from 'commander';
import { systemManager } from './manage';
import { generateAnalysisReport } from './analyze-logs';
import { prepareTrainingData } from './train';
import { runMonitoringCycle } from './monitor';

const program = new Command();

program
  .name('agent-cli')
  .description('CLI to manage the agent system')
  .version('1.0.0');

program
  .command('status')
  .description('Check system status and get recommendations')
  .action(async () => {
    try {
      const report = await systemManager.generateSystemReport();
      console.log('\nSystem Report:');
      console.log('--------------');
      console.log(`Status: ${report.status.isHealthy ? '✅ Healthy' : '❌ Needs Attention'}`);
      console.log(`Active Tools: ${report.status.activeTools.join(', ')}`);
      
      if (report.status.performanceMetrics) {
        console.log('\nPerformance Metrics:');
        console.log(`- Success Rate: ${(report.status.performanceMetrics.successRate * 100).toFixed(1)}%`);
        console.log(`- Avg Response Time: ${report.status.performanceMetrics.averageExecutionTime.toFixed(0)}ms`);
        console.log(`- Tool Selection Accuracy: ${(report.status.performanceMetrics.toolSelectionAccuracy * 100).toFixed(1)}%`);
      }
      
      if (report.recommendations.length > 0) {
        console.log('\nRecommendations:');
        report.recommendations.forEach((rec, i) => {
          console.log(`${i + 1}. ${rec}`);
        });
      }
      
      if (report.trainingNeeded) {
        console.log('\n⚠️  Action Required: System needs retraining');
      }

      if (report.status.errors.length > 0) {
        console.log('\nRecent Errors:');
        report.status.errors.forEach((error, i) => {
          console.log(`${i + 1}. ${error}`);
        });
      }
    } catch (error) {
      console.error('Failed to generate system report:', error);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Run system analysis and generate report')
  .option('-d, --days <number>', 'Number of days to analyze', '30')
  .action(async (options) => {
    try {
      console.log(`Analyzing system data for the last ${options.days} days...`);
      await generateAnalysisReport();
      console.log('Analysis completed successfully');
    } catch (error) {
      console.error('Analysis failed:', error);
      process.exit(1);
    }
  });

program
  .command('train')
  .description('Prepare training data for model fine-tuning')
  .option('-m, --min-samples <number>', 'Minimum samples per tool', '100')
  .option('-s, --success-rate <number>', 'Minimum success rate', '0.9')
  .option('-x, --max-samples <number>', 'Maximum samples per tool', '1000')
  .action(async (options) => {
    try {
      console.log('Preparing training data...');
      const config = {
        minSampleSize: parseInt(options.minSamples),
        minSuccessRate: parseFloat(options.successRate),
        maxSamplesPerTool: parseInt(options.maxSamples),
        excludePatterns: ['error', 'failed', 'timeout', 'invalid']
      };
      
      const result = await prepareTrainingData(config);
      if (result) {
        console.log('\nTraining data prepared successfully:');
        console.log(`- Total samples: ${result.totalSamples}`);
        console.log(`- Tool coverage: ${result.toolCoverage} tools`);
        console.log('\nGenerated files:');
        result.files.forEach(file => console.log(`- ${file}`));
      }
    } catch (error) {
      console.error('Failed to prepare training data:', error);
      process.exit(1);
    }
  });

program
  .command('monitor')
  .description('Run a monitoring cycle')
  .action(async () => {
    try {
      console.log('Running monitoring cycle...');
      await runMonitoringCycle();
      console.log('Monitoring cycle completed successfully');
    } catch (error) {
      console.error('Monitoring cycle failed:', error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize the system')
  .action(async () => {
    try {
      console.log('Initializing system...');
      const success = await systemManager.initialize();
      if (success) {
        console.log('System initialized successfully');
      } else {
        console.error('System initialization failed');
        process.exit(1);
      }
    } catch (error) {
      console.error('Initialization failed:', error);
      process.exit(1);
    }
  });

// Add help text for examples
program.addHelpText('after', `
Examples:
  $ agent-cli status                    # Check system status
  $ agent-cli analyze --days 7          # Analyze last 7 days of data
  $ agent-cli train --min-samples 200   # Prepare training data with min 200 samples
  $ agent-cli monitor                   # Run a monitoring cycle
  $ agent-cli init                      # Initialize the system
`);

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}