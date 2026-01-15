import React, { useState, useEffect } from 'react';
import Weather from './components/Weather';

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
        <div className="app">
            <video src="/entur.mp4" autoPlay loop muted style={{ width: '100%', height: 'auto', display: 'block' }} />

            <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#181C56' }}>
                <img src={randomStaffImage} alt="Staff" style={{ maxHeight: '90vh', maxWidth: '90vw', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
            </div>


            <Weather location={LOCATION} />
        </div>
    );
}

export default App;
