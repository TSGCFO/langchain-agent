import { BaseAgent, AgentConfig, AgentError } from './BaseAgent';
import { Message, MessageType, Priority } from '../bus/types';
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { BaseRetriever } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { generateText } from '../llm/anthropic';

export interface RAGAgentConfig extends AgentConfig {
  retriever: BaseRetriever;
  systemPrompt?: string;
}

interface RAGRequest {
  query: string;
  context?: string;
  maxDocuments?: number;
}

export class RAGAgent extends BaseAgent {
  private retriever: BaseRetriever;
  private systemPrompt: string;

  constructor(config: RAGAgentConfig) {
    super({
      ...config,
      name: config.name || 'RAG Agent',
      description: config.description || 'Retrieval-Augmented Generation Agent',
      messageTypes: [
        ...(config.messageTypes || []),
        MessageType.RAG_REQUEST,
        MessageType.RAG_RESPONSE
      ]
    });

    this.retriever = config.retriever;
    this.systemPrompt = config.systemPrompt || this.getDefaultSystemPrompt();
  }

  private getDefaultSystemPrompt(): string {
    return `You are a knowledgeable assistant that provides accurate and helpful responses based on the given context.
    Always ground your responses in the provided context and be explicit when information might be missing or unclear.
    If the context doesn't contain relevant information, acknowledge this and suggest what additional information might be needed.`;
  }

  protected async processMessage(message: Message): Promise<void> {
    try {
      if (message.type !== MessageType.RAG_REQUEST) {
        throw new AgentError(`Unsupported message type: ${message.type}`);
      }

      const request = message.payload as RAGRequest;
      if (!request.query) {
        throw new AgentError('Query is required for RAG requests');
      }

      // Get relevant documents
      const docs = await this.getRelevantDocuments(request);

      // Generate response
      const response = await this.generateResponse(request.query, docs);

      // Send response
      await this.sendMessage(
        MessageType.RAG_RESPONSE,
        {
          query: request.query,
          response,
          metadata: {
            documentCount: docs.length,
            timestamp: Date.now(),
            correlationId: message.metadata.correlationId
          }
        },
        Priority.MEDIUM,
        message.metadata.correlationId
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new AgentError(`RAG processing failed: ${error.message}`);
      }
      throw error;
    }
  }

  private async getRelevantDocuments(request: RAGRequest): Promise<Document[]> {
    try {
      if (request.context) {
        // If context is provided, create a single document from it
        return [
          new Document({
            pageContent: request.context,
            metadata: { source: 'user-provided' }
          })
        ];
      }

      // Otherwise, retrieve documents using the retriever
      const docs = await this.retriever.getRelevantDocuments(request.query);
      const maxDocs = request.maxDocuments || 3;
      return docs.slice(0, maxDocs);
    } catch (error) {
      throw new AgentError(`Failed to retrieve documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateResponse(query: string, docs: Document[]): Promise<string> {
    try {
      // Format documents into context string
      const context = docs
        .map((doc, i) => `[${i + 1}] ${doc.pageContent}`)
        .join('\n\n');

      // Create messages for the model
      const messages = [
        new SystemMessage(this.systemPrompt),
        new HumanMessage(`Context:\n${context}\n\nQuestion: ${query}`)
      ];

      // Generate response
      return await generateText(this.model, messages);
    } catch (error) {
      throw new AgentError(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add documents to the retriever
   */
  public async addDocuments(documents: Document[]): Promise<void> {
    try {
      if ('addDocuments' in this.retriever) {
        await (this.retriever as any).addDocuments(documents);
      } else {
        throw new AgentError('Retriever does not support adding documents');
      }
    } catch (error) {
      throw new AgentError(`Failed to add documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Direct query method for convenience
   */
  public async query(
    query: string,
    context?: string,
    maxDocuments?: number
  ): Promise<string> {
    const request: RAGRequest = {
      query,
      context,
      maxDocuments
    };

    const docs = await this.getRelevantDocuments(request);
    return await this.generateResponse(query, docs);
  }
}