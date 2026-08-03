import React, { useState, useEffect, memo } from 'react';
import Weather from './components/Weather';
import OfficeMap from './floorplan/OfficeMap';
import Carousel from './components/Carousel';
import AlertBanner from './components/AlertBanner';
import ErrorBoundary from './components/ErrorBoundary';
import LoopingVideo from './components/LoopingVideo';
import { startWeatherPolling } from './weather/metForecast';
import {Heading2, LeadParagraph} from "@entur/typography";
import {Contrast} from "@entur/layout";
import {base} from "@entur/tokens";
import {SunCloudIcon, MapIcon} from "@entur/icons";

// Hardcoded location for Bergen
const LOCATION = { name: 'Bergen', lat: 60.39299, lng: 5.32415 };

// Memoized component for staff image and headings
const StaffAndHeadings = memo(function StaffAndHeadings({ randomStaffImage, greeting }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            {randomStaffImage && (
                <img src={randomStaffImage} alt="Staff" style={{ maxHeight: '18vh', maxWidth: '40%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
            )}
            <div style={{ marginLeft: '2rem' }}>
                <Heading2>Velkommen til Entur Bergen</Heading2>
                <LeadParagraph>{greeting}</LeadParagraph>
            </div>
        </div>
    );
});

function App() {
    const [randomStaffImage, setRandomStaffImage] = useState(null);
    const [greeting, setGreeting] = useState(() => getGreetingText(new Date()));
    const [weather, setWeather] = useState(null);

    // Værvarselet hentes her, ikke i Weather: karusellen rendrer bare den
    // aktive sliden, så Weather avmonteres og remonteres omtrent hvert 60.
    // sekund. App står montert hele tiden, så pollingen holder seg innenfor
    // det MET sine vilkår ber om.
    useEffect(() => startWeatherPolling({ location: LOCATION, onData: setWeather }), []);


    // Greeting, staff image, and date logic (set on mount and every 15 minutes)
    useEffect(() => {
        function updateAll() {
            const staffImages = ['/staff_woman.svg', '/staff_man.svg'];
            const randomImage = staffImages[Math.floor(Math.random() * staffImages.length)];
            setRandomStaffImage(randomImage);
            setGreeting(getGreetingText(new Date()));
        }
        updateAll(); // set immediately on mount
        const interval = setInterval(updateAll, 15 * 60 * 1000); // every 15 minutes
        return () => clearInterval(interval);
    }, []);


    // Helper to get greeting text based on time and day
    function getGreetingText(date) {
        const hour = date.getHours();
        const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
        // Friday logic
        if (day === 5 && hour >= 6) {
            return "Vi håper du får en strålende helg!";
        }
        // Weekend logic (Saturday or Sunday, or Monday before 06:00)
        if (day === 6 || day === 0 || (day === 1 && hour < 6)) {
            return "Vi håper du får en strålende helg!";
        }
        // Morning
        if (hour >= 6 && hour < 10) {
            return "God morgen, vi ønsker deg en fin dag på kontoret!";
        }
        // Day
        if (hour >= 10 && hour < 14) {
            return "Entur gjør det enklere å reise kollektivt i hele Norge!";
        }
        // Afternoon/evening
        if (hour >= 14) {
            return "Vel hjem. Håper du får en fin kveld!";
        }
        // Default
        return "Vi ønsker deg en fin dag på kontoret!";
    }

    return (
        <div className="app" style={{ minHeight: '100vh', minWidth: '100vw', width: '100vw', height: '100vh', boxSizing: 'border-box', margin: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <LoopingVideo src="/entur.mp4" style={{ width: '100vw', height: '40vh', display: 'block', objectFit: 'cover', backgroundColor: base.light.baseColors.frame.contrast }} />
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
            */}
            <Contrast style={{ width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', backgroundColor: base.light.baseColors.frame.contrast, flexDirection: 'column', padding: '1.5rem 0', maxHeight: '45vh', overflow: 'hidden' }}>
                <ErrorBoundary>
                    <AlertBanner />
                </ErrorBoundary>
                <StaffAndHeadings randomStaffImage={randomStaffImage} greeting={greeting} />
            </Contrast>
            <Carousel
                slides={[
                    { key: 'weather', Icon: SunCloudIcon, node: <Weather weather={weather} /> },
                    { key: 'map', Icon: MapIcon, node: <OfficeMap /> },
                ]}
            />
        </div>
    );
}

export default App;
