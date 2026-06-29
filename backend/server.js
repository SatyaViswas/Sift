require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5051;;

// 1. Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Mock Multi-Tenancy Engine
app.use((req, res, next) => {
    const profile = req.headers['x-user-profile'] || req.query.user;
    // Do not block globally here; instead, assign a fallback or handle missing tokens gracefully at the route layer
    req.userProfile = profile || 'default_user';
    next();
});

// 3. Bridge Utility Layer
const callMemoryBridge = (profile, action, data) => {
    return new Promise((resolve, reject) => {
        // Explicitly target local virtual environment Python executable
        const pythonExecutable = './venv/bin/python';

        const args = [
            path.join(__dirname, 'memory_bridge.py'),
            profile,
            action,
            JSON.stringify(data || {})
        ];

        const pythonProcess = spawn(pythonExecutable, args);

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (chunk) => {
            stdoutData += chunk.toString();
        });

        pythonProcess.stderr.on('data', (chunk) => {
            stderrData += chunk.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0 && !stdoutData.trim()) {
                // If python exited with error and didn't output a graceful JSON error
                return reject({
                    status: 'error',
                    message: `Python process exited with code ${code}`,
                    details: stderrData
                });
            }

            try {
                // Parse stdout cleanly.
                // We split by newline and take the last line in case other modules printed logs before the final JSON
                const lines = stdoutData.trim().split('\n');
                const lastLine = lines[lines.length - 1];
                const parsedOutput = JSON.parse(lastLine);

                if (parsedOutput.status === 'error') {
                    reject(parsedOutput);
                } else {
                    resolve(parsedOutput);
                }
            } catch (e) {
                reject({
                    status: 'error',
                    message: 'Failed to parse Python script output',
                    rawOutput: stdoutData,
                    stderr: stderrData
                });
            }
        });
    });
};

// Global Execution Queue Chain to prevent concurrent DB locking by Python processes
let queueChain = Promise.resolve();

const queuedMemoryBridge = (profile, action, data) => {
    return new Promise((resolve, reject) => {
        queueChain = queueChain.then(() => {
            return callMemoryBridge(profile, action, data).then(resolve).catch(reject);
        });
    });
};

app.get('/', (req, res) => {
    res.json({ status: 'online', app: 'Sift Backend Engine' });
});

// 4. Base Test Endpoint
app.get('/api/health', async (req, res) => {
    try {
        const result = await queuedMemoryBridge(req.userProfile, 'health_check', { test: true });
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

        const result = await queuedMemoryBridge(req.userProfile, 'ingest', { text });
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
        
        const result = await queuedMemoryBridge(req.userProfile, 'recover', { query });
        res.status(200).json(result);
    } catch (error) {
        console.error('Oracle Pipeline Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error during recovery lookup.', details: error });
    }
});

// Phase 3: Analytics Engine
app.get('/api/memory/blindspots', async (req, res) => {
    try {
        const result = await queuedMemoryBridge(req.userProfile, 'blindspots', {});
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

        const result = await queuedMemoryBridge(req.userProfile, 'update', {
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

app.listen(PORT, () => {
    console.log(`Sift backend running on port ${PORT}`);
});

process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection:', reason); });
process.on('uncaughtException', (error) => { console.error('Uncaught Exception:', error); });
