/**
 * Netlify serverless function to list all images in a Cloudinary folder (including subfolders).
 * Requires env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
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

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Cloudinary credentials not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in Netlify environment.',
            }),
        };
    }

    const folder = (event.queryStringParameters?.folder || '').trim();
    const prefix = folder ? (folder.endsWith('/') ? folder : folder + '/') : '';

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const resources = [];
    let nextCursor = null;

    try {
        do {
            const url = new URL(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`);
            url.searchParams.set('max_results', '500');
            url.searchParams.set('type', 'upload');
            if (prefix) url.searchParams.set('prefix', prefix);
            if (nextCursor) url.searchParams.set('next_cursor', nextCursor);

            const response = await fetch(url.toString(), {
                headers: { Authorization: `Basic ${auth}` },
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Cloudinary API error ${response.status}: ${errText}`);
            }

            const data = await response.json();
            const items = data.resources || [];
            resources.push(...items.map((r) => ({ public_id: r.public_id, format: r.format })));
            nextCursor = data.next_cursor || null;
        } while (nextCursor);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ resources }),
        };
    } catch (err) {
        console.error('Cloudinary list error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message }),
        };
    }
};
