import { generateAnalysisReport } from './analyze-logs';
import { initializeMonitoring, runMonitoringCycle } from './monitor';
import { prepareTrainingData, TrainingConfig } from './train';
import { logger } from '../core/logging/Logger';
import { logAnalyzer } from '../core/logging/LogAnalyzer';

interface SystemStatus {
  isHealthy: boolean;
  lastAnalysis: Date | null;
  lastTrainingPrepared: Date | null;
  performanceMetrics: {
    successRate: number;
    averageExecutionTime: number;
    toolSelectionAccuracy: number;
  } | null;
  activeTools: string[];
  errors: string[];
}

class SystemManager {
  private status: SystemStatus = {
    isHealthy: true,
    lastAnalysis: null,
    lastTrainingPrepared: null,
    performanceMetrics: null,
    activeTools: [],
    errors: []
  };

  async initialize() {
    try {
      console.log('Initializing system manager...');
      
      // Initialize logger
      await logger.initialize();
      console.log('Logger initialized');

      // Run initial analysis
      await this.runAnalysis();
      console.log('Initial analysis completed');

      // Start monitoring
      await initializeMonitoring();
      console.log('Monitoring system started');

      return true;
    } catch (error) {
      console.error('Failed to initialize system manager:', error);
      this.status.isHealthy = false;
      this.status.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  async runAnalysis() {
    try {
      // Generate analysis report
      await generateAnalysisReport();
      
      // Update performance metrics
      const metrics = await logAnalyzer.calculatePerformanceMetrics();
      this.status.performanceMetrics = {
        successRate: metrics.overallSuccessRate,
        averageExecutionTime: metrics.averageExecutionTime,
        toolSelectionAccuracy: metrics.toolSelectionAccuracy
      };

      // Update status
      this.status.lastAnalysis = new Date();
      this.status.isHealthy = metrics.overallSuccessRate >= 0.9;

      return true;
    } catch (error) {
      console.error('Failed to run analysis:', error);
      this.status.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  async prepareTraining(config?: TrainingConfig) {
    try {
      const result = await prepareTrainingData(config);
      this.status.lastTrainingPrepared = new Date();
      return result;
    } catch (error) {
      console.error('Failed to prepare training data:', error);
      this.status.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  async checkHealth(): Promise<SystemStatus> {
    try {
      // Run a monitoring cycle
      await runMonitoringCycle();

      // Update active tools list
      const toolAnalysis = await logAnalyzer.analyzeToolUsage(1); // Last 24 hours
      this.status.activeTools = toolAnalysis.map(t => t.name);

      // Clear old errors
      if (this.status.errors.length > 10) {
        this.status.errors = this.status.errors.slice(-10);
      }

      return this.status;
    } catch (error) {
      console.error('Health check failed:', error);
      this.status.isHealthy = false;
      this.status.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return this.status;
    }
  }

  async generateSystemReport(): Promise<{
    status: SystemStatus;
    recommendations: string[];
    trainingNeeded: boolean;
  }> {
    const status = await this.checkHealth();
    const recommendations: string[] = [];
    let trainingNeeded = false;

    // Check performance metrics
    if (status.performanceMetrics) {
      if (status.performanceMetrics.successRate < 0.9) {
        recommendations.push('System success rate is below target. Consider retraining models.');
        trainingNeeded = true;
      }
      if (status.performanceMetrics.averageExecutionTime > 2000) {
        recommendations.push('System response time is high. Consider optimization.');
      }
      if (status.performanceMetrics.toolSelectionAccuracy < 0.95) {
        recommendations.push('Tool selection accuracy needs improvement. Review tool descriptions and examples.');
        trainingNeeded = true;
      }
    }

    // Check last analysis date
    if (status.lastAnalysis) {
      const daysSinceAnalysis = (Date.now() - status.lastAnalysis.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceAnalysis > 7) {
        recommendations.push('System analysis is outdated. Run new analysis.');
      }
    }

    // Check last training date
    if (status.lastTrainingPrepared) {
      const daysSinceTraining = (Date.now() - status.lastTrainingPrepared.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceTraining > 30) {
        recommendations.push('Consider preparing new training data and updating models.');
        trainingNeeded = true;
      }
    }

    // Check errors
    if (status.errors.length > 0) {
      recommendations.push('System has recorded errors. Review error log and address issues.');
    }

    return {
      status,
      recommendations,
      trainingNeeded
    };
  }
}

// Create singleton instance
export const systemManager = new SystemManager();

// Run system manager if this script is executed directly
if (require.main === module) {
  systemManager.initialize().then(success => {
    if (!success) {
      console.error('Failed to initialize system manager');
      process.exit(1);
    }
    
    console.log('System manager initialized successfully');
    
    // Generate initial report
    systemManager.generateSystemReport().then(report => {
      console.log('\nSystem Report:');
      console.log('--------------');
      console.log(`Status: ${report.status.isHealthy ? 'Healthy' : 'Needs Attention'}`);
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
        console.log('\nAction Required: System needs retraining');
      }
    });
  });
}

export { SystemManager, SystemStatus };