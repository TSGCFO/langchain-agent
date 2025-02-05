# Getting Started Guide

## Prerequisites

- Node.js (v18 or higher)
- TypeScript 5.x
- Redis (for message bus and caching)
- Vector Database (Pinecone recommended)
- API Keys:
  - Anthropic (Claude)
  - OpenAI (for embeddings)
  - Google (optional)

## Project Setup

1. Clone the repository and install dependencies:

```bash
git clone [repository-url]
cd langchain-agent
npm install
```

2. Create environment configuration:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# LLM API Keys
ANTHROPIC_API_KEY=your_claude_api_key
OPENAI_API_KEY=your_openai_api_key
GOOGLE_API_KEY=your_google_api_key

# Vector Database
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX=your_index_name

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=3000
NODE_ENV=development
```

## Project Structure

```
src/
├── agents/              # Agent implementations
│   ├── base/           # Base agent classes
│   ├── rag/            # RAG agents
│   └── specialized/    # Specialized agents
├── core/               # Core system components
│   ├── bus/           # Message bus
│   ├── memory/        # Memory management
│   └── tools/         # Tool implementations
├── api/               # API layer
├── websocket/         # WebSocket implementation
└── utils/             # Shared utilities
```

## Running the Development Environment

1. Start Redis:
```bash
redis-server
```

2. Start the development server:
```bash
npm run dev
```

3. Run tests:
```bash
npm test
```

## Basic Usage Examples

### 1. Creating a Basic Agent

```typescript
import { createAgent } from './src/agents/base';
import { fileSystemTools } from './src/core/tools';

async function main() {
  const agent = await createAgent({
    tools: fileSystemTools,
    verbose: true
  });

  const result = await agent.invoke({
    input: "List files in the current directory"
  });

  console.log(result);
}
```

### 2. Using the RAG System

```typescript
import { RAGChain } from './src/knowledge/rag';
import { VectorStore } from './src/knowledge/vectorstore';

async function setupRAG() {
  // Initialize vector store
  const vectorStore = new VectorStore();
  await vectorStore.initialize();

  // Create RAG chain
  const ragChain = new RAGChain();
  await ragChain.initialize(vectorStore.getRetriever());

  // Use the chain
  const result = await ragChain.createChain().invoke({
    question: "What documents do we have about system architecture?"
  });

  console.log(result);
}
```

### 3. Using WebSocket for Real-time Updates

```typescript
// Frontend example
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'llm_start':
      console.log('LLM processing started');
      break;
    case 'llm_end':
      console.log('LLM response:', data.output);
      break;
    case 'error':
      console.error('Error:', data.error);
      break;
  }
};

// Send a message
ws.send(JSON.stringify({
  type: 'execute',
  agentId: 'default',
  content: 'Create a new file named example.txt'
}));
```

## Adding New Tools

1. Create a new tool implementation:

```typescript
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const customTool = new DynamicStructuredTool({
  name: "custom_tool",
  description: "Description of your tool",
  schema: z.object({
    param1: z.string().describe("Parameter description"),
    param2: z.number().describe("Parameter description")
  }),
  func: async ({ param1, param2 }) => {
    // Tool implementation
    return "Result";
  }
});
```

2. Register the tool:

```typescript
import { customTool } from './tools/customTool';

const agent = await createAgent({
  tools: [...defaultTools, customTool],
  verbose: true
});
```

## Monitoring and Debugging

1. Access logs:
```bash
npm run logs
```

2. View metrics:
```bash
npm run metrics
```

3. Debug mode:
```bash
DEBUG=langchain* npm run dev
```

## Common Issues and Solutions

1. **LLM API Rate Limits**
   - Implement retry logic
   - Use token bucket rate limiting
   - Cache responses when possible

2. **Memory Management**
   - Monitor Redis memory usage
   - Implement TTL for cached items
   - Use streaming for large responses

3. **Vector Store Performance**
   - Index optimization
   - Query optimization
   - Proper embedding strategies

## Best Practices

1. **Error Handling**
   - Always use try-catch blocks
   - Implement proper error types
   - Log errors with context

2. **Testing**
   - Write unit tests for tools
   - Test agent interactions
   - Mock LLM responses

3. **Security**
   - Validate all inputs
   - Implement rate limiting
   - Use proper authentication

## Next Steps

1. Review the architecture documentation
2. Explore the example implementations
3. Set up your development environment
4. Try creating a custom agent
5. Implement your first tool
6. Join the community discussions

## Getting Help

- GitHub Issues
- Documentation
- Community Discord
- Stack Overflow tag: `langchain-agent`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

Remember to follow the code style guidelines and include proper documentation for your changes.