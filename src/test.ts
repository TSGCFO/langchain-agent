import { createAgentSystem } from './index';
import { MessageBus } from './core/bus/MessageBus';
import { ChatAnthropic } from "@langchain/anthropic";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";

describe('System Integration Test', () => {
  let system: Awaited<ReturnType<typeof createAgentSystem>>;
  let messageBus: MessageBus;

  beforeAll(async () => {
    // Initialize test dependencies
    messageBus = new MessageBus({
      redis: { url: process.env.REDIS_URL || 'redis://localhost:6379' }
    });

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const vectorStore = await MemoryVectorStore.fromTexts(
      ['Test knowledge base entry'],
      [{ source: 'test' }],
      embeddings
    );

    const model = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      modelName: "claude-3-opus-20240229",
      temperature: 0
    });

    // Create agent system
    system = await createAgentSystem({
      messageBus,
      model,
      retriever: vectorStore.asRetriever()
    });
  });

  afterAll(async () => {
    await system.shutdown();
  });

  it('should execute tasks successfully', async () => {
    const result = await system.executeTask(
      'Create a file named test.txt with content "Test content"'
    );
    expect(result).toBeDefined();
  });

  it('should handle knowledge queries', async () => {
    const result = await system.query(
      'What files were created?'
    );
    expect(result).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    await expect(
      system.executeTask('This should fail with invalid tool')
    ).rejects.toBeDefined();
  });
});