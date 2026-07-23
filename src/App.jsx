import React, { useState, useEffect, memo } from 'react';
import Weather from './components/Weather';
import OfficeMap from './floorplan/OfficeMap';
import {Heading2, LeadParagraph} from "@entur/typography";
import {Contrast} from "@entur/layout";
import {base} from "@entur/tokens";

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
    // Hardcoded location for Bergen
    const LOCATION = { name: 'Bergen', lat: 60.39299, lng: 5.32415 };
    const [randomStaffImage, setRandomStaffImage] = useState(null);
    const [greeting, setGreeting] = useState(() => getGreetingText(new Date()));
    const [date, setDate] = useState(new Date());


    // Greeting, staff image, and date logic (set on mount and every 15 minutes)
    useEffect(() => {
        function updateAll() {
            const staffImages = ['/staff_woman.svg', '/staff_man.svg'];
            const randomImage = staffImages[Math.floor(Math.random() * staffImages.length)];
            setRandomStaffImage(randomImage);
            const now = new Date();
            setGreeting(getGreetingText(now));
            setDate(now);
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
            <video src="/entur.mp4" autoPlay loop muted playsInline preload="auto" style={{ width: '100vw', height: 'auto', display: 'block', maxHeight: '40vh', objectFit: 'cover' }} />
            <Contrast style={{ width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: base.light.baseColors.frame.contrast, flexDirection: 'column', padding: '1.5rem 0' }}>
                <StaffAndHeadings randomStaffImage={randomStaffImage} greeting={greeting} />
            </Contrast>
            <OfficeMap />
            <Weather location={LOCATION} date={date} />
        </div>
    );
}

export default App;
