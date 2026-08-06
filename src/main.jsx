import './css/main.css';
import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import RouteNotFound from './components/RouteNotFound.jsx';
import { parseRoute } from './routing/parseRoute.js';

// Lazy: kiosken skal ikke laste firebase/auth, skjemakomponenter eller
// datovelger den aldri bruker. Én router-avhengighet for fire statiske ruter er
// ikke verdt vekten.
const Admin = lazy(() => import('./admin/Admin.jsx'));

const route = parseRoute(window.location.pathname);

// replaceState, ikke redirect: skjermen i resepsjonen peker fortsatt på «/», og
// den skal ikke laste seg på nytt. URL-en rettes opp i adressefeltet slik at den
// er delbar, uten at noe navigeres.
if (route.canonical) {
    window.history.replaceState(null, '', route.canonical);
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {renderRoute(route)}
    </React.StrictMode>
);

function renderRoute(current) {
    if (current.kind === 'admin' || current.kind === 'adminBoard') {
        return (
            <Suspense fallback={null}>
                <Admin route={current} />
            </Suspense>
        );
    }
    if (current.kind === 'board') {
        return <App boardId={current.boardId} />;
    }
    return <RouteNotFound pathname={current.pathname} />;
}
