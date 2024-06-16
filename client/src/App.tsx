import './App.css'
import { useState } from 'react'
import { useStartIndexImages } from './data-utils/index-images'
import { useImages } from './data-utils/image-data'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'



const queryClient = new QueryClient()



function App() {
  const [path, setPath] = useState("/Users/brandon/Programming/image-manager/indexing-test")
  const images = useImages()
  const startIndexingMutation = useStartIndexImages()


  console.log({ images })


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
        <label htmlFor='path'>Path</label>
        <input id="path" value="/Users/brandon/Programming/image-manager/indexing-test" onChange={e => setPath(e.target.value)} />
        <button onClick={() => triggerIndexing()}>Index</button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
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
