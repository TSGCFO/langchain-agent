import { config } from 'dotenv';
import { createAgentSystem } from '../src';
import { fileSystemTools } from '../src/tools/fileSystemTools';
import { systemTools } from '../src/tools/systemTools';
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

// Load environment variables
config();

async function runExample() {
  console.log('Initializing agent system...');

  try {
    // Initialize embeddings and vector store
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Create a simple vector store with some example knowledge
    const vectorStore = await MemoryVectorStore.fromTexts(
      [
        'The system can perform various file operations.',
        'System commands can be executed safely.',
        'The agent system supports real-time collaboration.',
        'Multiple agents can work together to solve complex tasks.'
      ],
      [
        { source: 'capabilities', section: 'file-ops' },
        { source: 'capabilities', section: 'system-ops' },
        { source: 'architecture', section: 'collaboration' },
        { source: 'architecture', section: 'multi-agent' }
      ],
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

    console.log('Agent system initialized successfully\n');

    // Example tasks
    const tasks = [
      {
        type: 'task',
        description: 'Create a new directory named "example" and a file inside it',
        input: 'Create a directory named "example" and create a file named "readme.txt" inside it with the content "This is an example directory."'
      },
      {
        type: 'query',
        description: 'Query about system capabilities',
        input: 'What operations can the system perform with files?'
      },
      {
        type: 'task',
        description: 'List directory contents',
        input: 'List all files in the example directory'
      }
    ];

    // Execute tasks
    for (const task of tasks) {
      console.log(`\nExecuting ${task.type}: ${task.description}`);
      console.log('Input:', task.input);

      try {
        const result = task.type === 'task'
          ? await system.executeTask(task.input)
          : await system.query(task.input);

        console.log('Result:', result);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
      }

      // Add a small delay between tasks
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Shutdown system
    await system.shutdown();
    console.log('\nAgent system shut down successfully');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the example if this script is being run directly
if (require.main === module) {
  runExample().catch(console.error);
}