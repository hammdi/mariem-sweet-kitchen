import { Container, Typography, Box, Grid, Card, CardContent } from '@mui/material'
import { motion } from 'framer-motion'
import { 
  Visibility, 
  Calculate, 
  Security, 
  Support, 
  LocalShipping 
} from '@mui/icons-material'

const WhyChooseUs = () => {
  const features = [
    {
      icon: <Visibility sx={{ fontSize: 50, color: 'primary.main' }} />,
      title: 'Transparence Totale',
      description: 'Chaque coût est détaillé : ingrédients, eau, électricité, et marge de 15%'
    },
    {
      icon: <Calculate sx={{ fontSize: 50, color: 'primary.main' }} />,
      title: 'Calcul Automatique',
      description: 'Les prix se calculent automatiquement selon les prix du marché actuels'
    },
    {
      icon: <Calculate sx={{ fontSize: 50, color: 'primary.main' }} />,
      title: 'Écologique',
      description: 'Consommation d\'eau et d\'électricité optimisée et facturée au juste prix'
    },
    {
      icon: <Security sx={{ fontSize: 50, color: 'primary.main' }} />,
      title: 'Qualité Garantie',
      description: 'Recettes artisanales transmises de génération en génération'
    },
    {
      icon: <Support sx={{ fontSize: 50, color: 'primary.main' }} />,
      title: 'Support Client',
      description: 'Accompagnement personnalisé pour vos commandes'
    },
    {
      icon: <LocalShipping sx={{ fontSize: 50, color: 'primary.main' }} />,
      title: 'Flexibilité',
      description: 'Choisissez entre livraison ou retrait, avec ou sans ingrédients'
    }
  ]

  return (
    <Box sx={{ py: 8, bgcolor: 'primary.50' }}>
      <Container maxWidth="lg">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography
              variant="h2"
              component="h2"
              sx={{
                fontFamily: 'Playfair Display',
                fontWeight: 600,
                color: 'text.primary',
                mb: 2,
              }}
            >
              Pourquoi Choisir Mariem's Kitchen ?
            </Typography>
            <Typography
              variant="h6"
              sx={{
                color: 'text.secondary',
                maxWidth: 600,
                mx: 'auto',
              }}
            >
              Une approche révolutionnaire de la pâtisserie artisanale
            </Typography>
          </Box>
        </motion.div>

        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card
                  sx={{
                    height: '100%',
                    textAlign: 'center',
                    p: 3,
                    transition: 'transform 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-5px)',
                    },
                  }}
                >
                  <CardContent>
                    <Box sx={{ mb: 2 }}>
                      {feature.icon}
                    </Box>
                    <Typography
                      variant="h6"
                      component="h3"
                      sx={{
                        fontWeight: 600,
                        mb: 2,
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
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

export default WhyChooseUs
