import { useState } from 'react';
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
  const { connected, sendCommand } = useCommand();
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const handleCommand = async (command: string) => {
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: command }]);

    try {
      // Send command through WebSocket
      const result = await sendCommand(command);
      
      // Format the response
      let responseContent = '';
      if (typeof result === 'string') {
        responseContent = result;
      } else if (result?.analysis?.reasoning) {
        // Include both reasoning and result if available
        const parts = [
          result.analysis.reasoning,
          result.result ? 
            (typeof result.result === 'string' ? 
              result.result : 
              JSON.stringify(result.result, null, 2)
            ) : ''
        ].filter(Boolean);
        responseContent = parts.join('\n\n');
      } else if (result?.result) {
        responseContent = typeof result.result === 'string' ? 
          result.result : 
          JSON.stringify(result.result, null, 2);
      } else {
        responseContent = JSON.stringify(result, null, 2);
      }

      // Add assistant message
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: responseContent
      }]);
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
