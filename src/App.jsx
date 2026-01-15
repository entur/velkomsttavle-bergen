import React, { useState, useEffect } from 'react';

import './App.css';
import logo from '../static/logo.svg';
import staffWoman from '../static/staff_woman.svg';
import staffMan from '../static/staff_man.svg';
import { Tooltip } from '@entur/tooltip';
import Weather from './components/Weather';

// Helper functions (converted to JS)
async function _fetch(url) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' }
        });
        return await response.json();
    } catch (error) {
        console.log(error);
        return null;
    }
}

async function getYr(lat, lng) {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lng}`;
    return await _fetch(url);
}

async function _getNameFromCoordinates(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    return await _fetch(url);
}

async function getNameFromCoordinates(lat, lon) {
    const result = await _getNameFromCoordinates(lat, lon);
    if (!result || !result.address) return 'Ukjent';
    if (result.address.city) return result.address.city;
    if (result.address.village) return result.address.village;
    return 'Ukjent';
}

function App() {
    // Hardcoded location for Bergen
    const LOCATION = { name: 'Bergen', lat: 60.39299, lng: 5.32415 };
    const [randomStaffImage, setRandomStaffImage] = useState(null);
    const [showStaff, setShowStaff] = useState(false);

    // Staff image logic
    useEffect(() => {
        const staffImages = [staffWoman, staffMan];
        const randomImage = staffImages[Math.floor(Math.random() * staffImages.length)];
        setRandomStaffImage(randomImage);
        const checkTime = () => {
            const now = new Date();
            const hours = now.getHours();
            setShowStaff(hours >= 6 && hours < 10);
        };
        checkTime();
        const interval = setInterval(checkTime, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="app">
            <video src="/static/entur.mp4" autoPlay loop muted style={{ width: '100%', height: 'auto', display: 'block' }} />

            <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#181C56' }}>
                <img src={randomStaffImage} alt="Staff" style={{ maxHeight: '90vh', maxWidth: '90vw', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
            </div>


            <Weather location={LOCATION} />
        </div>
    );
}

export default App;
