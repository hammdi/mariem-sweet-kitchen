import { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { Box, Typography, TextField, IconButton, Paper, Fade, Avatar } from '@mui/material';
import { Close, Send, AutoAwesome } from '@mui/icons-material';
import { useHelp } from '../../help/HelpContext';
import { color, radius, shadow } from '../../theme/tokens';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

/**
 * Assistant IA (questions libres, réponse écrite). Ouvert depuis le panneau
 * d'aide ✨ ; il ne fait qu'envoyer la question et afficher la réponse.
 */
const AiAssistant = ({ page }: { page?: string }) => {
  const { aiOpen: open, closeAi } = useHelp();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: "Bonjour Mariem ! Je suis ton assistant. Pose-moi une question ou demande de l'aide.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: 'user', text: input.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', {
        message: userMsg.text,
        context: { page },
      });
      const reply = res.data.data?.reply || "Desolee, je n'ai pas pu repondre.";
      setMessages((prev) => [...prev, { role: 'assistant', text: reply, timestamp: new Date() }]);
    } catch {
      toast.error("L'assistant IA est indisponible");
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Oups, je suis temporairement indisponible. Reessaye dans un moment.',
          timestamp: new Date(),
        },
      ]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat panel */}
      <Fade in={open} unmountOnExit>
        <Paper
          role="dialog"
          aria-label="Assistant IA"
          sx={{
            position: 'fixed',
            bottom: { xs: 0, md: 96 },
            right: { xs: 0, md: 24 },
            left: { xs: 0, md: 'auto' },
            width: { xs: '100%', md: 400 },
            maxHeight: { xs: '82vh', md: 540 },
            zIndex: 1260, // sous les fenetres de dialogue (1300)
            borderRadius: { xs: `${radius.xl}px ${radius.xl}px 0 0`, md: `${radius.xl}px` },
            boxShadow: shadow.floating,
            border: `1px solid ${color.border}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              bgcolor: color.primary,
              color: 'white',
              px: 2,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 36, height: 36 }}>
              <AutoAwesome sx={{ fontSize: 20 }} />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                Assistant
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                {loading ? 'réfléchit…' : 'répond à vos questions, ne modifie rien'}
              </Typography>
            </Box>
            <IconButton onClick={closeAi} aria-label="Fermer l'assistant" sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </Box>

          {/* Messages */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              px: 2,
              py: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              bgcolor: '#fafafa',
              maxHeight: { xs: '50vh', sm: 340 },
            }}
          >
            {messages.map((msg, i) => (
              <Box
                key={i}
                sx={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: msg.role === 'user' ? '#f1770a' : 'white',
                    color: msg.role === 'user' ? 'white' : 'text.primary',
                    border: msg.role === 'assistant' ? '1px solid #e0e0e0' : 'none',
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {msg.text}
                  </Typography>
                </Paper>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ px: 0.5, fontSize: '0.6rem' }}
                >
                  {msg.timestamp.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Typography>
              </Box>
            ))}
            {loading && (
              <Box sx={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                <Paper
                  elevation={0}
                  sx={{
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: 'white',
                    border: '1px solid #e0e0e0',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      '@keyframes dots': {
                        '0%': { content: '"."' },
                        '33%': { content: '".."' },
                        '66%': { content: '"..."' },
                      },
                      '&::after': {
                        content: '"..."',
                        animation: 'dots 1.5s steps(3, end) infinite',
                      },
                    }}
                  >
                    En train de reflechir
                  </Typography>
                </Paper>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input */}
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderTop: '1px solid #e0e0e0',
              bgcolor: 'white',
              display: 'flex',
              gap: 1,
              alignItems: 'center',
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder="Posez une question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              multiline
              maxRows={3}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.9rem' },
              }}
            />
            <IconButton
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              sx={{ color: '#f1770a' }}
            >
              <Send />
            </IconButton>
          </Box>
        </Paper>
      </Fade>
    </>
  );
};

export default AiAssistant;
