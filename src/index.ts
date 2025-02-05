import { config } from 'dotenv';
import { createAgentSystem } from './core/agents';
import { fileSystemTools } from './tools/fileSystemTools';
import { systemTools } from './tools/systemTools';
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

// Load environment variables
config();

async function main() {
  try {
    // Initialize embeddings and vector store
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const vectorStore = await MemoryVectorStore.fromTexts(
      ['Initial knowledge base entry'],
      [{ source: 'initialization' }],
      embeddings
    );

    // Initialize model
    const model = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      modelName: "claude-3-opus-20240229",
      temperature: 0
    });

    // Create agent system
    const system = await createAgentSystem({
      model,
      tools: [...fileSystemTools, ...systemTools],
      retriever: vectorStore.asRetriever()
    });

    console.log('Agent system initialized successfully');

    // Example: Execute a task
    console.log('\nExecuting task...');
    const taskResult = await system.executeTask(
      'Create a file named example.txt with the content "Hello, World!"'
    );
    console.log('Task result:', taskResult);

    // Example: Query knowledge
    console.log('\nQuerying knowledge...');
    const queryResult = await system.query(
      'What files were created in the current directory?'
    );
    console.log('Query result:', queryResult);

    // Shutdown system
    await system.shutdown();
    console.log('\nAgent system shut down successfully');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the system if this file is being run directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use as a module
export { createAgentSystem };
export * from './core/agents';
export * from './tools/fileSystemTools';
export * from './tools/systemTools';