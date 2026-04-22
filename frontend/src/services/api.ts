import axios from 'axios'
import toast from 'react-hot-toast'

// Configuration de base d'axios
const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Intercepteur pour gérer les réponses
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Gestion des erreurs HTTP
    if (error.response) {
      const { status, data } = error.response

      switch (status) {
        case 401:
          // Token expiré ou invalide
          localStorage.removeItem('token')
          window.location.href = '/auth/login'
          toast.error('Session expirée. Veuillez vous reconnecter.')
          break
        case 403:
          toast.error('Accès refusé')
          break
        case 404:
          toast.error('Ressource non trouvée')
          break
        case 422:
          // Erreurs de validation
          if (data.errors && Array.isArray(data.errors)) {
            data.errors.forEach((err: any) => {
              toast.error(err.message)
            })
          } else {
            toast.error(data.message || 'Erreur de validation')
          }
          break
        case 500:
          toast.error('Erreur serveur. Veuillez réessayer plus tard.')
          break
        default:
          toast.error(data.message || 'Une erreur est survenue')
      }
    } else if (error.request) {
      // Erreur de réseau
      toast.error('Erreur de connexion. Vérifiez votre connexion internet.')
    } else {
      // Autres erreurs
      toast.error('Une erreur inattendue est survenue')
    }

    return Promise.reject(error)
  }
)

export default api
