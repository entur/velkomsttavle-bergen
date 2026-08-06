import { useState, useEffect } from 'react';
import Weather from './components/Weather';
import OfficeMap from './floorplan/OfficeMap';
import Carousel from './components/Carousel';
import AlertBanner from './components/AlertBanner';
import ErrorBoundary from './components/ErrorBoundary';
import TopBand from './components/TopBand';
import Greeting from './components/Greeting';
import OpeningHours from './components/OpeningHours';
import BoardMissing from './components/BoardMissing';
import { startWeatherPolling } from './weather/metForecast';
import { subscribeToBoard } from './boards/boardsRepository';
import { GREETING_AUTO, boardHeading, findModule } from './boards/boardConfig';
import { DEFAULT_BOARD_ID } from './routing/parseRoute';
import { Heading2 } from '@entur/typography';
import { Contrast } from '@entur/layout';
import { base } from '@entur/tokens';
import { SunCloudIcon, MapIcon } from '@entur/icons';

const STAFF_IMAGES = ['/staff_woman.svg', '/staff_man.svg'];
const GREETING_REFRESH_MS = 15 * 60 * 1000;

function App({ boardId = DEFAULT_BOARD_ID }) {
    const [board, setBoard] = useState({ status: 'loading' });
    const [weather, setWeather] = useState(null);
    const [staffImage, setStaffImage] = useState(STAFF_IMAGES[0]);
    const [autoGreeting, setAutoGreeting] = useState(() => getGreetingText(new Date()));

    useEffect(() => subscribeToBoard(
        boardId,
        (config) => setBoard(config ? { status: 'ready', config } : { status: 'missing' }),
        (error) => {
            console.error('Kunne ikke hente tavla', error);
            setBoard({ status: 'missing' });
        },
    ), [boardId]);

    // Illustrasjon og hilsen byttes hvert 15. minutt, uavhengig av configen.
    useEffect(() => {
        function updateAll() {
            setStaffImage(STAFF_IMAGES[Math.floor(Math.random() * STAFF_IMAGES.length)]);
            setAutoGreeting(getGreetingText(new Date()));
        }
        updateAll();
        const interval = setInterval(updateAll, GREETING_REFRESH_MS);
        return () => clearInterval(interval);
    }, []);

    const config = board.status === 'ready' ? board.config : null;
    const weatherModule = config ? findModule(config.carousel, 'weather') : undefined;

    // Avhengighetene er tall, ikke modul-objektet. onSnapshot gir et nytt objekt
    // for hver eneste oppdatering av tavle-dokumentet, og et objekt her ville
    // startet pollingen på nytt — altså et nytt kall til api.met.no — hver gang
    // noen lagret i admin. MET sine vilkår ber om det motsatte.
    const lat = weatherModule ? weatherModule.lat : null;
    const lng = weatherModule ? weatherModule.lng : null;

    // Pollingen ligger her, ikke i Weather: karusellen rendrer bare den aktive
    // sliden, så Weather avmonteres og remonteres omtrent hvert minutt.
    useEffect(() => {
        if (lat === null || lng === null) {
            return undefined;
        }
        return startWeatherPolling({ location: { lat, lng }, onData: setWeather });
    }, [lat, lng]);

    if (board.status === 'loading') {
        return null;
    }
    if (board.status === 'missing') {
        return <BoardMissing boardId={boardId} />;
    }

    const slides = config.carousel.map((module) => {
        if (module.type === 'weather') {
            return {
                key: 'weather',
                Icon: SunCloudIcon,
                node: <ErrorBoundary><Weather weather={weather} /></ErrorBoundary>,
            };
        }
        if (module.type === 'floorplan') {
            return {
                key: 'floorplan',
                Icon: MapIcon,
                node: <ErrorBoundary><OfficeMap /></ErrorBoundary>,
            };
        }
        return null;
    }).filter(Boolean);

    const hasCarousel = slides.length > 0;
    const hasGreeting = Boolean(findModule(config.middle, 'greeting'));

    return (
        <div className="app" style={{ minHeight: '100vh', minWidth: '100vw', width: '100vw', height: '100vh', boxSizing: 'border-box', margin: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <TopBand kind={config.top.kind} />
            {/*
              justifyContent: 'flex-start' er bevisst, ikke 'center'. Feltet har
              maxHeight + overflow: hidden, så noe MÅ klippes bort når stacken
              (varsler + hilsen) er høyere enn 45vh. Med 'center' klippes det
              symmetrisk fra begge kanter, og siden selectVisibleAlerts sorterer
              alvorligste varsel øverst, er det nettopp det alvorligste varselet
              som forsvinner over den øvre kanten først. Med 'flex-start' klippes
              det i stedet nedenfra: hilsenen og de minst alvorlige varslene
              lengst ned ryker først, og prioritert rekkefølge bevares. Ikke
              endre denne tilbake til 'center'.

              Uten karusell-moduler får feltet plassen karusellen ellers hadde
              hatt (flex: 1 i stedet for maxHeight), men klippes fortsatt nedenfra.
            */}
            <Contrast style={{
                width: '100vw',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                backgroundColor: base.light.baseColors.frame.contrast,
                flexDirection: 'column',
                padding: '1.5rem 0',
                overflow: 'hidden',
                ...(hasCarousel ? { maxHeight: '45vh' } : { flex: 1, minHeight: 0 }),
            }}>
                <ErrorBoundary>
                    <AlertBanner />
                </ErrorBoundary>
                {/* Overskriften skal alltid stå der. Har tavla en hilsen, eier
                    den overskriften; ellers står den alene. */}
                {!hasGreeting && <Heading2>{boardHeading(config.placeName)}</Heading2>}
                {config.middle.map((module) => (
                    <ErrorBoundary key={module.type}>
                        {module.type === 'greeting' ? (
                            <Greeting
                                heading={boardHeading(config.placeName)}
                                text={module.text === GREETING_AUTO ? autoGreeting : module.text}
                                staffImageSrc={module.staffImage ? staffImage : null}
                            />
                        ) : (
                            <OpeningHours days={module.days} />
                        )}
                    </ErrorBoundary>
                ))}
            </Contrast>
            {hasCarousel && <Carousel slides={slides} />}
        </div>
    );
}

// Hilsenen som følger klokka og ukedagen.
function getGreetingText(date) {
    const hour = date.getHours();
    const day = date.getDay(); // 0 = søndag, 1 = mandag, ..., 5 = fredag, 6 = lørdag
    if (day === 5 && hour >= 6) {
        return 'Vi håper du får en strålende helg!';
    }
    if (day === 6 || day === 0 || (day === 1 && hour < 6)) {
        return 'Vi håper du får en strålende helg!';
    }
    if (hour >= 6 && hour < 10) {
        return 'God morgen, vi ønsker deg en fin dag på kontoret!';
    }
    if (hour >= 10 && hour < 14) {
        return 'Entur gjør det enklere å reise kollektivt i hele Norge!';
    }
    if (hour >= 14) {
        return 'Vel hjem. Håper du får en fin kveld!';
    }
    return 'Vi ønsker deg en fin dag på kontoret!';
}

export default App;
