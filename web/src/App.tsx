import { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';
import Layout from './components/Layout/Layout';
import CommandInterface from './components/CommandInterface/CommandInterface';
import { CommandProvider, useCommand } from './contexts/CommandContext';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

// Main content component that uses the command context
function MainContent() {
  const { connected, sendCommand, lastResponse } = useCommand();
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // Handle responses from the server
  useEffect(() => {
    if (lastResponse) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: typeof lastResponse === 'string' ? lastResponse : JSON.stringify(lastResponse, null, 2)
      }]);
    }
  }, [lastResponse]);

  const handleCommand = async (command: string) => {
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: command }]);

    try {
      // Send command through WebSocket
      await sendCommand(command);
    } catch (error) {
      // Add error message
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
    }
  };

  return (
    <Layout>
      <CommandInterface
        messages={messages}
        onSubmit={handleCommand}
        connected={connected}
      />
    </Layout>
  );
}

// Main App component wrapped with providers
function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <CommandProvider>
        <MainContent />
      </CommandProvider>
    </ThemeProvider>
  );
}

export default App;
