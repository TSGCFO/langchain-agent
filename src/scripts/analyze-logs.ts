import { logAnalyzer } from '../core/logging/LogAnalyzer';
import { writeFile } from 'fs/promises';
import { join } from 'path';

async function generateAnalysisReport() {
  try {
    console.log('Analyzing system logs...\n');

    // Analyze tool usage
    console.log('Analyzing tool usage patterns...');
    const toolAnalysis = await logAnalyzer.analyzeToolUsage(30); // Last 30 days
    
    // Analyze reasoning patterns
    console.log('Analyzing reasoning patterns...');
    const reasoningAnalysis = await logAnalyzer.analyzeReasoning();
    
    // Calculate performance metrics
    console.log('Calculating performance metrics...');
    const performanceMetrics = await logAnalyzer.calculatePerformanceMetrics(30);

    // Generate fine-tuning dataset
    console.log('Generating fine-tuning dataset...');
    const finetuningData = await logAnalyzer.generateFineTuningDataset();

    // Create the report
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalToolsAnalyzed: toolAnalysis.length,
        overallSuccessRate: performanceMetrics.overallSuccessRate,
        averageExecutionTime: performanceMetrics.averageExecutionTime,
      },
      toolAnalysis: toolAnalysis.map(tool => ({
        name: tool.name,
        usage: {
          total: tool.totalUses,
          successRate: tool.successRate,
          averageResponseTime: tool.averageResponseTime,
        },
        topParameters: Object.entries(tool.commonParameters)
          .map(([param, count]) => ({ param, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        commonErrors: tool.commonErrors,
      })),
      reasoningPatterns: {
        patterns: reasoningAnalysis.patterns,
        averageLength: reasoningAnalysis.averageLength,
        commonPhrases: reasoningAnalysis.commonPhrases,
      },
      performance: performanceMetrics,
      recommendations: generateRecommendations(
        toolAnalysis,
        reasoningAnalysis,
        performanceMetrics
      ),
    };

    // Save the report
    const reportPath = join(process.cwd(), 'analysis', `report-${Date.now()}.json`);
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);

    // Save fine-tuning dataset
    const datasetPath = join(process.cwd(), 'analysis', `finetuning-${Date.now()}.jsonl`);
    await writeFile(
      datasetPath,
      finetuningData.map(item => JSON.stringify(item)).join('\n')
    );
    console.log(`Fine-tuning dataset saved to: ${datasetPath}`);

    // Print summary to console
    console.log('\nAnalysis Summary:');
    console.log('----------------');
    console.log(`Total tools analyzed: ${report.summary.totalToolsAnalyzed}`);
    console.log(`Overall success rate: ${(report.summary.overallSuccessRate * 100).toFixed(2)}%`);
    console.log(`Average execution time: ${report.summary.averageExecutionTime.toFixed(2)}ms`);
    console.log('\nTop Recommendations:');
    report.recommendations.slice(0, 3).forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });

  } catch (error) {
    console.error('Error generating analysis report:', error);
    process.exit(1);
  }
}

function generateRecommendations(
  toolAnalysis: Awaited<ReturnType<typeof logAnalyzer.analyzeToolUsage>>,
  reasoningAnalysis: Awaited<ReturnType<typeof logAnalyzer.analyzeReasoning>>,
  performanceMetrics: Awaited<ReturnType<typeof logAnalyzer.calculatePerformanceMetrics>>
): string[] {
  const recommendations: string[] = [];

  // Tool-based recommendations
  toolAnalysis.forEach(tool => {
    if (tool.successRate < 0.9) {
      recommendations.push(
        `Improve reliability of '${tool.name}' tool (current success rate: ${(tool.successRate * 100).toFixed(1)}%)`
      );
    }
    if (tool.averageResponseTime > 2000) {
      recommendations.push(
        `Optimize performance of '${tool.name}' tool (average response time: ${tool.averageResponseTime.toFixed(0)}ms)`
      );
    }
    if (tool.commonErrors.length > 0) {
      recommendations.push(
        `Address common errors in '${tool.name}' tool: ${tool.commonErrors[0].error}`
      );
    }
  });

  // Reasoning-based recommendations
  if (reasoningAnalysis.averageLength > 200) {
    recommendations.push(
      'Consider optimizing reasoning length for better efficiency'
    );
  }

  // Performance-based recommendations
  if (performanceMetrics.toolSelectionAccuracy < 0.95) {
    recommendations.push(
      'Improve tool selection accuracy through better prompt engineering'
    );
  }
  if (performanceMetrics.taskCompletionRate < 0.9) {
    recommendations.push(
      'Focus on improving overall task completion rate'
    );
  }

  return recommendations;
}

// Run the analysis if this script is executed directly
if (require.main === module) {
  generateAnalysisReport().catch(console.error);
}

export { generateAnalysisReport };