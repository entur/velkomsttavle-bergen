import React, { useState, useEffect } from 'react';
import Weather from './components/Weather';
import {Heading} from "@entur/typography/beta";
import {Contrast} from "@entur/layout";

function App() {
    // Hardcoded location for Bergen
    const LOCATION = { name: 'Bergen', lat: 60.39299, lng: 5.32415 };
    const [randomStaffImage, setRandomStaffImage] = useState(null);

    // Staff image logic
    useEffect(() => {
        const staffImages = ['/staff_woman.svg', '/staff_man.svg'];
        const randomImage = staffImages[Math.floor(Math.random() * staffImages.length)];
        setRandomStaffImage(randomImage);
    }, []);

    return (
        <div className="app" style={{ minHeight: '100vh', minWidth: '100vw', width: '100vw', height: '100vh', boxSizing: 'border-box', margin: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <video src="https://image2url.com/r2/default/videos/1768552271901-e3f8da21-1c51-4edb-ba4f-b18fa5ee5237.mp4" autoPlay loop muted style={{ width: '100vw', height: 'auto', display: 'block', maxHeight: '40vh', objectFit: 'cover' }} />
            <Contrast style={{ flex: 1, width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#181C56' }}>
                <img src={randomStaffImage} alt="Staff" style={{ maxHeight: '90%', maxWidth: '90%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
                <div>
                    <Heading as="h1" variant="title-1">Velkommen til Entur Bergen</Heading>
                    <Heading as="h2" variant="title-2">Vi ønsker deg en fin dag på kontoret!</Heading>
                </div>
            </Contrast>
            <Weather location={LOCATION} />
        </div>
    );
}

export default App;
