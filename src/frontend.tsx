/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode, useCallback, useEffect, useState } from 'react';

import { createRoot } from 'react-dom/client';

import './index.css';

import { ThemeProvider } from '@contexts/theme/provider';
import {
  getAppRoute,
  getAppRoutePath,
  type AppRoute
} from '@helpers/atoms-app-route';
import {
  loadStoredBoardSetups,
  saveStoredBoardSetups,
  type BoardSetup
} from '@helpers/atoms-board-setup';

import { BoardSetupsScreen } from './screens/board-setups';
import { Main } from './screens/main';

const basePath = (
  import.meta as ImportMeta & {
    readonly env?: { readonly BUN_PUBLIC_BASE_PATH?: string };
  }
).env?.BUN_PUBLIC_BASE_PATH;

const getRoute = (): AppRoute =>
  getAppRoute(window.location.pathname, basePath);

const App = () => {
  const [route, setRoute] = useState<AppRoute>(() => getRoute());
  const [savedBoardSetups, setSavedBoardSetups] = useState<BoardSetup[]>(() =>
    loadStoredBoardSetups(window.localStorage)
  );
  const [pendingBoardSetupId, setPendingBoardSetupId] = useState<string | null>(
    null
  );

  useEffect(() => {
    saveStoredBoardSetups(window.localStorage, savedBoardSetups);
  }, [savedBoardSetups]);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getRoute());
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigate = useCallback((nextRoute: AppRoute) => {
    const path = getAppRoutePath(nextRoute, basePath);
    window.history.pushState(null, '', path);
    setRoute(nextRoute);
  }, []);

  return route === 'setups' ? (
    <BoardSetupsScreen
      onBack={() => {
        navigate('match');
      }}
      onSaveBoardSetups={setSavedBoardSetups}
      onUseInNewMatch={setupId => {
        setPendingBoardSetupId(setupId);
        navigate('match');
      }}
      savedBoardSetups={savedBoardSetups}
    />
  ) : (
    <Main
      onManageBoardSetups={() => {
        navigate('setups');
      }}
      onPendingBoardSetupConsumed={() => {
        setPendingBoardSetupId(null);
      }}
      pendingBoardSetupId={pendingBoardSetupId}
      savedBoardSetups={savedBoardSetups}
    />
  );
};

const elem = document.getElementById('root')!;
const app = (
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);

if (import.meta.hot) {
  // With hot module reloading, `import.meta.hot.data` is persisted.
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  // The hot module reloading API is not available in production.
  createRoot(elem).render(app);
}
