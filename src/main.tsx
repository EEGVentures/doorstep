import { DEMO } from './demo'; // must stay first: patches fetch for the preview build only
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles.css';
import { AuthProvider } from './lib/auth';
import Layout from './components/Layout';
import Discover from './pages/Discover';
import EventPage from './pages/EventPage';
import PartnerLink from './pages/PartnerLink';
import Join from './pages/Join';
import Wallet from './pages/Wallet';
import Account from './pages/Account';
import SignIn from './pages/SignIn';
import Ops from './pages/Ops';
import Legal from './pages/Legal';
import Press from './pages/Press';
import { Empty } from './components/ui';
import { DemoBar } from './components/DemoBar';

const router = (DEMO ? createMemoryRouter : createBrowserRouter)([{
  element: <Layout />,
  children: [
    { path: '/', element: <Discover /> },
    { path: '/events/:slug', element: <EventPage /> },
    { path: '/go/:code', element: <PartnerLink /> },
    { path: '/join', element: <Join /> },
    { path: '/wallet', element: <Wallet /> },
    { path: '/account', element: <Account /> },
    { path: '/signin', element: <SignIn /> },
    { path: '/ops', element: <Ops /> },
    { path: '/legal/:doc', element: <Legal /> },
    { path: '/press', element: <Press /> },
    { path: '*', element: <Empty title="Wrong door">That page doesn’t exist. Head back to what’s on near you.</Empty> },
  ],
}]);

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <AuthProvider>{DEMO && <DemoBar />}<RouterProvider router={router} /></AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
