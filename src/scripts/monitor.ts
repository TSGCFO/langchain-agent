import { generateAnalysisReport } from './analyze-logs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { logger } from '../core/logging/Logger';

const ANALYSIS_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const ANALYSIS_DIR = join(process.cwd(), 'analysis');

async function initializeMonitoring() {
  try {
    // Ensure analysis directory exists
    await mkdir(ANALYSIS_DIR, { recursive: true });
    console.log('Analysis directory initialized');

    // Initialize logger
    await logger.initialize();
    console.log('Logger initialized');

    // Start monitoring loop
    console.log('Starting monitoring system...');
    await runMonitoringCycle();
    setInterval(runMonitoringCycle, ANALYSIS_INTERVAL);

  } catch (error) {
    console.error('Failed to initialize monitoring:', error);
    process.exit(1);
  }
}

async function runMonitoringCycle() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Running monitoring cycle...`);

  try {
    // Generate analysis report
    await generateAnalysisReport();
    console.log('Analysis report generated successfully');

    // Log monitoring cycle completion
    await logger.logInteraction({
      command: 'system_monitoring',
      analysis: {
        toolName: 'monitor',
        parameters: {},
        reasoning: 'Periodic system monitoring and analysis'
      },
      result: 'Analysis report generated',
      success: true,
      metadata: {
        timestamp,
        type: 'monitoring_cycle'
      }
    });

  } catch (error) {
    console.error('Error in monitoring cycle:', error);
    
    // Log monitoring cycle failure
    await logger.logInteraction({
      command: 'system_monitoring',
      analysis: {
        toolName: 'monitor',
        parameters: {},
        reasoning: 'Periodic system monitoring and analysis'
      },
      result: null,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        timestamp,
        type: 'monitoring_cycle'
      }
    });
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\nShutting down monitoring system...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down monitoring system...');
  process.exit(0);
});

// Start monitoring if this script is run directly
if (require.main === module) {
  initializeMonitoring().catch(error => {
    console.error('Failed to start monitoring:', error);
    process.exit(1);
  });
}

export { initializeMonitoring, runMonitoringCycle };