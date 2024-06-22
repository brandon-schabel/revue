import { useState } from 'react'
import { useStartIndexImages } from './utils/data-utils/index-images'
import { useFiles } from './utils/data-utils/image-data'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { Input } from '@ui/input'
import { Button } from '@ui/button'
import { Label } from '@ui/label'
import { DataTable } from './components/file-table'
import { useTableControl } from './components/table-controller'
import { fileTableColumns } from './utils/file-table-config'
import { useFindDuplicateFiles } from './utils/data-utils/find-duplicate-files'
import { useClearFilesIndex } from './utils/data-utils/clear-files-index'
import { LoaderCircle } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/tabs"
import { DuplicateFilesList } from './components/duplicate-files-list'

const queryClient = new QueryClient()

function App() {
  const [path, setPath] = useState("/Users/brandon/Programming/image-manager/indexing-test")
  const files = useFiles()
  const startIndexingMutation = useStartIndexImages()
  const findDuplicateImages = useFindDuplicateFiles()
  const clearIndex = useClearFilesIndex()

  const tableController = useTableControl({
    columns: fileTableColumns,
    data: files.data || [],
  })

  const handleDuplicateDelete = () => {
    findDuplicateImages.refetch();
  };

  return (
    <div className="container mx-auto p-4">
      <div className="card mb-4">
        <Label htmlFor='path'>Path</Label>
        <Input id="path" value={path} onChange={e => setPath(e.target.value)} />
        <Button onClick={() => startIndexingMutation.mutate(path)} className="mr-2">
          {startIndexingMutation.status === 'pending' ? <LoaderCircle className="animate-spin" /> : "Index"}
        </Button>
        <Button onClick={() => clearIndex.mutate()}>Clear Index</Button>
      </div>

      <Tabs defaultValue="indexed">
        <TabsList>
          <TabsTrigger value="indexed">Indexed Files</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicate Files</TabsTrigger>
        </TabsList>
        <TabsContent value="indexed">
          <div>
            Files: {files.data?.length}
          </div>
          <div className='overflow-y-auto'>
            <DataTable table={tableController} />
          </div>
        </TabsContent>
        <TabsContent value="duplicates">
          <div>
            {findDuplicateImages.data ? (
              <DuplicateFilesList
                duplicates={findDuplicateImages.data}
                onDelete={handleDuplicateDelete}
              />
            ) : (
              <p>No duplicate files found.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
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