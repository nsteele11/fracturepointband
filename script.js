// Google Sheets configuration
const GOOGLE_SHEET_ID = '2PACX-1vSIwspp_P8-nqaWd2HM6u0Dkh7_XcO_Hrc6E4-QDqFDUABZQpUvQ1NdzJEkTFazripJxfTT7D3w6yuX';
const GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/e/${GOOGLE_SHEET_ID}/pub?output=csv`;

// Cloudinary configuration - photos load from folder (including subfolders) via Netlify function
const CLOUDINARY_CLOUD_NAME = 'dhvetz6qg';
const CLOUDINARY_FOLDER = 'FracturePoint_Photos'; // e.g. 'band-photos' - empty = root folder
// Netlify URL - required when site is on different host (e.g. fracturepointband.com)
const NETLIFY_SITE_URL = 'https://funny-cendol-31d47d.netlify.app';

// YouTube - channel URL and ID for embedding videos
const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/channel/UCam1SbBcBmBG7Siruznfdhw';
const YOUTUBE_CHANNEL_ID = 'UCam1SbBcBmBG7Siruznfdhw';
// Optional: playlist IDs per category (or use channel videos for all)
const YOUTUBE_PLAYLISTS = { 'live-shows': '', 'the-band': '', 'behind-the-scenes': '' };
// Cloudinary subfolders per category - must match folder names in Cloudinary
const CLOUDINARY_CATEGORIES = { 'live-shows': 'Live Shows', 'the-band': 'The Band', 'behind-the-scenes': 'Behind the Scenes' };
// Categories to always show as grayed out / disabled until photos/videos are added - remove from array when ready
const MANUALLY_DISABLED_CATEGORIES = ['the-band', 'behind-the-scenes'];

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

// Media gallery state
let lightboxItems = [];
let lightboxIndex = 0;
let touchStartX = 0;

async function fetchYouTubeVideos(category) {
    const playlistId = YOUTUBE_PLAYLISTS[category];
    const baseUrl = NETLIFY_SITE_URL || window.location.origin;
    let apiUrl = baseUrl + '/.netlify/functions/youtube-videos?channelId=' + encodeURIComponent(YOUTUBE_CHANNEL_ID);
    if (playlistId) apiUrl = baseUrl + '/.netlify/functions/youtube-videos?playlistId=' + encodeURIComponent(playlistId);
    const res = await fetch(apiUrl);
    const data = await res.json();
    return data.videos || [];
}

async function fetchCloudinaryPhotos(category) {
    const subfolder = CLOUDINARY_CATEGORIES[category] || '';
    const folder = CLOUDINARY_FOLDER ? (subfolder ? CLOUDINARY_FOLDER + '/' + subfolder : CLOUDINARY_FOLDER) : subfolder;
    const foldersToTry = folder ? [folder, CLOUDINARY_FOLDER, ''] : [''];
    const baseUrl = NETLIFY_SITE_URL || window.location.origin;

    for (const f of foldersToTry) {
        const url = baseUrl + '/.netlify/functions/cloudinary-list' + (f ? '?folder=' + encodeURIComponent(f) : '');
        try {
            const res = await fetch(url);
            const data = await res.json();
            const resources = (data.resources || []).filter((r) => ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes((r.format || '').toLowerCase()));
            if (resources.length > 0) return resources.map((r) => ({ public_id: r.public_id }));
        } catch (e) {}
    }
    return [];
}

function openLightbox(items, index, isVideo) {
    lightboxItems = items;
    lightboxIndex = index;
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    const vid = document.getElementById('lightbox-video');
    const idxEl = document.getElementById('lightbox-index');
    const totalEl = document.getElementById('lightbox-total');

    const videoWrap = document.getElementById('lightbox-video-wrap');
    function show() {
        const item = lightboxItems[lightboxIndex];
        if (!item) return;
        if (isVideo) {
            img.style.display = 'none';
            videoWrap.style.display = 'block';
            vid.src = 'https://www.youtube.com/embed/' + item.id + '?autoplay=1&rel=0&modestbranding=1';
        } else {
            videoWrap.style.display = 'none';
            vid.src = '';
            img.style.display = 'block';
            img.src = getCloudinaryUrl(item.public_id, 1920, 1920);
        }
        idxEl.textContent = lightboxIndex + 1;
        totalEl.textContent = lightboxItems.length;
        lb.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }
    show();
    lb._show = show;
}

function closeLightbox() {
    const lb = document.getElementById('lightbox');
    document.getElementById('lightbox-video').src = '';
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function initMediaGallery() {
    const mediaTabs = document.querySelectorAll('.media-tab');
    const subtabs = document.querySelectorAll('.subtab');
    const videoPanel = document.getElementById('video-panel');
    const photosPanel = document.getElementById('photos-panel');
    const videoMasonry = document.getElementById('video-masonry');
    const photosMasonry = document.getElementById('photos-masonry');
    const youtubeLink = document.getElementById('youtube-link');

    let currentMedia = 'video';
    let currentCategory = 'live-shows';
    const cache = { video: {}, photos: {} };
    const categories = Object.keys(CLOUDINARY_CATEGORIES);

    function updateSubtabStates() {
        const media = currentMedia;
        subtabs.forEach((tab) => {
            const cat = tab.dataset.category;
            const isManuallyDisabled = MANUALLY_DISABLED_CATEGORIES.includes(cat);
            const items = (cache[media] && cache[media][cat]) || [];
            const isEmpty = items.length === 0;
            if (isManuallyDisabled || isEmpty) {
                tab.classList.add('disabled');
                tab.setAttribute('aria-disabled', 'true');
            } else {
                tab.classList.remove('disabled');
                tab.removeAttribute('aria-disabled');
            }
        });
        const currentItems = (cache[media] && cache[media][currentCategory]) || [];
        const isCurrentManuallyDisabled = MANUALLY_DISABLED_CATEGORIES.includes(currentCategory);
        if ((currentItems.length === 0 || isCurrentManuallyDisabled)) {
            const selectableCategories = categories.filter((c) => !MANUALLY_DISABLED_CATEGORIES.includes(c));
            const firstWithContent = selectableCategories.find((c) => (cache[media] && cache[media][c] || []).length > 0);
            if (firstWithContent) {
                currentCategory = firstWithContent;
                subtabs.forEach((t) => t.classList.remove('active'));
                const activeTab = document.querySelector('.subtab[data-category="' + firstWithContent + '"]');
                if (activeTab) activeTab.classList.add('active');
                switchContent();
            }
        }
    }

    async function preloadCategoryContent() {
        const videoPromises = categories.map((c) => fetchYouTubeVideos(c).then((v) => (cache.video[c] = v)));
        const photoPromises = categories.map((c) => fetchCloudinaryPhotos(c).then((p) => (cache.photos[c] = p)));
        await Promise.all([...videoPromises, ...photoPromises]);
        updateSubtabStates();
    }

    async function loadVideos() {
        videoMasonry.innerHTML = '<div class="media-placeholder media-loading" style="grid-column:1/-1"><p>Loading videos...</p></div>';
        let videos = cache.video[currentCategory];
        if (videos === undefined) {
            try {
                if (YOUTUBE_CHANNEL_ID) videos = await fetchYouTubeVideos(currentCategory);
            } catch (e) {}
            cache.video[currentCategory] = videos || [];
            videos = cache.video[currentCategory];
        }
        updateSubtabStates();
        if (videos.length === 0) {
            videoMasonry.innerHTML = '<div class="media-placeholder"><p>No videos in this category.</p></div>';
            youtubeLink.style.display = 'inline-block';
            youtubeLink.href = YOUTUBE_CHANNEL_URL;
            return;
        }
        const thumbBase = 'https://img.youtube.com/vi/';
        videoMasonry.innerHTML = videos
            .map(
                (v, i) =>
                    '<div class="masonry-item" data-type="video" data-index="' +
                    i +
                    '"><div class="masonry-thumb"><img src="' +
                    thumbBase +
                    v.id +
                    '/mqdefault.jpg" alt="" loading="lazy"><span class="play-icon">&#9654;</span></div></div>'
            )
            .join('');
        youtubeLink.style.display = 'inline-block';
        youtubeLink.href = YOUTUBE_CHANNEL_URL;
        videoMasonry.querySelectorAll('.masonry-item').forEach((el, i) => {
            el.addEventListener('click', () => openLightbox(videos, i, true));
        });
    }

    async function loadPhotos() {
        photosMasonry.innerHTML = '<div class="media-placeholder media-loading"><p>Loading photos...</p></div>';
        let images = cache.photos[currentCategory];
        if (images === undefined) {
            try {
                if (CLOUDINARY_CLOUD_NAME) images = await fetchCloudinaryPhotos(currentCategory);
            } catch (e) {}
            cache.photos[currentCategory] = images || [];
            images = cache.photos[currentCategory];
        }
        updateSubtabStates();
        if (images.length === 0) {
            photosMasonry.innerHTML = '<div class="media-placeholder"><p>No photos in this category.</p></div>';
            return;
        }
        photosMasonry.innerHTML = images
            .map(
                (img, i) =>
                    '<div class="masonry-item" data-type="photo" data-index="' +
                    i +
                    '"><img src="' +
                    getCloudinaryUrl(img.public_id, 400, 400) +
                    '" alt="" loading="lazy"></div>'
            )
            .join('');
        photosMasonry.querySelectorAll('.masonry-item').forEach((el, i) => {
            el.addEventListener('click', () => openLightbox(images, i, false));
        });
    }

    function switchContent() {
        if (currentMedia === 'video') {
            videoPanel.classList.add('active');
            photosPanel.classList.remove('active');
            loadVideos();
        } else {
            photosPanel.classList.add('active');
            videoPanel.classList.remove('active');
            loadPhotos();
        }
    }

    mediaTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            mediaTabs.forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
            currentMedia = tab.dataset.media;
            updateSubtabStates();
            switchContent();
        });
    });

    subtabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            if (tab.classList.contains('disabled')) return;
            subtabs.forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategory = tab.dataset.category;
            switchContent();
        });
    });

    document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    document.querySelector('.lightbox-prev').addEventListener('click', () => {
        lightboxIndex = (lightboxIndex - 1 + lightboxItems.length) % lightboxItems.length;
        document.getElementById('lightbox')._show();
    });
    document.querySelector('.lightbox-next').addEventListener('click', () => {
        lightboxIndex = (lightboxIndex + 1) % lightboxItems.length;
        document.getElementById('lightbox')._show();
    });

    document.getElementById('lightbox').addEventListener('click', (e) => {
        if (e.target.id === 'lightbox') closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
        if (document.getElementById('lightbox').getAttribute('aria-hidden') === 'true') return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') document.querySelector('.lightbox-prev').click();
        if (e.key === 'ArrowRight') document.querySelector('.lightbox-next').click();
    });

    let touchStartX2 = 0;
    document.getElementById('lightbox').addEventListener('touchstart', (e) => {
        touchStartX2 = e.touches[0].clientX;
    });
    document.getElementById('lightbox').addEventListener('touchend', (e) => {
        const diff = touchStartX2 - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) document.querySelector('.lightbox-next').click();
            else document.querySelector('.lightbox-prev').click();
        }
    });

    preloadCategoryContent().then(() => switchContent()).catch(() => {
        updateSubtabStates();
        switchContent();
    });
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

    // Load media gallery (videos + photos with tabs)
    initMediaGallery();
});

