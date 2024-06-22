import { useState } from 'react'
import { useStartIndexImages } from './utils/data-utils/index-images'
import { useFiles } from './utils/data-utils/image-data'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const queryClient = new QueryClient()
import './index.css'
import { Input } from '@ui/input'
import { Button } from '@ui/button'
import { Label } from '@ui/label'
import { DataTable } from './components/file-table'
import { useTableControl } from './components/table-controller'
import { fileTableColumns } from './utils/file-table-config'
import { useFindDuplicateImages } from './utils/data-utils/duplicate-images'
import { useClearFilesIndex } from './utils/data-utils/clear-files-index'
import { LoaderCircle } from 'lucide-react'

function App() {
  const [path, setPath] = useState("/Users/brandon/Programming/image-manager/indexing-test")
  const files = useFiles()
  const startIndexingMutation = useStartIndexImages()
  const findDuplicateImages = useFindDuplicateImages()
  const clearIndex = useClearFilesIndex()


  console.log({
    duplicates: findDuplicateImages.data
  })

  const tableController = useTableControl({
    columns: fileTableColumns,
    data: files.data || [],
  })



  return (
    <>
      <div className="card">

        <Label htmlFor='path'>Path</Label>
        <Input id="path" value={path} onChange={e => setPath(e.target.value)} />
        <Button onClick={() => startIndexingMutation.mutate(path)}>
          {startIndexingMutation.status === 'pending' ? <LoaderCircle className="animate-spin" /> : "Index"}
          Index</Button>
        <Button onClick={() => clearIndex.mutate()}>Clear Index</Button>


        <div>
          {findDuplicateImages.data &&
            <pre>
              {
                JSON.stringify(findDuplicateImages.data, null, 2)
              }
            </pre>}
        </div>
      </div>


      <div>
        Files: {files.data?.length}
      </div>
      <div className='overflow-y-auto'>
        <DataTable table={tableController} />
      </div>

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
