# FracturePoint

Website for the band FracturePoint.

## Features

- Modern black background design
- Matte pewter/gold navigation buttons
- Two main sections:
  - **Upcoming Shows** (landing page)
  - **Photos & Video**

## Setup

Simply open `index.html` in a web browser to view the site locally.

**Note:** The logo image should be saved as `logo.png` in the project root directory. The logo will appear as a very faded background covering the entire page. If your logo file has a different name or format (jpg, webp, etc.), update the `background-image` URL in `styles.css` (line 30).

### Cloudinary Photos (Photos & Video tab)

Photos are loaded from a Cloudinary folder (including all subfolders). To enable:

1. **Deploy to Netlify** – The site must be deployed to Netlify for the folder-listing function to run.
2. **Environment variables** – In Netlify Dashboard → Site settings → Environment variables, add: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
3. **Configure folder** – In `script.js`, set `CLOUDINARY_FOLDER` to your folder path. For tabbed categories (Live Shows, The Band, Behind the Scenes), create subfolders with those exact names in Cloudinary.

### YouTube Videos

To show channel videos directly on the site, add `YOUTUBE_API_KEY` to Netlify environment variables. Get a free API key from [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create credentials → API key. Enable the YouTube Data API v3 for your project.

## Future Development

- Connect to a domain URL when available
- Add actual show dates and venues
- Add photos and video content
- Additional pages/sections as needed

