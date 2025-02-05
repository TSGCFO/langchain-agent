import { BaseAgent, AgentConfig, AgentError } from './BaseAgent';
import { Message, MessageType, Priority } from '../bus/types';
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Document } from "@langchain/core/documents";
import { BaseRetriever } from "@langchain/core/retrievers";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

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
  private chain: RunnableSequence;
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
    this.systemPrompt = config.systemPrompt || 
      'You are a helpful AI assistant that answers questions based on the provided context.';
    
    this.chain = this.createChain();
  }

  private createChain(): RunnableSequence {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', this.systemPrompt],
      new MessagesPlaceholder('chat_history'),
      ['human', 'Context: {context}\n\nQuestion: {question}'],
    ]);

    return RunnableSequence.from([
      {
        question: (input: RAGRequest) => input.query,
        context: async (input: RAGRequest) => {
          if (input.context) return input.context;

          const docs = await this.retriever.getRelevantDocuments(input.query);
          return this.formatDocuments(docs, input.maxDocuments || 3);
        },
        chat_history: () => this.context.messages
      },
      prompt,
      this.model,
      new StringOutputParser()
    ]);
  }

  private formatDocuments(docs: Document[], maxDocs: number): string {
    return docs
      .slice(0, maxDocs)
      .map((doc, i) => `[${i + 1}] ${doc.pageContent}`)
      .join('\n\n');
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

      // Generate response
      const response = await this.chain.invoke(request);

      // Add to context
      this.addToContext(new HumanMessage(request.query));
      this.addToContext(new AIMessage(response));

      // Send response
      await this.sendMessage(
        MessageType.RAG_RESPONSE,
        {
          query: request.query,
          response,
          metadata: {
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
      if (error instanceof Error) {
        throw new AgentError(`Failed to add documents: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Clear the context history
   */
  public clearContext(): void {
    this.context.messages = [];
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

    return await this.chain.invoke(request);
  }
}