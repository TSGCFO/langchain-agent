import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface CommandResponse {
  analysis?: {
    reasoning?: string;
    toolName?: string;
    parameters?: Record<string, unknown>;
  };
  result?: unknown;
  status?: string;
  error?: string;
}

interface CommandContextType {
  connected: boolean;
  sendCommand: (command: string) => Promise<CommandResponse>;
}

const CommandContext = createContext<CommandContextType | undefined>(undefined);

interface CommandProviderProps {
  children: ReactNode;
}

export function CommandProvider({ children }: CommandProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

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

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, []);

  const sendCommand = async (command: string): Promise<CommandResponse> => {
    if (!socket || !connected) {
      throw new Error('Not connected to server');
    }

    return new Promise((resolve, reject) => {
      // Set up response handlers
      const handleResponse = (response: CommandResponse) => {
        socket.off('command_response', handleResponse);
        socket.off('error', handleError);
        resolve(response);
      };

      const handleError = (error: { message: string }) => {
        socket.off('command_response', handleResponse);
        socket.off('error', handleError);
        reject(new Error(error.message));
      };

      // Send command and listen for response
      socket.emit('command', command);
      socket.once('command_response', handleResponse);
      socket.once('error', handleError);

      // Set timeout
      setTimeout(() => {
        socket.off('command_response', handleResponse);
        socket.off('error', handleError);
        reject(new Error('Command timed out'));
      }, 30000);
    });
  };

  const value = {
    connected,
    sendCommand,
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