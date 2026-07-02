require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5051;
// Pointing to the new memory_bridge_3.py FastAPI server which still runs on 8000 by default
const FASTAPI_URL = 'http://127.0.0.1:8000'; 

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.warn("WARNING: Supabase credentials missing. Database operations will fail. The system will rely purely on the Python Bridge (Cognee).");
}

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multi-Tenancy Engine Middleware
app.use((req, res, next) => {
    const profile = req.headers['x-user-profile'] || req.query.user;
    req.userProfile = profile || 'default_user';
    next();
});

// Proxy Fetch Helper to forward requests to the Python microservice
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
            throw new Error(`Failed to parse JSON response from Python Bridge: ${text}`);
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
    res.json({ status: 'online', app: 'Sift Gateway Engine v2', mode: 'strict_determinism' });
});

app.get('/api/health', async (req, res) => {
    try {
        const params = new URLSearchParams({ profile: req.userProfile });
        const result = await proxyFetch(`${FASTAPI_URL}/api/health?${params}`, 'GET');
        res.json({
            status: 'success',
            message: 'Gateway is healthy and v3 bridge is connected.',
            bridgeResponse: result
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Bridge disconnected.', details: error });
    }
});

// Gateway Routing: Data Ingestion
app.post('/api/memory/ingest', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: "Missing 'text' in request body." });
        }

        // 1. Python Intent Router & Taxonomy Ingestion
        const result = await proxyFetch(`${FASTAPI_URL}/api/ingest`, 'POST', {
            profile: req.userProfile,
            text
        });

        // 2. Forget / Soft Delete Check from Intent
        if (result && result.status === 'forget_confirmation') {
            const topic = result.data?.topic || '';
            
            if (supabase) {
                const { data, error } = await supabase
                    .from('journal_slates')
                    .select('*')
                    .eq('profile_id', req.userProfile)
                    .ilike('content', `%${topic}%`);
                    
                if (error) {
                    console.error('Supabase Search Error:', error);
                    return res.status(500).json({ status: 'error', message: 'Database error during search.', details: error });
                }
                
                // If no exact UI rows matched, just purge it semantically in the python side vault
                if (data && data.length === 0) {
                    const forgetResult = await proxyFetch(`${FASTAPI_URL}/api/forget`, 'POST', {
                        profile: req.userProfile,
                        topic: topic
                    });
                    return res.status(200).json({
                        status: 'success',
                        message: `No explicit Supabase rows found, but semantic amnesia vault updated for "${topic}".`,
                        bridgeResponse: forgetResult
                    });
                }
                
                return res.status(200).json({
                    status: 'verification_required',
                    topic: topic,
                    matches: data
                });
            } else {
                const forgetResult = await proxyFetch(`${FASTAPI_URL}/api/forget`, 'POST', {
                    profile: req.userProfile,
                    topic: topic
                });
                return res.status(200).json({
                    status: 'success',
                    message: `Semantic Amnesia Vault locked for "${topic}".`,
                    bridgeResponse: forgetResult
                });
            }
        }

        // 3. Supabase Insert (Standard Journal Flow)
        let databaseRecord = null;
        if (supabase) {
            const payload = { content: text, profile_id: req.userProfile };

            const { data, error } = await supabase
                .from('journal_slates')
                .insert([payload])
                .select()
                .single();

            if (error) {
                console.error('Supabase Insert Error:', error);
                return res.status(500).json({ status: 'error', message: 'Database error during ingestion.', details: error });
            }
            databaseRecord = data;

            if (result && result.summary_snippet && databaseRecord) {
                const { error: updateError } = await supabase
                    .from('journal_slates')
                    .update({ summary_snippet: result.summary_snippet })
                    .eq('id', databaseRecord.id);
                
                if (!updateError) {
                    databaseRecord.summary_snippet = result.summary_snippet;
                }
            }
        }

        res.status(200).json({
            status: 'success',
            databaseRecord: databaseRecord,
            graphEngine: result
        });
    } catch (error) {
        console.error('Ingest Pipeline Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error during ingestion.', details: error.message || error });
    }
});

// Gateway Routing: Timeline (Unchanged essentially, but modernized for safety)
app.get('/api/memory/timeline', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ error: "Supabase connection is not initialized." });
        }

        const { data, error } = await supabase
            .from('journal_slates')
            .select('*')
            .eq('profile_id', req.userProfile)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase Query Error:', error);
            return res.status(500).json({ status: 'error', message: 'Database error fetching timeline.', details: error });
        }

        res.status(200).json({ status: 'success', timeline: data });
    } catch (error) {
        console.error('Timeline Fetch Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error during timeline fetch.', details: error.message || error });
    }
});

// Gateway Routing: Oracle Recovery
app.post('/api/memory/recover', async (req, res) => {
    try {
        const { question, state } = req.body || {};
        const query = question || state || "";
        
        let full_history = "";
        if (supabase) {
            const { data, error } = await supabase
                .from('journal_slates')
                .select('created_at, content')
                .eq('profile_id', req.userProfile)
                .order('created_at', { ascending: true }); // Day 1 to present

            if (!error && data) {
                full_history = data.map(item => `[${new Date(item.created_at).toISOString().split('T')[0]}] ${item.content}`).join('\\n');
            }
        }

        const result = await proxyFetch(`${FASTAPI_URL}/api/recover`, 'POST', {
            profile: req.userProfile,
            query,
            full_history
        });
        res.status(200).json(result);
    } catch (error) {
        console.error('Oracle Pipeline Error:', error);
        // Graceful Degradation: return a structured fail state rather than outright breaking UI
        res.status(500).json({ 
            status: 'error', 
            message: 'The Oracle bridge is temporarily unresponsive. Data remains safe.', 
            details: error.message || error 
        });
    }
});

// Gateway Routing: Analytics / Blindspots
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

// Gateway Routing: Update Pipeline
app.put('/api/memory/update', async (req, res) => {
    try {
        const { entryId, originalText, newText } = req.body;
        if (!newText || typeof newText !== 'string' || !newText.trim()) {
            return res.status(400).json({ error: "Missing or empty 'newText' in request body." });
        }

        let databaseRecord = null;
        if (supabase && entryId) {
            const { data, error } = await supabase
                .from('journal_slates')
                .update({ content: newText.trim() })
                .eq('id', entryId)
                .eq('profile_id', req.userProfile)
                .select()
                .single();

            if (error) {
                console.error('Supabase Update Error:', error);
                return res.status(500).json({ status: 'error', message: 'Database error during memory update.', details: error });
            }
            databaseRecord = data;
        }

        const result = await proxyFetch(`${FASTAPI_URL}/api/update`, 'PUT', {
            profile: req.userProfile,
            entryId: entryId || null,
            originalText: originalText || '',
            newText: newText.trim(),
        });

        res.status(200).json({
            status: 'success',
            databaseRecord: databaseRecord,
            graphEngine: result
        });
    } catch (error) {
        console.error('Memory Update Pipeline Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error during memory update.', details: error.message || error });
    }
});

// Gateway Routing: Amnesia Action
app.post('/api/memory/forget', async (req, res) => {
    try {
        const { topic, entryId } = req.body;
        if (!topic && !entryId) {
            return res.status(400).json({ error: "Missing 'topic' or 'entryId' in request body." });
        }

        if (supabase && entryId) {
            const { error } = await supabase
                .from('journal_slates')
                .delete()
                .eq('id', entryId)
                .eq('profile_id', req.userProfile);

            if (error) {
                console.error('Supabase Delete Error:', error);
                return res.status(500).json({ status: 'error', message: 'Database error during memory deletion.', details: error });
            }
        }

        const result = await proxyFetch(`${FASTAPI_URL}/api/forget`, 'POST', {
            profile: req.userProfile,
            topic: topic || "",
            entryId: entryId || null
        });
        res.status(200).json(result);
    } catch (error) {
        console.error('Forget Pipeline Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error during forget operation.', details: error.message || error });
    }
});

// Gateway Routing: Feedback / Improve
app.post('/api/memory/improve', async (req, res) => {
    try {
        const { helpful, context, lookup_token } = req.body;
        
        // Use crypto properly for hash generation in JS if token is missing
        const final_token = lookup_token || crypto.createHash('sha256').update(context || "").digest('hex');

        const result = await proxyFetch(`${FASTAPI_URL}/api/improve`, 'POST', {
            profile: req.userProfile,
            helpful: !!helpful,
            context: context || "",
            lookup_token: final_token
        });
        res.status(200).json(result);
    } catch (error) {
        console.error('Improve Pipeline Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error during improve operation.', details: error });
    }
});

app.listen(PORT, () => {
    console.log(`Sift Gateway v2 running on port ${PORT}`);
});

process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection:', reason); });
process.on('uncaughtException', (error) => { console.error('Uncaught Exception:', error); });
