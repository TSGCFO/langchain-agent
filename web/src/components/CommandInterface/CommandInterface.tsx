import { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  Paper,
  Typography,
  styled,
} from '@mui/material';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CommandInterfaceProps {
  messages: Message[];
  onSubmit: (command: string) => void;
  connected: boolean;
}

const MessageContainer = styled(Paper)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
}));

const MessageBubble = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isUser',
})<{ isUser?: boolean }>(({ theme, isUser }) => ({
  maxWidth: '80%',
  marginLeft: isUser ? 'auto' : 0,
  marginRight: isUser ? 0 : 'auto',
  marginBottom: theme.spacing(1),
  padding: theme.spacing(1, 2),
  borderRadius: theme.spacing(1),
  backgroundColor: isUser 
    ? theme.palette.primary.main 
    : theme.palette.grey[800],
  color: isUser 
    ? theme.palette.primary.contrastText 
    : theme.palette.text.primary,
}));

function CommandInterface({ messages, onSubmit, connected }: CommandInterfaceProps) {
  const [command, setCommand] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !connected) return;

    const trimmedCommand = command.trim();
    setCommand('');
    onSubmit(trimmedCommand);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: 2,
      }}
    >
      <MessageContainer elevation={3}>
        {messages.map((message, index) => (
          <MessageBubble
            key={index}
            isUser={message.role === 'user'}
          >
            <Typography variant="body1">
              {message.content}
            </Typography>
          </MessageBubble>
        ))}
        <div ref={messagesEndRef} />
      </MessageContainer>

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ width: '100%' }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          variant="outlined"
          placeholder={connected ? "Enter a command..." : "Connecting..."}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={!connected}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'background.paper',
              '&.Mui-disabled': {
                backgroundColor: 'action.disabledBackground',
              },
            },
          }}
        />
      </Box>
    </Box>
  );
}

export default CommandInterface;
