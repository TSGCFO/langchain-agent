# Contributing to LangChain Agent

First off, thank you for considering contributing to LangChain Agent! It's people like you that make this project such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* Use a clear and descriptive title
* Describe the exact steps which reproduce the problem
* Provide specific examples to demonstrate the steps
* Describe the behavior you observed after following the steps
* Explain which behavior you expected to see instead and why
* Include any error messages or logs

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* Use a clear and descriptive title
* Provide a step-by-step description of the suggested enhancement
* Provide specific examples to demonstrate the steps
* Describe the current behavior and explain which behavior you expected to see instead
* Explain why this enhancement would be useful

### Pull Requests

* Fork the repo and create your branch from `main`
* If you've added code that should be tested, add tests
* If you've changed APIs, update the documentation
* Ensure the test suite passes
* Make sure your code lints
* Issue that pull request!

## Development Process

1. Clone the repository
```bash
git clone https://github.com/yourusername/langchain-agent.git
cd langchain-agent
```

2. Install dependencies
```bash
npm install
```

3. Create a branch
```bash
git checkout -b feature/your-feature-name
```

4. Make your changes and commit them
```bash
git add .
git commit -m "Description of your changes"
```

5. Push to your fork
```bash
git push origin feature/your-feature-name
```

### Development Environment

* Node.js (v18 or higher)
* TypeScript
* Redis server (for development)

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Style

* We use ESLint and Prettier for code formatting
* Run `npm run lint` to check your code
* Run `npm run lint:fix` to automatically fix issues

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

## Documentation

* Update documentation for any changed functionality
* Add JSDoc comments for all public APIs
* Update README.md if necessary
* Add examples for new features

## Testing Guidelines

1. Write unit tests for all new code
2. Maintain test coverage above 80%
3. Test edge cases and error conditions
4. Use meaningful test descriptions
5. Mock external dependencies

## Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

## Pull Request Process

1. Update the README.md with details of changes if needed
2. Update the documentation with details of any changes to the interface
3. The PR must pass all CI/CD checks
4. You may merge the PR once you have the sign-off of at least one other developer

## Release Process

1. Update the version number in package.json
2. Update CHANGELOG.md with the changes
3. Create a new GitHub release with the version number
4. Tag the release in git
5. Push to npm registry

## Questions?

* Feel free to open an issue for any questions
* Join our Discord community
* Check the documentation wiki

Thank you for your contributions!