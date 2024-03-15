import { Route, Switch } from 'wouter'
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
      <Switch>
        <Route path='/'>
          <GameApp />
        </Route>
        <Route path='/levels/:id'>
          {params => <GameApp levelId={params.id} />}
        </Route>

        <Route>404: No such page!</Route>
      </Switch>
    </SWRConfig>
  )
}

export default App
