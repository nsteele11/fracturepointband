// Google Sheets configuration
const GOOGLE_SHEET_ID = '2PACX-1vSIwspp_P8-nqaWd2HM6u0Dkh7_XcO_Hrc6E4-QDqFDUABZQpUvQ1NdzJEkTFazripJxfTT7D3w6yuX';
const GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/e/${GOOGLE_SHEET_ID}/pub?output=csv`;

// Fetch and parse Google Sheet data
async function fetchShowsData() {
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        const csvText = await response.text();
        
        // Convert CSV to array of objects
        const shows = parseCSVData(csvText);
        
        // Separate upcoming and past shows
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const upcomingShows = [];
        const pastShows = [];
        
        shows.forEach(show => {
            if (show.date) {
                const showDate = new Date(show.date);
                showDate.setHours(0, 0, 0, 0);
                
                if (showDate >= today) {
                    upcomingShows.push(show);
                } else {
                    pastShows.push(show);
                }
            }
        });
        
        // Sort upcoming shows by date (ascending)
        upcomingShows.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Sort past shows by date (descending - most recent first)
        pastShows.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return { upcomingShows, pastShows };
    } catch (error) {
        console.error('Error fetching shows data:', error);
        return { upcomingShows: [], pastShows: [] };
    }
}

// Parse CSV data format
function parseCSVData(csvText) {
    const shows = [];
    // Handle both \r\n and \n line endings
    const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    
    if (lines.length < 2) {
        console.log('Not enough lines in CSV:', lines.length);
        return shows; // Need at least header and one data row
    }
    
    // Parse headers
    const headers = parseCSVLine(lines[0]);
    console.log('CSV Headers:', headers);
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const show = {};
        
        // Debug first row
        if (i === 1) {
            console.log('First data row values:', values);
            console.log('Number of headers:', headers.length, 'Number of values:', values.length);
        }
        
        headers.forEach((header, index) => {
            if (values[index] !== undefined) {
                const key = header.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                // Clean the value - remove quotes and trim
                let value = values[index].trim();
                // Remove surrounding quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                show[key] = value;
            }
        });
        
        // Only add if there's at least a date or venue
        if (show.date || show.venue) {
            shows.push(show);
        }
    }
    
    console.log('Parsed shows count:', shows.length);
    if (shows.length > 0) {
        console.log('Sample parsed show:', shows[0]);
    }
    
    return shows;
}

// Parse a CSV line handling quoted fields
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    
    return result;
}

// Format date for display - full day of week, full month, day, year (no comma after weekday)
function formatDate(dateString) {
    if (!dateString) return 'TBA';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        const formatted = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Remove comma after weekday (e.g., "Wednesday, February 20, 2026" -> "Wednesday February 20, 2026")
        return formatted.replace(/^(\w+),/, '$1');
    } catch (error) {
        return dateString;
    }
}

// Helper function to get buy tickets HTML
function getBuyTicketsHTML(show) {
    const buyTicketsOption = (show.buy_tickets_option || '').trim().toLowerCase();
    
    if (buyTicketsOption === 'online') {
        const ticketUrl = show.ticket_url || show.tickets || show.ticket_link || show.url || '#';
        if (ticketUrl === '#') {
            return '<span class="ticket-link-disabled">Not Available</span>';
        } else {
            return `<a href="${ticketUrl}" target="_blank" class="ticket-link">Buy Tickets</a>`;
        }
    } else if (buyTicketsOption === 'email') {
        // Email button is temporarily disabled while email address is being finalized
        return '<span class="ticket-link-disabled">Email for Tickets</span>';
    } else if (buyTicketsOption.includes('square')) {
        // Square integration - show Buy Tickets button with link
        const ticketUrl = show.ticket_url || show.tickets || show.ticket_link || show.url || '#';
        if (ticketUrl === '#') {
            return '<span class="ticket-link-disabled">Not Available</span>';
        } else {
            return `<a href="${ticketUrl}" target="_blank" class="ticket-link ticket-link-square">Buy Tickets</a>`;
        }
    } else {
        return '<span class="ticket-link-disabled">Not Available</span>';
    }
}

// Render shows to the page
function renderShows(upcomingShows, pastShows) {
    const upcomingTbody = document.getElementById('upcoming-shows');
    const upcomingCards = document.getElementById('upcoming-shows-cards');
    const pastTbody = document.getElementById('past-shows');
    const pastCards = document.getElementById('past-shows-cards');
    
    // Render upcoming shows as table rows (desktop)
    if (upcomingShows.length === 0) {
        upcomingTbody.innerHTML = `
            <tr>
                <td colspan="6" class="no-shows">Check back soon for upcoming shows!</td>
            </tr>
        `;
        if (upcomingCards) {
            upcomingCards.innerHTML = `
                <div class="show-card-mobile">
                    <div class="show-venue">Check back soon for upcoming shows!</div>
                </div>
            `;
        }
    } else {
        upcomingTbody.innerHTML = upcomingShows.map(show => {
            const buyTicketsHTML = getBuyTicketsHTML(show);
            const ticketPrice = show.ticket_price || show.price || 'TBA';
            
            return `
            <tr>
                <td class="show-date">${formatDate(show.date)}</td>
                <td class="show-time">${show.set_time || 'TBA'}</td>
                <td class="show-venue">${show.venue || 'TBA'}</td>
                <td class="show-city">${show.city || ''}</td>
                <td class="show-price">${ticketPrice}</td>
                <td class="show-tickets">${buyTicketsHTML}</td>
            </tr>
        `;
        }).join('');
        
        // Render upcoming shows as cards (mobile)
        if (upcomingCards) {
            upcomingCards.innerHTML = upcomingShows.map(show => {
                const buyTicketsHTML = getBuyTicketsHTML(show);
                const ticketPrice = show.ticket_price || show.price || 'TBA';
                
                return `
                <div class="show-card-mobile">
                    <div class="show-date">${formatDate(show.date)}</div>
                    <div class="show-time">Set Time: ${show.set_time || 'TBA'}</div>
                    <div class="show-venue">${show.venue || 'TBA'}</div>
                    <div class="show-city">${show.city || ''}</div>
                    <div class="show-price">Pre Order Tickets: ${ticketPrice}</div>
                    <div class="show-tickets-mobile">${buyTicketsHTML}</div>
                </div>
            `;
            }).join('');
        }
    }
    
    // Render past shows as table rows (desktop) - no Buy Tickets column
    if (pastShows.length === 0) {
        pastTbody.innerHTML = `
            <tr>
                <td colspan="5" class="no-shows">No past shows to display</td>
            </tr>
        `;
        if (pastCards) {
            pastCards.innerHTML = `
                <div class="show-card-mobile">
                    <div class="show-venue">No past shows to display</div>
                </div>
            `;
        }
    } else {
        pastTbody.innerHTML = pastShows.map(show => {
            const ticketPrice = show.ticket_price || show.price || 'TBA';
            
            // Extract and clean each field - same as upcoming shows
            const date = (show.date || '').toString().trim();
            const setTime = (show.set_time || 'TBA').toString().trim();
            const venue = (show.venue || 'TBA').toString().trim();
            const city = (show.city || '').toString().trim();
            const price = (ticketPrice || 'TBA').toString().trim();
            
            return `
            <tr>
                <td class="show-date">${formatDate(date)}</td>
                <td class="show-time">${setTime}</td>
                <td class="show-venue">${venue}</td>
                <td class="show-city">${city}</td>
                <td class="show-price">${price}</td>
            </tr>
        `;
        }).join('');
        
        // Render past shows as cards (mobile)
        if (pastCards) {
            pastCards.innerHTML = pastShows.map(show => {
                // Extract fields with fallbacks for various column name variations
                const date = show.date || show.date_ || '';
                const setTime = show.set_time || show.settime || show.time || show.set_time_ || 'TBA';
                const venue = show.venue || show.venue_ || 'TBA';
                const city = show.city || show.city_ || show.location || '';
                const ticketPrice = show.ticket_price || show.ticketprice || show.price || show.price_ || 'TBA';
                const buyTicketsHTML = getBuyTicketsHTML(show);
                
                return `
                <div class="show-card-mobile">
                    <div class="show-date">${formatDate(date)}</div>
                    <div class="show-time">Set Time: ${setTime}</div>
                    <div class="show-venue">${venue}</div>
                    <div class="show-city">${city}</div>
                    <div class="show-price">Pre Order Tickets: ${ticketPrice}</div>
                    <div class="show-tickets-mobile">${buyTicketsHTML}</div>
                </div>
            `;
            }).join('');
        }
    }
}

// Navigation functionality
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.page-section');

    // Handle navigation clicks
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetPage = this.getAttribute('data-page');
            
            // Update active nav link
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Show target section, hide others
            sections.forEach(section => {
                section.classList.remove('active');
            });
            
            const targetSection = document.getElementById(targetPage);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });

    // Set initial active state (Upcoming Shows is the landing page)
    const initialLink = document.querySelector('[data-page="shows"]');
    if (initialLink) {
        initialLink.classList.add('active');
    }
    
    // Load shows data
    fetchShowsData().then(({ upcomingShows, pastShows }) => {
        renderShows(upcomingShows, pastShows);
    });
});

