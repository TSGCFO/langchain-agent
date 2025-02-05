import { config } from 'dotenv';
import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { createAgentSystem } from './core/agents';
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

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

// Initialize agent system
async function initializeAgentSystem() {
  try {
    console.log('Initializing agent system...');
    
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
      modelName: "claude-3-opus-20240229",
      temperature: 0
    });

    console.log('Creating agent system...');
    const system = await createAgentSystem({
      model,
      retriever: vectorStore.asRetriever()
    });
    console.log('Agent system initialized successfully');
    
    return system;
  } catch (error) {
    console.error('Failed to initialize agent system:', error);
    throw error;
  }
}

// Socket.IO connection handling
io.on('connection', async (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  console.log('Client connected');

  try {
    const agentSystem = await initializeAgentSystem();
    console.log('Agent system ready for client');

    socket.on('command', async (command: string) => {
      try {
        console.log('Received command:', command);
        
        // Execute command using agent system
        const result = await agentSystem.executeTask(command);
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
        
        // Execute query using agent system
        const result = await agentSystem.query(query);
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

    socket.on('disconnect', async () => {
      console.log('Client disconnected');
      await agentSystem.shutdown();
    });
  } catch (error) {
    console.error('Error initializing agent system:', error);
    socket.emit('error', {
      message: 'Failed to initialize agent system'
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
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});