import React from 'react';

/**
 * Skjuler innholdet sitt hvis det kaster, i stedet for å ta ned hele treet.
 *
 * Tavla står i resepsjonen og skal aldri bli svart fordi varselvisningen
 * feiler. Video, hilsen og karusell er upåvirket.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error) {
        console.error('Varselvisningen feilet og er skjult', error);
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}

export default ErrorBoundary;
