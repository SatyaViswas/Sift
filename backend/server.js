require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5051;
const FASTAPI_URL = 'http://127.0.0.1:8000';

// 1. Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Mock Multi-Tenancy Engine
app.use((req, res, next) => {
    const profile = req.headers['x-user-profile'] || req.query.user;
    req.userProfile = profile || 'default_user';
    next();
});

// Helper for fetch proxying
const proxyFetch = async (url, method, body = null) => {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        let data;
        try {
            data = await response.json();
        } catch (e) {
            const text = await response.text();
            throw new Error(`Failed to parse JSON response: ${text}`);
        }
        
        if (!response.ok) {
            throw data;
        }
        return data;
    } catch (error) {
        throw error;
    }
};

app.get('/', (req, res) => {
    res.json({ status: 'online', app: 'Sift Backend Engine' });
});

// 4. Base Test Endpoint
app.get('/api/health', async (req, res) => {
    try {
        const params = new URLSearchParams({ profile: req.userProfile });
        const result = await proxyFetch(`${FASTAPI_URL}/api/health?${params}`, 'GET');
        res.json({
            status: 'success',
            message: 'Server is healthy and bridge is connected.',
            bridgeResponse: result
        });
    } catch (error) {
        res.status(500).json(error);
    }
});

// Phase 2: Ingestion Pipeline
app.post('/api/memory/ingest', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: "Missing 'text' in request body." });
        }

        const result = await proxyFetch(`${FASTAPI_URL}/api/ingest`, 'POST', {
            profile: req.userProfile,
            text
        });
        res.status(200).json(result);
    } catch (error) {
        console.error('Ingest Pipeline Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error during ingestion.', details: error });
    }
});

// Phase 3: Oracle Engine
app.post('/api/memory/recover', async (req, res) => {
    try {
        const { question, state } = req.body || {};
        const query = question || state || "";
        
        const result = await proxyFetch(`${FASTAPI_URL}/api/recover`, 'POST', {
            profile: req.userProfile,
            query
        });
        res.status(200).json(result);
    } catch (error) {
        console.error('Oracle Pipeline Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error during recovery lookup.', details: error });
    }
});

// Phase 3: Analytics Engine
app.get('/api/memory/blindspots', async (req, res) => {
    try {
        const params = new URLSearchParams({ profile: req.userProfile });
        const result = await proxyFetch(`${FASTAPI_URL}/api/blindspots?${params}`, 'GET');
        res.status(200).json(result);
    } catch (error) {
        console.error('Analytics Pipeline Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error during blindspot lookup.', details: error });
    }
});

// Phase 1 Overhaul: Memory Update Pipeline
app.put('/api/memory/update', async (req, res) => {
    try {
        const { entryId, originalText, newText } = req.body;
        if (!newText || typeof newText !== 'string' || !newText.trim()) {
            return res.status(400).json({ error: "Missing or empty 'newText' in request body." });
        }

        const result = await proxyFetch(`${FASTAPI_URL}/api/update`, 'PUT', {
            profile: req.userProfile,
            entryId: entryId || null,
            originalText: originalText || '',
            newText: newText.trim(),
        });
        res.status(200).json(result);
    } catch (error) {
        console.error('Memory Update Pipeline Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error during memory update.', details: error });
    }
});

// Phase 7B: Intentional Forgetting
app.post('/api/memory/forget', async (req, res) => {
    try {
        const { topic } = req.body;
        if (!topic) {
            return res.status(400).json({ error: "Missing 'topic' in request body." });
        }

        const result = await proxyFetch(`${FASTAPI_URL}/api/forget`, 'POST', {
            profile: req.userProfile,
            topic
        });
        res.status(200).json(result);
    } catch (error) {
        console.error('Forget Pipeline Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error during forget operation.', details: error });
    }
});

// Phase 7B: Improve Oracle Recommendations
app.post('/api/memory/improve', async (req, res) => {
    try {
        const { helpful, context } = req.body;
        
        const result = await proxyFetch(`${FASTAPI_URL}/api/improve`, 'POST', {
            profile: req.userProfile,
            helpful: !!helpful,
            context: context || ""
        });
        res.status(200).json(result);
    } catch (error) {
        console.error('Improve Pipeline Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error during improve operation.', details: error });
    }
});

app.listen(PORT, () => {
    console.log(`Sift backend running on port ${PORT}`);
});

process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection:', reason); });
process.on('uncaughtException', (error) => { console.error('Uncaught Exception:', error); });
