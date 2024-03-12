import { QueryClient, QueryClientProvider, QueryKey } from '@tanstack/react-query'
import api from  './api'
import GameApp from './GameApp'

const defaultQueryFn = async ({ queryKey: [url] }: { queryKey: QueryKey }) => {
  const res = await api.get(url as string).res()
  const data = await res.json()
  return data
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn
    }
  }
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GameApp />
    </QueryClientProvider>
  )
}

export default App
