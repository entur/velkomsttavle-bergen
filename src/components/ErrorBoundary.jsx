import React from 'react';

/** Hvor lenge feilviste innhold holdes skjult før subtreet får en ny sjanse. */
const RETRY_MS = 5 * 60 * 1000;

/**
 * Skjuler innholdet sitt hvis det kaster, i stedet for å ta ned hele treet.
 *
 * Tavla står i resepsjonen og skal aldri bli svart fordi noe under denne
 * grensen feiler, og den kjører i ukevis uten tilsyn — derfor er den også
 * selvhelbredende: uten en vei tilbake ville et forbigående problem (et
 * ugyldig dokument som senere blir rettet, en periode uten nett) holde
 * subtreet skjult for alltid, siden ingenting her trigger en ny remount.
 * Etter `RETRY_MS` nullstilles feiltilstanden, subtreet monteres på nytt og
 * får et helt nytt abonnement. Er problemet fortsatt der, feiler det bare på
 * nytt og prøver igjen senere — helt greit, og selvkorrigerende når data blir
 * fikset.
 *
 * Generisk med vilje: komponenten vet ingenting om varsler eller Firestore,
 * den bare pakker inn et subtre.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
        this.retryTimer = null;
    }

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error) {
        console.error('Innholdet feilet og er skjult, prøver igjen senere', error);
        this.scheduleRetry();
    }

    scheduleRetry() {
        this.clearRetryTimer();
        this.retryTimer = setTimeout(() => {
            this.setState({ failed: false });
        }, RETRY_MS);
    }

    clearRetryTimer() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
    }

    componentWillUnmount() {
        this.clearRetryTimer();
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}

export default ErrorBoundary;
