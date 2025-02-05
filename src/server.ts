import { config } from 'dotenv';
import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { createAgentSystem } from './core/agents';
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { MessageBus } from './core/bus/MessageBus';
import { systemTools } from './tools/systemTools';

// Load environment variables
config();

// Verify required environment variables
const requiredEnvVars = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

interface ServerToClientEvents {
  command_response: (response: any) => void;
  query_response: (response: string) => void;
  error: (error: { message: string }) => void;
}

interface ClientToServerEvents {
  command: (command: string) => void;
  query: (query: string) => void;
  disconnect: () => void;
}

// Define the type for our agent system
type AgentSystem = {
  executeTask: (command: string) => Promise<any>;
  query: (query: string) => Promise<string>;
  shutdown: () => Promise<void>;
};

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Vite dev server
    methods: ["GET", "POST"]
  }
});

// Enable CORS for REST endpoints
app.use(cors());
app.use(express.json());

// Create shared instances that will be used across all connections
// This is more efficient than creating new instances for each connection
const sharedMessageBus = new MessageBus();
let sharedAgentSystem: AgentSystem | null = null;

// Initialize the shared system components
async function initializeSharedSystem(): Promise<AgentSystem> {
  if (sharedAgentSystem) {
    return sharedAgentSystem;
  }

  try {
    console.log('Initializing shared system components...');
    
    // Initialize the shared message bus
    await sharedMessageBus.initialize();
    
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const vectorStore = await MemoryVectorStore.fromTexts(
      ['Initial knowledge base entry'],
      [{ source: 'initialization' }],
      embeddings
    );

    const model = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      modelName: "claude-3-5-sonnet-20241022",
      temperature: 0
    });

    console.log('Creating shared agent system...');
    sharedAgentSystem = await createAgentSystem({
      model,
      retriever: vectorStore.asRetriever(),
      messageBus: sharedMessageBus,
      tools: systemTools
    });
    console.log('Shared system components initialized successfully');
    
    return sharedAgentSystem;
  } catch (error) {
    console.error('Failed to initialize shared system:', error);
    throw error;
  }
}

// Socket.IO connection handling
io.on('connection', async (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  console.log('Client connected');

  try {
    // Use the shared agent system for this connection
    const system = await initializeSharedSystem();
    console.log('Using shared agent system for client');

    socket.on('command', async (command: string) => {
      try {
        console.log('Received command:', command);
        
        // Execute command using shared agent system
        const result = await system.executeTask(command);
        console.log('Command result:', result);
        
        // Send response back to client
        socket.emit('command_response', result);
      } catch (error) {
        console.error('Error executing command:', error);
        socket.emit('error', {
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    });

    socket.on('query', async (query: string) => {
      try {
        console.log('Received query:', query);
        
        // Execute query using shared agent system
        const result = await system.query(query);
        console.log('Query result:', result);
        
        // Send response back to client
        socket.emit('query_response', result);
      } catch (error) {
        console.error('Error executing query:', error);
        socket.emit('error', {
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
      // No need to shut down the shared system when a client disconnects
    });
  } catch (error) {
    console.error('Error setting up client connection:', error);
    socket.emit('error', {
      message: 'Failed to initialize connection'
    });
    socket.disconnect();
  }
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, async () => {
  try {
    // Initialize shared system components before accepting connections
    await initializeSharedSystem();
    console.log(`Server running on port ${PORT}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
});