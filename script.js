// Google Sheets configuration
const GOOGLE_SHEET_ID = '2PACX-1vSIwspp_P8-nqaWd2HM6u0Dkh7_XcO_Hrc6E4-QDqFDUABZQpUvQ1NdzJEkTFazripJxfTT7D3w6yuX';
const GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/e/${GOOGLE_SHEET_ID}/pub?output=csv`;

// Cloudinary configuration - photos load from folder (including subfolders) via Netlify function
const CLOUDINARY_CLOUD_NAME = 'dhvetz6qg';
const CLOUDINARY_FOLDER = 'FracturePoint_Photos'; // e.g. 'band-photos' - empty = root folder
// Netlify URL for function - use when custom domain (fracturepointband.com) doesn't route /.netlify/functions
const NETLIFY_SITE_URL = 'https://fracturepointband.netlify.app';

// Fetch and parse Google Sheet data
async function fetchShowsData() {
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        const csvText = await response.text();
        
        // Convert CSV to array of objects
        const shows = parseCSVData(csvText);
        
        // Separate upcoming and past shows
        // Use sheet data (ticket info, etc.) until one day after the show date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const upcomingShows = [];
        const pastShows = [];
        
        shows.forEach(show => {
            if (show.date) {
                const showDate = new Date(show.date);
                showDate.setHours(0, 0, 0, 0);
                const dayAfterShow = new Date(showDate);
                dayAfterShow.setDate(dayAfterShow.getDate() + 1);
                
                // Upcoming through end of day after show (use sheet data until then)
                if (today <= dayAfterShow) {
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
    
    // Parse headers (strip BOM from first header if present)
    let headerLine = lines[0];
    if (headerLine.charCodeAt(0) === 0xFEFF) {
        headerLine = headerLine.slice(1);
    }
    const headers = parseCSVLine(headerLine);
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
                const key = header.toString().trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
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
        console.log('CSV keys for first show:', Object.keys(shows[0]));
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
// Sheet column: Buy_Tickets_Option. Online = link, other values = display exact sheet text.
function getBuyTicketsHTML(show) {
    // Primary: Buy_Tickets_Option (header normalizes to buy_tickets_option)
    let rawValue = (show.buy_tickets_option || '').toString().trim();
    
    // Fallback: try matching key by normalized name (handles header variations)
    if (!rawValue) {
        const targetKey = 'buy_tickets_option';
        const found = Object.keys(show).find(k => 
            k.replace(/[^a-z0-9_]/g, '') === targetKey || 
            k.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') === targetKey
        );
        if (found) rawValue = (show[found] || '').toString().trim();
    }
    
    // Fallback: find "Door Sales Only" or "Online" in any column (handles column name mismatch)
    if (!rawValue) {
        for (const val of Object.values(show)) {
            const v = (val || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
            if (v === 'door sales only' || v === 'online' || (v.includes('door') && v.includes('sales') && v.includes('only'))) {
                rawValue = (val || '').toString().trim();
                break;
            }
        }
    }
    
    const normalizedValue = rawValue.toLowerCase().replace(/\s+/g, ' ');
    
    if (normalizedValue === 'online') {
        const ticketUrl = show.link || show.ticket_url || show.tickets || show.ticket_link || show.url || '#';
        if (ticketUrl && ticketUrl !== '#') {
            return `<a href="${ticketUrl}" target="_blank" class="ticket-link">Buy Tickets</a>`;
        }
        return `<span class="ticket-link-disabled">${rawValue || 'Online'}</span>`;
    }
    
    // Display exact sheet value for all other options
    return `<span class="ticket-link-disabled">${rawValue || ''}</span>`;
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

// Cloudinary photo URL helper - builds optimized image URL
function getCloudinaryUrl(publicId, width = 400, height = 400) {
    if (!CLOUDINARY_CLOUD_NAME || !publicId) return null;
    const transform = `w_${width},h_${height},c_fill`;
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transform}/${publicId}`;
}

// Load and render Cloudinary photos from folder (includes all subfolders)
async function loadCloudinaryPhotos() {
    const container = document.getElementById('photos-section');
    if (!container) return;

    if (!CLOUDINARY_CLOUD_NAME) {
        container.innerHTML = '<div class="media-placeholder"><p>Set CLOUDINARY_CLOUD_NAME in script.js.</p></div>';
        return;
    }

    container.innerHTML = '<div class="media-placeholder media-loading"><p>Loading photos...</p></div>';

    try {
        const url = `${CLOUDINARY_LIST_URL}${CLOUDINARY_FOLDER ? '?folder=' + encodeURIComponent(CLOUDINARY_FOLDER) : ''}`;
        const response = await fetch(url);
        const text = await response.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            if (text.trim().startsWith('<')) {
                throw new Error('Function not found. Connect your Git repo to Netlify (drag-and-drop does not deploy functions).');
            }
            throw new Error('Invalid response from server');
        }

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load photos');
        }

        const resources = data.resources || [];
        const images = resources.filter((r) => ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes((r.format || '').toLowerCase()));

        if (images.length === 0) {
            container.innerHTML = '<div class="media-placeholder"><p>No photos in this folder. Add CLOUDINARY_FOLDER in script.js or upload images to Cloudinary.</p></div>';
            return;
        }

        container.innerHTML = images
            .map(({ public_id }) => {
                const thumbUrl = getCloudinaryUrl(public_id, 300, 300);
                const fullUrl = getCloudinaryUrl(public_id, 1200, 1200);
                if (!thumbUrl) return '';
                return `<a href="${fullUrl}" target="_blank" rel="noopener" class="media-photo-item" title="View full size">
                    <img src="${thumbUrl}" alt="Band photo" loading="lazy">
                </a>`;
            })
            .filter(Boolean)
            .join('');
    } catch (err) {
        console.error('Cloudinary photos error:', err);
        container.innerHTML = '<div class="media-placeholder"><p>Could not load photos.</p><p class="media-error">' + err.message + '</p></div>';
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

    // Load Cloudinary photos
    loadCloudinaryPhotos();
});

