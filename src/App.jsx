import React, { useState, useEffect } from 'react';
import Weather from './components/Weather';
import {Heading1, Heading3, LeadParagraph} from "@entur/typography";
import {Contrast} from "@entur/layout";
import {base} from "@entur/tokens";
import {GridContainer, GridItem} from "@entur/grid";
import {ClockIcon} from "@entur/icons";

function App() {
    // Hardcoded location for Bergen
    const LOCATION = { name: 'Bergen', lat: 60.39299, lng: 5.32415 };
    const [randomStaffImage, setRandomStaffImage] = useState(null);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());


    // Staff image logic
    useEffect(() => {
        const staffImages = ['/staff_woman.svg', '/staff_man.svg'];
        const randomImage = staffImages[Math.floor(Math.random() * staffImages.length)];
        setRandomStaffImage(randomImage);
        const timer = setInterval(() => {
            setCurrentDateTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
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
            return "Entur gjør det enklere å reise sømløst i hele Norge!";
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
            <video src="https://image2url.com/r2/default/videos/1768552271901-e3f8da21-1c51-4edb-ba4f-b18fa5ee5237.mp4" autoPlay loop muted style={{ width: '100vw', height: 'auto', display: 'block', maxHeight: '40vh', objectFit: 'cover' }} />
            <Contrast style={{ flex: 1, width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: base.light.baseColors.frame.contrast, flexDirection: 'column' }}>
                <GridContainer spacing={"medium"} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', padding: '2rem 0' }}>
                    <GridItem small={3} medium={3} large={3}>
                        <ClockIcon size={50} color={base.light.baseColors.shape.highlight}/>
                    </GridItem>
                    <GridItem small={9} medium={9} large={9}>
                        <div>
                            <LeadParagraph color={base.light.baseColors.text.highlight}>{currentDateTime.toLocaleString('nb-NO', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                            })}</LeadParagraph>


                        </div>
                    </GridItem>
                </GridContainer>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                    <img src={randomStaffImage} alt="Staff" style={{ maxHeight: '90%', maxWidth: '40%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
                    <div style={{ marginLeft: '2rem' }}>
                        <Heading1>Velkommen til Entur Bergen</Heading1>
                        <Heading3>{getGreetingText(currentDateTime)}</Heading3>
                    </div>
                </div>
            </Contrast>
            <Weather location={LOCATION} />
        </div>
    );
}

export default App;
