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

//
// TODO: wouter basepath option not playing nicely with gh pages
//
function getPath (path: string): string {
  const base = import.meta.env.PROD ? '/dust-ts' : ''
  return base + path
}

function App() {
  return (
    <SWRConfig value={swrConfig}>
      <Switch>
        <Route path={getPath('/')}>
          <GameApp />
        </Route>
        <Route path={getPath('/levels/:id')}>
          {(params: { id: string }) => <GameApp levelId={params.id} />}
        </Route>

        <Route>404: No such page!</Route>
      </Switch>
    </SWRConfig>
  )
}

export default App
