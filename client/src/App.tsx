import { useFiles } from "./utils/hooks/api/use-files";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { Button } from "@ui/button";
import { ControlledTable } from "./components/controlled-table";
import { useTableControl } from "./utils/hooks/use-table-control";
import { fileTableColumns } from "./utils/file-table-config";
import { useFindDuplicateFiles } from "./utils/hooks/api/use-find-duplicate-files";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/tabs";
import { DuplicateFilesList } from "./components/duplicate-files-list";
import { useDirectoryNavigation } from "./utils/hooks/use-directory-navigation";
import React from "react";
import { useDirectoryContents } from "./utils/hooks/api/use-list-directories";
import type { Directory, FileInfo } from "./types/types";
import { useClearFilesIndex } from "./utils/hooks/api/use-clear-files-index";
import { useStartIndexFiles } from "./utils/hooks/api/use-index-files";
import { useListDrives } from "./utils/hooks/api/use-list-drives";
import { ImageGrid } from "./components/image-grid";

const queryClient = new QueryClient();

function App() {
  const {
    currentPath,
    pathParts,
    navigateToPath,
    navigateUp,
    navigateForward,
    navigateBack,
    canNavigateForward,
    canNavigateBack,
    navigateHome
  } = useDirectoryNavigation(
    {
      username: "brandon"
    }

  );

  const { data: contents } = useDirectoryContents({ path: currentPath });
  const files = useFiles();
  const findDuplicateImages = useFindDuplicateFiles();
  const { mutate: startIndexing, status: indexingStatus } = useStartIndexFiles();
  const { mutate: clearIndex, status: clearStatus } = useClearFilesIndex();
  const { data: drives } = useListDrives();

  const handleStartIndexing = () => {
    startIndexing(currentPath);
  };

  const handleClearIndex = () => {
    if (window.confirm("Are you sure you want to clear the entire index? This action cannot be undone.")) {
      clearIndex();
    }
  };

  const tableController = useTableControl({
    columns: fileTableColumns,
    data: files.data || [],
  });

  const handleDuplicateDelete = () => {
    findDuplicateImages.refetch();
  };

  const isIndexing = indexingStatus === "pending";
  const isClearing = clearStatus === "pending";

  return (
    <div className="container mx-auto p-4">
      <Tabs defaultValue="navigation">
        <TabsList>
          <TabsTrigger value="navigation">Navigation</TabsTrigger>
          <TabsTrigger value="indexed">Indexed Files</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicate Files</TabsTrigger>
          <TabsTrigger value="image-grid">Image Grid</TabsTrigger>
        </TabsList>
        <TabsContent value="navigation">
          <div className="card mb-4">
            <h2 className="text-lg font-semibold mb-2">Drives</h2>
            <div className="flex flex-wrap gap-2">
              {drives?.map((drive) => (
                <Button
                  key={drive.path}
                  onClick={() => navigateToPath(drive.path)}
                  variant="outline"
                  className="p-2"
                >
                  {drive.path} ({drive.fstype})
                </Button>
              ))}
            </div>
          </div>
          <div className="card mb-4">
            <div className="flex items-center mb-2">
              <Button
                onClick={navigateBack}
                disabled={!canNavigateBack}
                className="mr-2"
              >
                Back
              </Button>
              <Button
                onClick={navigateForward}
                disabled={!canNavigateForward}
                className="mr-2"
              >
                Forward
              </Button>
              <Button onClick={navigateUp} className="mr-2">
                Up
              </Button>
              <Button onClick={navigateHome} className="mr-2">
                Home
              </Button>
            </div>
            <div className="flex items-center mt-4">
              <Button
                onClick={handleStartIndexing}
                disabled={isIndexing}
                className="mr-2"
              >
                {isIndexing ? "Indexing..." : "Index Current Directory"}
              </Button>
              <Button
                onClick={handleClearIndex}
                disabled={isClearing}
                variant="destructive"
                className="mr-2"
              >
                {isClearing ? "Clearing..." : "Clear Index"}
              </Button>
            </div>
            <div className="flex items-center flex-wrap">
              {pathParts?.map((part, index) => (
                <React.Fragment key={part}>
                  <Button
                    onClick={() =>
                      navigateToPath(`/${pathParts.slice(0, index + 1)?.join("/")}`)
                    }
                    variant="link"
                    className="p-1"
                  >
                    {part}
                  </Button>
                  {index < pathParts.length - 1 && <span>/</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="card mb-4">
            <h2 className="text-lg font-semibold mb-2">Directories</h2>
            <div className="flex flex-wrap gap-2">
              {contents?.directories?.map((dir: Directory) => (
                <Button
                  key={dir.path}
                  onClick={() => navigateToPath(dir.path)}
                  variant="outline"
                  className="p-2"
                >
                  {dir.name}
                </Button>
              ))}
            </div>
          </div>
          <div className="card mb-4">
            <h2 className="text-lg font-semibold mb-2">Files</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {contents?.files?.map((file: FileInfo) => (
                <div key={file.path} className="p-2 border rounded">
                  <p className="font-semibold">{file.name}</p>
                  <p>Size: {file.size} bytes</p>
                  <p>Last Modified: {new Date(file.lastModified).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="indexed">
          <div>Files: {files.data?.length}</div>
          <div className="overflow-y-auto">
            <ControlledTable table={tableController} />
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
        <TabsContent value="image-grid">
          <ImageGrid />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const AppWithProviders = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
};

export default AppWithProviders;