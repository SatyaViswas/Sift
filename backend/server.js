require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5051;
const FASTAPI_URL = 'http://127.0.0.1:8000';

const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.warn("WARNING: Supabase credentials missing. Database operations will fail.");
}

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

        // 1. Call Python Intent Router FIRST
        const result = await proxyFetch(`${FASTAPI_URL}/api/ingest`, 'POST', {
            profile: req.userProfile,
            text
        });

        // 2. Halt automatic insertion if intent is a forget request
        if (result && result.status === 'forget_confirmation') {
            const topic = result.data?.topic || '';
            
            if (supabase) {
                // Perform Supabase Parameter Search Bridge
                const { data, error } = await supabase
                    .from('journal_slates')
                    .select('*')
                    .eq('profile_id', req.userProfile)
                    .ilike('content', `%${topic}%`);
                    
                if (error) {
                    console.error('Supabase Search Error:', error);
                    return res.status(500).json({ status: 'error', message: 'Database error during search.', details: error });
                }
                if (data && data.length === 0) {
                    console.log(`No records found in Supabase for topic "${topic}". Forwarding soft-delete to Cognee directly.`);
                    const forgetResult = await proxyFetch(`${FASTAPI_URL}/api/forget`, 'POST', {
                        profile: req.userProfile,
                        topic: topic,
                        entryIds: []
                    });
                    return res.status(200).json({
                        status: 'success',
                        message: `No text records found, but memory for "${topic}" was successfully forgotten in the graph.`,
                        bridgeResponse: forgetResult
                    });
                }
                
                return res.status(200).json({
                    status: 'verification_required',
                    topic: topic,
                    matches: data
                });
            } else {
                console.log(`No Supabase instance. Forwarding soft-delete to Cognee directly for topic "${topic}".`);
                const forgetResult = await proxyFetch(`${FASTAPI_URL}/api/forget`, 'POST', {
                    profile: req.userProfile,
                    topic: topic,
                    entryIds: []
                });
                return res.status(200).json({
                    status: 'success',
                    message: `Memory for "${topic}" was successfully forgotten in the graph.`,
                    bridgeResponse: forgetResult
                });
            }
        }

        // 3. Normal Data Ingestion
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
        }

        if (result && result.summary_snippet && databaseRecord && supabase) {
            const { error: updateError } = await supabase
                .from('journal_slates')
                .update({ summary_snippet: result.summary_snippet })
                .eq('id', databaseRecord.id);
            
            if (updateError) {
                console.error('Supabase Update Summary Error:', updateError);
            } else {
                databaseRecord.summary_snippet = result.summary_snippet;
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

// Phase 2B: Timeline Data Fetching
app.get('/api/memory/timeline', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ error: "Database connection not initialized." });
        }

        // FIXED: Condition updated to filter safely against your profile_id field token
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

        let databaseRecord = null;
        if (supabase && entryId) {
            // FIXED: Target updates modified to point to content and filter via profile_id
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

// Phase 7B: Intentional Forgetting
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

// Phase 7B: Improve Oracle Recommendations
app.post('/api/memory/improve', async (req, res) => {
    try {
        const { helpful, context, lookup_token } = req.body;

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
    console.log(`Sift backend running on port ${PORT}`);
});

process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection:', reason); });
process.on('uncaughtException', (error) => { console.error('Uncaught Exception:', error); });