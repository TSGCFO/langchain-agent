# LangChain Agent System

A distributed multi-agent system with advanced learning capabilities, built with LangChain.

## Features

- **Intelligent Task Decomposition**: Breaks down complex tasks into manageable subtasks
- **Advanced Learning System**: Continuously learns and improves from interactions
- **Comprehensive Logging**: Tracks all interactions for analysis and training
- **Performance Monitoring**: Real-time monitoring and analysis of system performance
- **Automated Training**: Tools for preparing fine-tuning datasets
- **CLI Management**: Easy-to-use command line interface for system management

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/langchain-agent.git
cd langchain-agent

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys
```

## Environment Variables

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
```

## Usage

### Starting the System

```bash
# Start the development server
npm run dev

# Or start production server
npm start
```

### Using the CLI

The system comes with a command-line interface for management:

```bash
# Check system status
npm run cli status

# Run system analysis
npm run cli analyze --days 7

# Prepare training data
npm run cli train --min-samples 200

# Run monitoring cycle
npm run cli monitor

# Initialize system
npm run cli init
```

### CLI Options

- `status`: Check system health and get recommendations
- `analyze`: Generate analysis report
  - `--days <number>`: Number of days to analyze (default: 30)
- `train`: Prepare training data
  - `--min-samples <number>`: Minimum samples per tool (default: 100)
  - `--success-rate <number>`: Minimum success rate (default: 0.9)
  - `--max-samples <number>`: Maximum samples per tool (default: 1000)
- `monitor`: Run a monitoring cycle
- `init`: Initialize the system

## Learning System

The system includes a comprehensive learning pipeline:

1. **Interaction Logging**: All agent interactions are logged with detailed metadata
2. **Performance Analysis**: Regular analysis of tool usage and success rates
3. **Pattern Recognition**: Identifies successful interaction patterns
4. **Training Data Preparation**: Automatically prepares fine-tuning datasets
5. **Continuous Improvement**: Uses insights to improve tool selection and reasoning

### Log Analysis

The system analyzes logs to generate insights about:

- Tool usage patterns and success rates
- Common reasoning patterns
- Performance metrics
- Areas needing improvement

### Training Data Generation

Training data is prepared in multiple formats:

- Anthropic Claude format
- OpenAI GPT format
- Raw interaction data

## Monitoring

The system includes real-time monitoring:

- Performance metrics tracking
- Error detection and logging
- Health checks
- Usage statistics
- Automated recommendations

## Directory Structure

```
src/
├── core/
│   ├── agents/      # Agent implementations
│   ├── logging/     # Logging system
│   ├── llm/         # LLM integrations
│   └── system/      # Core system components
├── scripts/
│   ├── analyze-logs.ts  # Log analysis tools
│   ├── cli.ts          # CLI interface
│   ├── manage.ts       # System management
│   ├── monitor.ts      # Monitoring system
│   └── train.ts        # Training data preparation
└── server.ts       # Main server
```

## Development

```bash
# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- LangChain for the excellent framework
- Anthropic and OpenAI for their powerful LLMs
- All contributors to this project