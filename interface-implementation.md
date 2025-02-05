# Interface Implementation

## 1. API Layer

### Express Server Setup with LangChain Integration

```typescript
// src/api/server.ts
import express from 'express';
import { AgentExecutor } from "langchain/agents";
import { CallbackManager } from "langchain/callbacks";
import { setupMonitoring } from '../monitoring/setup';

export class APIServer {
  private app: express.Application;
  private agents: Map<string, AgentExecutor>;
  private callbackManager: CallbackManager;

  constructor() {
    this.app = express();
    this.agents = new Map();
    this.callbackManager = setupMonitoring();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(cors());
    this.app.use(this.requestLogger);
  }

  private setupRoutes(): void {
    this.app.post('/api/chat', this.handleChat.bind(this));
    this.app.post('/api/agents/:agentId/execute', this.handleAgentExecution.bind(this));
    this.app.get('/api/agents/:agentId/status', this.handleAgentStatus.bind(this));
    this.app.post('/api/rag/query', this.handleRAGQuery.bind(this));
  }

  private async handleChat(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { message, agentId } = req.body;
      const agent = this.agents.get(agentId);
      
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      const result = await agent.invoke({
        input: message,
        callbacks: this.callbackManager
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  private async handleAgentExecution(req: express.Request, res: express.Response): Promise<void> {
    // Implementation
  }

  private async handleAgentStatus(req: express.Request, res: express.Response): Promise<void> {
    // Implementation
  }

  private async handleRAGQuery(req: express.Request, res: express.Response): Promise<void> {
    // Implementation
  }
}
```

## 2. WebSocket Implementation

### Real-time Communication

```typescript
// src/websocket/WebSocketServer.ts
import { WebSocket, WebSocketServer } from 'ws';
import { AgentExecutor } from "langchain/agents";
import { BaseCallbackHandler } from "langchain/callbacks";

class WebSocketHandler extends BaseCallbackHandler {
  constructor(private ws: WebSocket) {
    super();
  }

  async handleLLMStart(): Promise<void> {
    this.ws.send(JSON.stringify({
      type: 'llm_start',
      timestamp: Date.now()
    }));
  }

  async handleLLMEnd(output: any): Promise<void> {
    this.ws.send(JSON.stringify({
      type: 'llm_end',
      output,
      timestamp: Date.now()
    }));
  }

  async handleChainEnd(outputs: Record<string, any>): Promise<void> {
    this.ws.send(JSON.stringify({
      type: 'chain_end',
      outputs,
      timestamp: Date.now()
    }));
  }
}

export class AgentWebSocketServer {
  private wss: WebSocketServer;
  private agents: Map<string, AgentExecutor>;

  constructor(server: any) {
    this.wss = new WebSocketServer({ server });
    this.agents = new Map();
    this.setupWebSocket();
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message);
          await this.handleWebSocketMessage(ws, data);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            error: error.message
          }));
        }
      });
    });
  }

  private async handleWebSocketMessage(ws: WebSocket, data: any): Promise<void> {
    const { type, agentId, content } = data;
    const agent = this.agents.get(agentId);

    if (!agent) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Agent not found'
      }));
      return;
    }

    const wsHandler = new WebSocketHandler(ws);
    
    switch (type) {
      case 'execute':
        await agent.invoke({
          input: content,
          callbacks: [wsHandler]
        });
        break;
      
      case 'status':
        ws.send(JSON.stringify({
          type: 'status',
          status: 'active',
          timestamp: Date.now()
        }));
        break;
      
      default:
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Unknown message type'
        }));
    }
  }
}
```

## 3. Integration with Frontend

### React Component Example

```typescript
// src/frontend/components/AgentChat.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Message } from '../types';

export const AgentChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:3000');
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'llm_end':
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: data.output
          }]);
          break;
        
        case 'error':
          console.error('WebSocket error:', data.error);
          break;
      }
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;

    setMessages(prev => [...prev, {
      role: 'user',
      content: input
    }]);

    ws.current?.send(JSON.stringify({
      type: 'execute',
      agentId: 'default',
      content: input
    }));

    setInput('');
  };

  return (
    <div>
      <div className="messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            {message.content}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};
```

## 4. Server Integration

### Combined Server Setup

```typescript
// src/server.ts
import express from 'express';
import http from 'http';
import { APIServer } from './api/server';
import { AgentWebSocketServer } from './websocket/WebSocketServer';

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Initialize API server
  const apiServer = new APIServer();
  app.use(apiServer.getRouter());

  // Initialize WebSocket server
  new AgentWebSocketServer(server);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(console.error);
```

## Implementation Notes

1. Use LangChain's callback system for real-time updates
2. Implement proper error handling and reconnection logic
3. Add authentication and authorization
4. Implement rate limiting
5. Add request validation
6. Set up monitoring and logging
7. Implement proper TypeScript types
8. Add comprehensive documentation

## Security Considerations

1. WebSocket authentication
2. Input validation
3. Rate limiting
4. CORS configuration
5. Token validation
6. Request sanitization
7. Error message security
8. Connection limits

## Testing Strategy

1. API endpoint testing
2. WebSocket connection testing
3. Real-time update testing
4. Error handling testing
5. Load testing
6. Security testing
7. Integration testing
8. End-to-end testing