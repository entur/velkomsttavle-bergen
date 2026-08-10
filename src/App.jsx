import { useState, useEffect } from 'react';
import Weather from './components/Weather';
import OfficeMap from './floorplan/OfficeMap';
import Carousel from './components/Carousel';
import ErrorBoundary from './components/ErrorBoundary';
import TopBand from './components/TopBand';
import MiddleBand from './components/MiddleBand';
import BoardMissing from './components/BoardMissing';
import Departures from './components/Departures';
import { startWeatherPolling } from './weather/metForecast';
import { startDeparturePolling } from './departures/enturDepartures';
import { subscribeToBoard } from './boards/boardsRepository';
import { GREETING_AUTO, boardHeading, findModule } from './boards/boardConfig';
import { DEFAULT_BOARD_ID } from './routing/parseRoute';
import { surfacePalette } from './boards/surfaces';

const STAFF_IMAGES = ['/staff_woman.svg', '/staff_man.svg'];
const GREETING_REFRESH_MS = 15 * 60 * 1000;

function App({ boardId = DEFAULT_BOARD_ID }) {
    const [board, setBoard] = useState({ status: 'loading' });
    const [weather, setWeather] = useState(null);
    const [departures, setDepartures] = useState(null);
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
    const carouselPalette = config ? surfacePalette(config.carouselSurface) : null;
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

    // Samme mønster som været: avhengigheten er en streng, ikke modul-objektet.
    // onSnapshot gir et nytt objekt for hver oppdatering av tavla, og et objekt
    // her ville startet pollingen på nytt hver gang noen lagret i admin.
    const departuresModule = config ? findModule(config.carousel, 'departures') : undefined;
    const stopPlaceId = departuresModule ? departuresModule.stopPlaceId : null;

    // Pollingen ligger her, ikke i Departures: karusellen rendrer bare den
    // aktive sliden, så komponenten avmonteres og remonteres hver gang sliden
    // kommer tilbake.
    useEffect(() => {
        if (stopPlaceId === null) {
            return undefined;
        }
        setDepartures(null);
        return startDeparturePolling({ stopPlaceId, onData: setDepartures });
    }, [stopPlaceId]);

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
                node: <ErrorBoundary><Weather weather={weather} palette={carouselPalette} /></ErrorBoundary>,
            };
        }
        if (module.type === 'floorplan') {
            return {
                key: 'floorplan',
                node: <ErrorBoundary><OfficeMap palette={carouselPalette} /></ErrorBoundary>,
            };
        }
        if (module.type === 'departures') {
            return {
                key: 'departures',
                node: (
                    <ErrorBoundary>
                        <Departures
                            departures={departures}
                            stopPlaceName={module.stopPlaceName}
                            palette={carouselPalette}
                        />
                    </ErrorBoundary>
                ),
            };
        }
        return null;
    }).filter(Boolean);

    const hasCarousel = slides.length > 0;
    const greeting = findModule(config.middle, 'greeting');
    const openingHours = findModule(config.middle, 'openingHours');

    return (
        <div className="app" style={{ minHeight: '100vh', minWidth: '100vw', width: '100vw', height: '100vh', boxSizing: 'border-box', margin: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <TopBand kind={config.top.kind} theme={config.theme} />
            <MiddleBand
                theme={config.theme}
                boardId={boardId}
                heading={boardHeading(config.placeName)}
                greetingText={greetingTextFrom(greeting, autoGreeting)}
                openingHoursDays={openingHours ? openingHours.days : null}
                staffImageSrc={config.staffImage ? staffImage : null}
                hasCarousel={hasCarousel}
            />
            {hasCarousel && <Carousel slides={slides} palette={carouselPalette} />}
        </div>
    );
}

/** Hilsenen slik den skal stå på skjermen, eller null når tavla ikke har noen. */
function greetingTextFrom(greeting, autoGreeting) {
    if (!greeting) {
        return null;
    }
    return greeting.text === GREETING_AUTO ? autoGreeting : greeting.text;
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
