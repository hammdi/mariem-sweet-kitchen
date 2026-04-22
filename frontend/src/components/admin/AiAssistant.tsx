import { useState, useRef, useEffect } from 'react'
import { toast } from 'react-toastify'
import api from '../../services/api'
import {
  Box, Typography, TextField, IconButton, Paper, Fab, Fade, Avatar,
} from '@mui/material'
import { Close, Send, AutoAwesome } from '@mui/icons-material'

interface Message {
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
}

const AiAssistant = ({ page }: { page?: string }) => {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'Bonjour Mariem ! Je suis ton assistant. Pose-moi une question ou demande de l\'aide.', timestamp: new Date() }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pulse, setPulse] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Stop pulsing after first open
  useEffect(() => {
    if (open) setPulse(false)
  }, [open])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMsg: Message = { role: 'user', text: input.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await api.post('/ai/chat', {
        message: userMsg.text,
        context: { page },
      })
      const reply = res.data.data?.reply || 'Desolee, je n\'ai pas pu repondre.'
      setMessages(prev => [...prev, { role: 'assistant', text: reply, timestamp: new Date() }])
    } catch {
      toast.error('L\'assistant IA est indisponible')
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Oups, je suis temporairement indisponible. Reessaye dans un moment.',
        timestamp: new Date()
      }])
    }
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Bouton flottant */}
      <Fab
        onClick={() => setOpen(!open)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          bgcolor: open ? '#666' : '#f1770a',
          color: 'white',
          '&:hover': { bgcolor: open ? '#555' : '#e25a05' },
          animation: pulse ? 'pulse-glow 2s ease-in-out infinite' : 'none',
          '@keyframes pulse-glow': {
            '0%, 100%': { boxShadow: '0 0 0 0 rgba(241, 119, 10, 0.4)' },
            '50%': { boxShadow: '0 0 0 15px rgba(241, 119, 10, 0)' },
          },
        }}
      >
        {open ? <Close /> : <AutoAwesome />}
      </Fab>

      {/* Chat panel */}
      <Fade in={open}>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 90,
            right: 24,
            width: { xs: 'calc(100% - 32px)', sm: 380 },
            maxHeight: { xs: '70vh', sm: 500 },
            zIndex: 9998,
            borderRadius: 3,
            display: open ? 'flex' : 'none',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box sx={{
            bgcolor: '#f1770a', color: 'white', px: 2, py: 1.5,
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 36, height: 36 }}>
              <AutoAwesome sx={{ fontSize: 20 }} />
            </Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                Assistant Mariem
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {loading ? 'reflechit...' : 'en ligne'}
              </Typography>
            </Box>
          </Box>

          {/* Messages */}
          <Box sx={{
            flex: 1, overflowY: 'auto', px: 2, py: 1.5,
            display: 'flex', flexDirection: 'column', gap: 1,
            bgcolor: '#fafafa',
            maxHeight: { xs: '50vh', sm: 340 },
          }}>
            {messages.map((msg, i) => (
              <Box key={i} sx={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
              }}>
                <Paper
                  elevation={0}
                  sx={{
                    px: 1.5, py: 1,
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
                <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, fontSize: '0.6rem' }}>
                  {msg.timestamp.toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
            ))}
            {loading && (
              <Box sx={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                <Paper elevation={0} sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: 'white', border: '1px solid #e0e0e0' }}>
                  <Typography variant="body2" sx={{
                    '@keyframes dots': {
                      '0%': { content: '"."' },
                      '33%': { content: '".."' },
                      '66%': { content: '"..."' },
                    },
                    '&::after': {
                      content: '"..."',
                      animation: 'dots 1.5s steps(3, end) infinite',
                    }
                  }}>
                    En train de reflechir
                  </Typography>
                </Paper>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input */}
          <Box sx={{
            px: 1.5, py: 1, borderTop: '1px solid #e0e0e0', bgcolor: 'white',
            display: 'flex', gap: 1, alignItems: 'center',
          }}>
            <TextField
              fullWidth size="small" placeholder="Posez une question..."
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              multiline maxRows={3}
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
  )
}

export default AiAssistant
