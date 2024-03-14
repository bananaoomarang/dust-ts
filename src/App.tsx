import { SWRConfig } from 'swr'
import api from  './api'
import GameApp from './GameApp'

async function defaultFetcher (path: string) {
  const res = await api.get(path).res()
  const data = await res.json()
  return data
}

const swrConfig = {
  fetcher: defaultFetcher
}

function App() {
  return (
    <SWRConfig value={swrConfig}>
      <GameApp />
    </SWRConfig>
  )
}

export default App
