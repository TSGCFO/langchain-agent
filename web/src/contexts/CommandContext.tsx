import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface CommandContextType {
  connected: boolean;
  sendCommand: (command: string) => Promise<void>;
  lastResponse: string | null;
}

const CommandContext = createContext<CommandContextType | undefined>(undefined);

interface CommandProviderProps {
  children: ReactNode;
}

export function CommandProvider({ children }: CommandProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:4000', {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    // Response handlers
    newSocket.on('command_response', (response: any) => {
      console.log('Received command response:', response);
      setLastResponse(JSON.stringify(response));
    });

    newSocket.on('query_response', (response: string) => {
      console.log('Received query response:', response);
      setLastResponse(response);
    });

    newSocket.on('error', (error: Error) => {
      console.error('Socket error:', error);
      setLastResponse(`Error: ${error.message}`);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, []);

  const sendCommand = async (command: string) => {
    if (!socket || !connected) {
      throw new Error('Not connected to server');
    }

    return new Promise<void>((resolve, reject) => {
      // Set up a one-time response handler
      const responseHandler = (response: any) => {
        resolve();
      };

      const errorHandler = (error: Error) => {
        reject(error);
      };

      // Send the command
      socket.emit('command', command);

      // Listen for response
      socket.once('command_response', responseHandler);
      socket.once('error', errorHandler);

      // Clean up handlers after 30 seconds (timeout)
      setTimeout(() => {
        socket.off('command_response', responseHandler);
        socket.off('error', errorHandler);
        reject(new Error('Command timed out'));
      }, 30000);
    });
  };

  const value = {
    connected,
    sendCommand,
    lastResponse,
  };

  return (
    <CommandContext.Provider value={value}>
      {children}
    </CommandContext.Provider>
  );
}

export function useCommand() {
  const context = useContext(CommandContext);
  if (context === undefined) {
    throw new Error('useCommand must be used within a CommandProvider');
  }
  return context;
}

export default CommandContext;