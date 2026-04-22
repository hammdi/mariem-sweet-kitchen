import { Button, Container, Typography, Box, Grid } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Cake, TrendingUp, LocalShipping } from '@mui/icons-material'

const HeroSection = () => {
  const navigate = useNavigate()

  const features = [
    {
      icon: <Cake sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Recettes Artisanales',
      description: 'Des recettes traditionnelles transmises de génération en génération'
    },
    {
      icon: <TrendingUp sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Prix Transparent',
      description: 'Voir le détail de chaque coût : ingrédients, eau, électricité'
    },
    {
      icon: <LocalShipping sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Livraison Flexible',
      description: 'Choisissez entre livraison ou retrait, avec ou sans ingrédients'
    }
  ]

  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #fef7ee 0%, #fad7a5 100%)',
        py: { xs: 5, md: 12 },
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background decoration */}
      <Box
        sx={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'rgba(241, 119, 10, 0.1)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -100,
          left: -100,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'rgba(14, 165, 233, 0.1)',
        }}
      />

      <Container maxWidth="lg">
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <Typography
                variant="h1"
                component="h1"
                sx={{
                  fontFamily: 'Playfair Display',
                  fontWeight: 700,
                  fontSize: { xs: '1.75rem', sm: '2.25rem', md: '3rem' },
                  color: 'primary.main',
                  mb: 2,
                  lineHeight: 1.2,
                }}
              >
                Mariem's Sweet Kitchen
              </Typography>
              
              <Typography
                variant="h5"
                component="h2"
                sx={{
                  color: 'text.secondary',
                  mb: 3,
                  fontWeight: 400,
                  lineHeight: 1.4,
                }}
              >
                Découvrez nos délicieuses pâtisseries avec un calcul de coûts 
                <strong> 100% transparent</strong>
              </Typography>
              
              <Typography
                variant="body1"
                sx={{
                  color: 'text.secondary',
                  mb: 4,
                  fontSize: '1.1rem',
                  lineHeight: 1.6,
                }}
              >
                Chaque recette affiche le détail de ses coûts : ingrédients, eau, électricité, 
                et marge de 15%. Commandez en toute transparence !
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/recipes')}
                  sx={{
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    borderRadius: 2,
                  }}
                >
                  Découvrir les recettes
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => navigate('/auth/login')}
                  sx={{
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    borderRadius: 2,
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '&:hover': {
                      borderColor: 'primary.dark',
                      backgroundColor: 'primary.50',
                    },
                  }}
                >
                  Espace Admin
                </Button>
              </Box>
            </motion.div>
          </Grid>

          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            >
              <Box
                sx={{
                  position: 'relative',
                  textAlign: 'center',
                }}
              >
                <Box
                  sx={{
                    width: { xs: 200, sm: 300, md: 400 },
                    height: { xs: 200, sm: 300, md: 400 },
                    borderRadius: '50%',
                    background: 'linear-gradient(45deg, #f1770a, #f49332)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    position: 'relative',
                    boxShadow: '0 20px 40px rgba(241, 119, 10, 0.3)',
                  }}
                >
                  <Cake sx={{ fontSize: { xs: 60, sm: 90, md: 120 }, color: 'white' }} />
                </Box>
              </Box>
            </motion.div>
          </Grid>
        </Grid>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <Grid container spacing={4} sx={{ mt: 6 }}>
            {features.map((feature, index) => (
              <Grid item xs={12} md={4} key={index}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
                >
                  <Box
                    sx={{
                      textAlign: 'center',
                      p: 3,
                      borderRadius: 2,
                      backgroundColor: 'rgba(255, 255, 255, 0.7)',
                      backdropFilter: 'blur(10px)',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <Box sx={{ mb: 2 }}>
                      {feature.icon}
                    </Box>
                    <Typography
                      variant="h6"
                      component="h3"
                      sx={{
                        fontWeight: 600,
                        mb: 1,
                        color: 'text.primary',
                      }}
                    >
                      {feature.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        lineHeight: 1.6,
                      }}
                    >
                      {feature.description}
                    </Typography>
                  </Box>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </motion.div>
      </Container>
    </Box>
  )
}

export default HeroSection
