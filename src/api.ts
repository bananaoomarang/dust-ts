import wretch from 'wretch'
import QueryStringAddon from "wretch/addons/queryString"

const API_URL = import.meta.env.PROD ? 'https://dust-server.fly.dev' : 'http://localhost:8080'
const api = wretch(API_URL).addon(QueryStringAddon)

export default api
