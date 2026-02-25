/**
 * Netlify function to fetch YouTube channel videos via YouTube Data API v3.
 * Requires YOUTUBE_API_KEY in Netlify environment (get from Google Cloud Console).
 */

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    const channelId = event.queryStringParameters?.channelId || '';
    const handle = event.queryStringParameters?.handle || '';
    let playlistId = event.queryStringParameters?.playlistId || '';

    if (!apiKey) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing YOUTUBE_API_KEY in Netlify env.' }),
        };
    }

    try {
        if (!playlistId && (channelId || handle)) {
            const channelParam = handle ? `forHandle=${encodeURIComponent(handle)}` : `id=${channelId}`;
            const uploadsRes = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${channelParam}&key=${apiKey}`
            );
            const uploadsData = await uploadsRes.json();
            if (uploadsData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads) {
                playlistId = uploadsData.items[0].contentDetails.relatedPlaylists.uploads;
            }
        }
        if (!playlistId) {
            return { statusCode: 200, headers, body: JSON.stringify({ videos: [] }) };
        }

        const playlistRes = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=12&key=${apiKey}`
        );
        const playlistData = await playlistRes.json();

        const videos = (playlistData.items || [])
            .filter((item) => item.snippet?.resourceId?.videoId)
            .map((item) => ({
                id: item.snippet.resourceId.videoId,
                title: item.snippet.title || '',
            }));

        return { statusCode: 200, headers, body: JSON.stringify({ videos }) };
    } catch (err) {
        console.error('YouTube API error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message }),
        };
    }
};
