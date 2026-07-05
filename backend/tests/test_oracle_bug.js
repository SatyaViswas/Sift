const fetch = require('node-fetch');

async function test() {
    const text = "I love the movie Inception because of its mind-bending plot.";
    console.log("Adding memory...");
    const resAdd = await fetch('http://127.0.0.1:5051/api/memory/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, timestamp: new Date().toISOString(), isSnippet: true })
    });
    console.log("Add response:", await resAdd.json());

    console.log("\nQuerying Oracle...");
    const resOracle = await fetch('http://127.0.0.1:5051/api/memory/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: "What movies do I like?" })
    });
    const oracleJson = await resOracle.json();
    console.log("Oracle response:", JSON.stringify(oracleJson, null, 2));
}

test();
