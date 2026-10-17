const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

const CACHE_TTL = 60 * 60 * 1000;
const cache = new Map();

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
});

function cacheKey(url) {
    return 'proxy:' + url;
}

function readCache(url) {
    const entry = cache.get(cacheKey(url));
    if (entry && entry.expires > Date.now()) return entry.value;
    return null;
}

function writeCache(url, value) {
    cache.set(cacheKey(url), { value: value, expires: Date.now() + CACHE_TTL });
}

async function upstreamFetch(url) {
    const cached = readCache(url);
    if (cached) return cached;
    const res = await fetch(url);
    if (!res.ok) throw new Error('upstream ' + res.status);
    const data = await res.json();
    writeCache(url, data);
    return data;
}

app.get('/proxy/launches', async (req, res) => {
    try {
        const url = 'https://ll.thespacedevs.com/2.3.0/launches/?lsp__id=121&limit=100&ordering=-net';
        const data = await upstreamFetch(url);
        res.json(data);
    } catch (e) {
        res.status(502).json({ error: e.message });
    }
});

app.get('/proxy/pads', async (req, res) => {
    try {
        const url = 'https://ll.thespacedevs.com/2.3.0/pads/?agencies_ids=121&limit=100';
        const data = await upstreamFetch(url);
        res.json(data);
    } catch (e) {
        res.status(502).json({ error: e.message });
    }
});

app.get('/proxy/pads/:id', async (req, res) => {
    try {
        const url = 'https://ll.thespacedevs.com/2.3.0/pads/' + req.params.id + '/';
        const data = await upstreamFetch(url);
        res.json(data);
    } catch (e) {
        res.status(502).json({ error: e.message });
    }
});

app.listen(PORT, '127.0.0.1', () => {
    console.log('Proxy server listening on http://127.0.0.1:' + PORT);
});
