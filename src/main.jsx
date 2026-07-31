import './css/main.css';
import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Lazy: kiosken skal ikke laste firebase/auth, skjemakomponenter eller
// datovelger den aldri bruker. Én router-avhengighet for to statiske ruter er
// ikke verdt vekten.
const Admin = lazy(() => import('./admin/Admin.jsx'));

const isAdminRoute = window.location.pathname.startsWith('/admin');

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {isAdminRoute ? (
            <Suspense fallback={null}>
                <Admin />
            </Suspense>
        ) : (
            <App />
        )}
    </React.StrictMode>
);
