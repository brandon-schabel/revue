import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { useState } from 'react'


type Directory = {
  path: string
}



const handleIndex = (path: string) => {
  const body = JSON.stringify(
    {
      path,
      reindex: true
    }
  )
  return fetch("/index", {
    method: "POST",
    body
  })
}

function App() {
  const [path, setPath] = useState("/Users/brandon/Programming/image-manager/indexing-test")


  const triggerIndexing = async () => {
    const result = await handleIndex(path)


    console.log(await result.json())

  }


  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
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

export default App
