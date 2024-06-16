import { useState } from 'react'
import { useStartIndexImages } from './data-utils/index-images'
import { useFiles } from './data-utils/image-data'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const queryClient = new QueryClient()
import './index.css'
import { Input } from '@ui/input'
import { Button } from '@ui/button'
import { Label } from '@ui/label'
import { DataTable } from './components/file-table'
import { useTableControl } from './components/table-controller'
import { fileTableColumns } from './utils/file-table-config'

function App() {
  const [path, setPath] = useState("/Users/brandon/Programming/image-manager/indexing-test")
  const images = useFiles()
  const startIndexingMutation = useStartIndexImages()

  const tableController = useTableControl({
    columns: fileTableColumns,
    data: images.data || [],
  })



  const triggerIndexing = async () => {
    await startIndexingMutation.mutate(path)
  }


  return (
    <>
      {/* <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div> */}
      <h1>Vite + React</h1>
      <div className="card">
        {/* <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button> */}
        <Label htmlFor='path'>Path</Label>
        <Input id="path" value="/Users/brandon/Programming/image-manager/indexing-test" onChange={e => setPath(e.target.value)} />
        <Button onClick={() => triggerIndexing()}>Index</Button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>

      <div className='max-h-[50vh] overflow-y-auto'>
        <DataTable table={tableController} />
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

const AppWithProviders = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  )
}

export default AppWithProviders
