import wretch from 'wretch'

const API_URL = import.meta.env.DUST_API_URL || 'http://localhost:8080'
const api = wretch(API_URL)

export default api
