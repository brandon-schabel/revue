import { useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import { useDirectoryContents, useInvalidateDirectoryContents } from './api/use-list-directories';
import type { Directory } from '../../types/types';

interface UseDirectoryNavigationResult {
  currentPath: string;
  pathParts: string[];
  directories: Directory[];
  isLoading: boolean;
  error: unknown;
  navigateToPath: (path: string) => void;
  navigateUp: () => void;
  navigateForward: () => void;
  navigateBack: () => void;
  canNavigateForward: boolean;
  canNavigateBack: boolean;
  navigateHome: () => void;
}


const pathUtils = {
  isAbsolute: (path: string): boolean => path.startsWith('/'),

  normalize: (path: string): string => {
    const parts = path.split('/').filter(Boolean);
    const result = [];
    for (const part of parts) {
      if (part === '..') {
        result.pop();
      } else if (part !== '.') {
        result.push(part);
      }
    }
    return `/${result.join('/')}`;
  },

  join: (...paths: string[]): string => {
    return pathUtils.normalize(paths?.join('/'));
  }
};


export function useDirectoryNavigation({ username }: { username: string }): UseDirectoryNavigationResult {
  const initialPath = `/Users/${username}`;

  const [currentPath, setCurrentPath] = useLocalStorage<string>('currentPath', initialPath);
  const [history, setHistory] = useLocalStorage<string[]>('pathHistory', [initialPath]);
  const [historyIndex, setHistoryIndex] = useLocalStorage<number>('historyIndex', 0);

  const { data: directoriesApi, isLoading, error } = useDirectoryContents({ path: currentPath });
  const invalidateDirectory = useInvalidateDirectoryContents();


  const navigateToPath = useCallback((newPath: string) => {
    console.log({ newPath })
    let fullPath: string;
    if (pathUtils.isAbsolute(newPath)) {
      // If it's an absolute path, use it directly
      fullPath = pathUtils.normalize(newPath);
    } else {
      // If it's a relative path, join it with the current path
      fullPath = pathUtils.normalize(pathUtils?.join(currentPath, newPath));
    }

    setCurrentPath(fullPath);
    // @ts-ignore
    setHistory(prev => [...prev.slice(0, historyIndex + 1), fullPath]);
    // @ts-ignore
    setHistoryIndex(prev => prev + 1);
    invalidateDirectory();
  }, [currentPath, setCurrentPath, setHistory, historyIndex, setHistoryIndex, invalidateDirectory]);


  const navigateUp = useCallback(() => {
    const upPath = pathUtils.normalize(`${currentPath}/..`);
    navigateToPath(upPath);
  }, [currentPath, navigateToPath]);

  const navigateForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      // @ts-ignore
      setHistoryIndex(prev => prev + 1);
      setCurrentPath(history[historyIndex + 1]);
      invalidateDirectory();
    }
  }, [history, historyIndex, setHistoryIndex, setCurrentPath, invalidateDirectory]);

  const navigateBack = useCallback(() => {
    if (historyIndex > 0) {
      // @ts-ignore
      setHistoryIndex(prev => prev - 1);
      setCurrentPath(history[historyIndex - 1]);
      invalidateDirectory();
    }
  }, [history, historyIndex, setHistoryIndex, setCurrentPath, invalidateDirectory]);

  const navigateHome = useCallback(() => {
    navigateToPath(initialPath);
  }, [navigateToPath, initialPath]);

  const pathParts = currentPath.split('/').filter(Boolean);

  return {
    currentPath,
    pathParts,
    directories: directoriesApi?.directories || [],
    isLoading,
    error,
    navigateToPath,
    navigateUp,
    navigateForward,
    navigateBack,
    canNavigateForward: historyIndex < history.length - 1,
    canNavigateBack: historyIndex > 0,
    navigateHome,
  };
}