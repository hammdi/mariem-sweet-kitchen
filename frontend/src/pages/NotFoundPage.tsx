import { Button, Container, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowBack } from '@mui/icons-material';
import { motion } from 'framer-motion';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            variant="h1"
            component="h1"
            sx={{
              fontFamily: 'Playfair Display',
              fontWeight: 700,
              fontSize: { xs: '3rem', sm: '4rem', md: '6rem' },
              color: 'primary.main',
              mb: 2,
            }}
          >
            404
          </Typography>

          <Typography
            variant="h4"
            component="h2"
            sx={{
              fontFamily: 'Playfair Display',
              fontWeight: 600,
              color: 'text.primary',
              mb: 2,
            }}
          >
            Page non trouvée
          </Typography>

          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              mb: 4,
              fontSize: '1.1rem',
            }}
          >
            Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Home />}
              onClick={() => navigate('/')}
            >
              Retour à l'accueil
            </Button>

            <Button
              variant="outlined"
              size="large"
              startIcon={<ArrowBack />}
              onClick={() => navigate(-1)}
            >
              Page précédente
            </Button>
          </Box>
        </Box>
      </motion.div>
    </Container>
  );
};

export default NotFoundPage;
