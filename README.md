# LangChain Multi-Agent System

A sophisticated distributed multi-agent architecture orchestrating specialized agents powered by OpenAI, Anthropic, and Google models. The system enables real-time collaboration, transparent communication flows, and intelligent task routing based on agent capabilities.

## Features

- **Advanced Agent Architecture**
  - Distributed multi-agent system
  - Real-time collaboration between agents
  - Intelligent task routing
  - Fault tolerance and redundancy

- **RAG Implementation**
  - Dynamic knowledge base updates
  - Context-aware retrieval
  - Efficient vector storage
  - Semantic search capabilities

- **Memory Management**
  - Persistent memory with context awareness
  - Short-term and long-term memory systems
  - Efficient caching strategies
  - Memory consolidation

- **Advanced Features**
  - Hallucination detection and mitigation
  - Self-evolving training mechanisms
  - Performance analytics
  - Automated system refinements

## Prerequisites

- Node.js (v18 or higher)
- Redis server
- API Keys:
  - Anthropic (Claude)
  - OpenAI

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/langchain-agent.git
cd langchain-agent
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

## Usage

### Running the Example

```bash
npm run example
```

This will run a demonstration of the system's capabilities, including:
- Task decomposition and execution
- Knowledge retrieval and generation
- Multi-agent collaboration

### Using in Your Project

```typescript
import { createAgentSystem } from 'langchain-agent';

async function main() {
  const system = await createAgentSystem({
    // Optional configuration
    tools: yourCustomTools,
    retriever: yourVectorStore.asRetriever(),
  });

  // Execute a task
  const taskResult = await system.executeTask(
    'Create a file named example.txt with content "Hello, World!"'
  );

  // Query knowledge
  const queryResult = await system.query(
    'What files were created?'
  );

  // Clean up
  await system.shutdown();
}
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Linting

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

### Building

```bash
# Build the project
npm run build

# Clean build output
npm run clean
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
└── utils/             # Shared utilities
```

## Architecture

The system is built on a distributed architecture with the following key components:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Task Agents   │     │    RAG Agents   │     │ Learning Agents │
└───────┬─────────┘     └───────┬─────────┘     └───────┬─────────┘
        │                       │                        │
        ▼                       ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Message Bus                               │
└─────────────────────────────────────────────────────────────────┘
        ▲                       ▲                        ▲
        │                       │                        │
┌───────┴─────────┐     ┌──────┴──────────┐     ┌──────┴──────────┐
│  Tool Registry  │     │  Vector Store   │     │ Memory Manager  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- LangChain team
- OpenAI
- Anthropic
- Contributing developers

## Support

- GitHub Issues
- Documentation Wiki
- Community Discord
- Stack Overflow tag: `langchain-agent`