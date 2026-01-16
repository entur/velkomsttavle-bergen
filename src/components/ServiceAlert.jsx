import React, { useState, useEffect } from 'react';
import {GridContainer, GridItem} from "@entur/grid";
import {WarningIcon} from "@entur/icons";
import {Heading1} from "@entur/typography";
import {Heading, Text} from "@entur/typography/beta";

export default function ServiceAlert() {
    const [alerts, setAlerts] = useState([]);
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        async function fetchEnturStatus() {
            try {
                const response = await fetch('https://status.entur.org/history.rss');
                const text = await response.text();
                const parser = new window.DOMParser();
                const xml = parser.parseFromString(text, 'application/xml');
                const items = Array.from(xml.querySelectorAll('item'));
                // Only show alerts for today or those between <pubDate> and <maintenanceEndDate>
                const now = new Date();
                const todayStr = now.toISOString().slice(0, 10);
                const filteredAlerts = items.filter(item => {
                    const pubDateStr = item.querySelector('pubDate')?.textContent;
                    const pubDate = pubDateStr ? new Date(pubDateStr) : null;
                    const endDateStr = item.querySelector('maintenanceEndDate')?.textContent;
                    const endDate = endDateStr ? new Date(endDateStr) : null;
                    // If maintenanceEndDate exists, show if now is between pubDate and maintenanceEndDate
                    if (pubDate && endDate) {
                        return now >= pubDate && now <= endDate;
                    }
                    // Otherwise, show if pubDate is today
                    if (pubDate) {
                        return pubDate.toISOString().slice(0, 10) === todayStr;
                    }
                    return false;
                });
                const latestAlerts = filteredAlerts.slice(0, 3).map(item => ({
                    title: item.querySelector('title')?.textContent || '',
                    pubDate: item.querySelector('pubDate')?.textContent || '',
                    description: item.querySelector('description')?.textContent || ''
                }));
                setAlerts(latestAlerts);
            } catch (e) {
                setAlerts([]);
            }
        }
        fetchEnturStatus();
        const interval = setInterval(fetchEnturStatus, 10 * 60 * 1000); // Check every 10 minutes
        return () => clearInterval(interval);
    }, []);

    // Carousel logic
    useEffect(() => {
        if (alerts.length > 1) {
            const carouselInterval = setInterval(() => {
                setCurrent((prev) => (prev + 1) % alerts.length);
            }, 5000); // Change alert every 5 seconds
            return () => clearInterval(carouselInterval);
        }
    }, [alerts]);

    if (alerts.length === 0) return null;
    const alert = alerts[current] || { title: '', pubDate: '', description: '' };
    // Sanitize description to allow basic formatting (bold, italic, links)
    function sanitizeHtml(html) {
        // Only allow <b>, <strong>, <i>, <em>, <a> tags, strip others
        return html.replace(/<(?!\/?(b|strong|i|em|a)(\s|>|$))[^>]+>/gi, '')
                   .replace(/<a ([^>]+)>/gi, '<a $1 target="_blank" rel="noopener noreferrer">');
    }
    return (
        <GridContainer spacing={"medium"} style={{ display: 'flex', justifyContent: 'left', position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999, background: '#ff5959', color: 'white', padding: '16px', textAlign: 'left', fontWeight: 'bold', borderRadius: '8px 8px 0 0', boxShadow: '0 -2px 8px rgba(0,0,0,0.2)', maxWidth: '100vw' }}>
            <GridItem small={2} medium={2} large={2}>
                <WarningIcon size={50}/>
            </GridItem>
            <GridItem small={2} medium={2} large={2}>
                <Heading as="h1" variant="title-1" >Driftstatus</Heading>
                <Heading as="h2" variant="title-2" >{alert.title || 'Ingen statusmelding'}</Heading>
                <Text variant="caption">{alert.pubDate}</Text>

                {/* Use sanitized HTML for formatted output */}
                <Text variant="paragraph">
                    <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(alert.description) }} />
                </Text>
                {alerts.length > 1 && (
                    <div style={{ marginTop: '12px', textAlign: 'center', fontWeight: 'normal', fontSize: '0.8rem' }}>
                        {alerts.map((_, idx) => (
                            <span key={idx} style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: idx === current ? 'white' : 'rgba(255,255,255,0.4)', margin: '0 4px' }} />
                        ))}
                    </div>
                )}
            </GridItem>
        </GridContainer>

    );
}
