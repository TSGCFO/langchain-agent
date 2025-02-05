import { RAGAgent, RAGAgentConfig } from '../RAGAgent';
import { MessageBus } from '../../bus/MessageBus';
import { Message, MessageType, Priority } from '../../bus/types';
import { BaseRetriever } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { ChatAnthropic } from "@langchain/anthropic";
import { Runnable } from "@langchain/core/runnables";

// Mock dependencies
jest.mock('../../bus/MessageBus');
jest.mock('@langchain/anthropic');

// Mock retriever implementation
class MockRetriever extends BaseRetriever {
  private documents: Document[] = [];
  lc_namespace = ['test', 'mock'];

  constructor(initialDocs: Document[] = []) {
    super();
    this.documents = initialDocs;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    // Simple mock implementation that returns all documents
    return this.documents;
  }

  async addDocuments(documents: Document[]): Promise<void> {
    this.documents.push(...documents);
  }

  invoke(input: string): Promise<Document[]> {
    return this._getRelevantDocuments(input);
  }
}

describe('RAGAgent', () => {
  let agent: RAGAgent;
  let messageBus: jest.Mocked<MessageBus>;
  let retriever: MockRetriever;
  let mockModel: jest.Mocked<ChatAnthropic>;

  beforeEach(() => {
    messageBus = new MessageBus({ redis: { url: 'mock' } }) as jest.Mocked<MessageBus>;
    retriever = new MockRetriever();
    mockModel = new ChatAnthropic({}) as jest.Mocked<ChatAnthropic>;
    
    // Mock model response
    (mockModel.invoke as jest.Mock).mockResolvedValue('Mocked response');

    const config: RAGAgentConfig = {
      name: 'Test RAG Agent',
      description: 'A test RAG agent',
      tools: [],
      messageBus,
      model: mockModel,
      retriever,
      systemPrompt: 'You are a test assistant'
    };

    agent = new RAGAgent(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', async () => {
      await agent.initialize();

      expect(messageBus.subscribe).toHaveBeenCalledWith(
        MessageType.RAG_REQUEST,
        expect.any(Function)
      );

      expect(messageBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SYSTEM_EVENT,
          payload: expect.objectContaining({
            event: 'agent_initialized',
            agentName: 'Test RAG Agent'
          })
        })
      );
    });
  });

  describe('document management', () => {
    it('should add documents successfully', async () => {
      const docs = [
        new Document({ pageContent: 'Test document 1' }),
        new Document({ pageContent: 'Test document 2' })
      ];

      await agent.addDocuments(docs);

      // Verify documents were added by making a query
      const response = await agent.query('test query');
      expect(mockModel.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.stringContaining('Test document 1')
        })
      );
    });
  });

  describe('query handling', () => {
    it('should process RAG requests correctly', async () => {
      const message: Message = {
        id: '123',
        type: MessageType.RAG_REQUEST,
        payload: {
          query: 'test query'
        },
        metadata: {
          timestamp: Date.now(),
          sender: 'test',
          correlationId: '456',
          priority: Priority.MEDIUM
        }
      };

      await agent.initialize();
      const messageHandler = messageBus.subscribe.mock.calls[0][1];
      await messageHandler(message);

      expect(messageBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.RAG_RESPONSE,
          payload: expect.objectContaining({
            query: 'test query',
            response: expect.any(String)
          })
        })
      );
    });

    it('should handle direct queries', async () => {
      const response = await agent.query('test query');
      
      expect(response).toBe('Mocked response');
      expect(mockModel.invoke).toHaveBeenCalled();
    });

    it('should use provided context when available', async () => {
      const customContext = 'Custom context information';
      await agent.query('test query', customContext);

      expect(mockModel.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          context: customContext
        })
      );
    });

    it('should respect maxDocuments parameter', async () => {
      const docs = [
        new Document({ pageContent: 'Doc 1' }),
        new Document({ pageContent: 'Doc 2' }),
        new Document({ pageContent: 'Doc 3' }),
        new Document({ pageContent: 'Doc 4' }),
      ];

      await agent.addDocuments(docs);
      await agent.query('test query', undefined, 2);

      const context = (mockModel.invoke as jest.Mock).mock.calls[0][0].context;
      const docCount = (context.match(/\[\d+\]/g) || []).length;
      expect(docCount).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should handle retriever errors', async () => {
      const mockError = new Error('Retriever error');
      jest.spyOn(retriever, '_getRelevantDocuments').mockRejectedValue(mockError);

      const message: Message = {
        id: '123',
        type: MessageType.RAG_REQUEST,
        payload: { query: 'test query' },
        metadata: {
          timestamp: Date.now(),
          sender: 'test',
          correlationId: '456',
          priority: Priority.MEDIUM
        }
      };

      await agent.initialize();
      const messageHandler = messageBus.subscribe.mock.calls[0][1];
      
      await messageHandler(message);

      expect(messageBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SYSTEM_EVENT,
          payload: expect.objectContaining({
            event: 'agent_error'
          })
        })
      );
    });

    it('should handle invalid message types', async () => {
      const message: Message = {
        id: '123',
        type: MessageType.TASK_REQUEST, // Wrong message type
        payload: { query: 'test query' },
        metadata: {
          timestamp: Date.now(),
          sender: 'test',
          correlationId: '456',
          priority: Priority.MEDIUM
        }
      };

      await agent.initialize();
      const messageHandler = messageBus.subscribe.mock.calls[0][1];
      
      await messageHandler(message);

      expect(messageBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.SYSTEM_EVENT,
          payload: expect.objectContaining({
            event: 'agent_error',
            error: expect.stringContaining('Unsupported message type')
          })
        })
      );
    });
  });

  describe('context management', () => {
    it('should maintain chat history', async () => {
      await agent.query('first query');
      await agent.query('second query');

      expect(mockModel.invoke).toHaveBeenCalledTimes(2);
      const secondCall = (mockModel.invoke as jest.Mock).mock.calls[1][0];
      expect(secondCall.chat_history.length).toBe(2);
    });

    it('should clear context when requested', async () => {
      await agent.query('test query');
      agent.clearContext();

      await agent.query('another query');
      const secondCall = (mockModel.invoke as jest.Mock).mock.calls[1][0];
      expect(secondCall.chat_history.length).toBe(0);
    });
  });
});