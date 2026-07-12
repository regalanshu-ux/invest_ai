import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb, saveReport, getAllReports, getReportById, clearAllReports } from './db.js';
import { researchAgent } from './agent.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle Chrome/Edge Private Network Access (PNA) preflights (allowing public Vercel to connect to localhost)
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

app.use(express.json());

// Initialize SQLite database
try {
  await initDb();
  console.log('Database initialized successfully.');
} catch (err) {
  console.error('Failed to initialize database:', err);
  process.exit(1);
}

// REST: Get list of all past reports (metadata only for sidebar)
app.get('/api/reports', async (req, res) => {
  try {
    const reports = await getAllReports();
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve reports' });
  }
});

// REST: Get details of a single report
app.get('/api/reports/:id', async (req, res) => {
  try {
    const report = await getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve report details' });
  }
});

// REST: Clear all report evaluations from database
app.delete('/api/reports', async (req, res) => {
  try {
    await clearAllReports();
    res.json({ message: 'History cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

// REST: Get current LLM configuration
app.get('/api/config', (req, res) => {
  const provider = process.env.LLM_PROVIDER || 'groq';
  const model = process.env.LLM_MODEL || (
    provider === 'groq' ? 'llama-3.1-8b-instant' :
    provider === 'openrouter' ? 'meta-llama/llama-3.1-8b-instruct' :
    'gpt-4o-mini'
  );
  res.json({ provider, model });
});

// SSE: Run a new research job and stream intermediate state chunks
app.get('/api/research/run', async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  console.log(`[Server] Starting research request for query: "${query}"`);

  // Establish SSE connection
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Content-Encoding': 'none'
  });
  
  // Send initial ping/connection event
  res.write(`data: ${JSON.stringify({ step: 'connected', message: 'Connection established. Initiating agent.' })}\n\n`);

  try {
    // Accumulator for the graph state
    let currentState = {
      query: query,
      ticker: '',
      companyName: '',
      country: '',
      historicalPrices: [],
      keyStats: {},
      financials: {},
      news: [],
      fundamentalAnalysis: '',
      sentimentAnalysis: {},
      riskAnalysis: '',
      recommendation: null,
      logs: []
    };

    // Run the graph as a stream of steps
    const eventStream = await researchAgent.stream({ query: query });
    
    for await (const chunk of eventStream) {
      // chunk represents the output of the node(s) completed in this step
      for (const [nodeName, nodeOutput] of Object.entries(chunk)) {
        console.log(`[Server] Completed node: "${nodeName}"`);
        
        // Merge output fields into our accumulator
        if (nodeOutput.ticker) currentState.ticker = nodeOutput.ticker;
        if (nodeOutput.companyName) currentState.companyName = nodeOutput.companyName;
        if (nodeOutput.country) currentState.country = nodeOutput.country;
        if (nodeOutput.historicalPrices) currentState.historicalPrices = nodeOutput.historicalPrices;
        if (nodeOutput.keyStats) currentState.keyStats = nodeOutput.keyStats;
        if (nodeOutput.financials) currentState.financials = nodeOutput.financials;
        if (nodeOutput.news) currentState.news = nodeOutput.news;
        if (nodeOutput.fundamentalAnalysis) currentState.fundamentalAnalysis = nodeOutput.fundamentalAnalysis;
        if (nodeOutput.sentimentAnalysis) currentState.sentimentAnalysis = nodeOutput.sentimentAnalysis;
        if (nodeOutput.riskAnalysis) currentState.riskAnalysis = nodeOutput.riskAnalysis;
        if (nodeOutput.recommendation) currentState.recommendation = nodeOutput.recommendation;
        
        if (nodeOutput.logs) {
          currentState.logs = currentState.logs.concat(nodeOutput.logs);
        }

        if (nodeName === 'analystPanel') {
          // Send simulated progressive updates for each analysis to light up the UI steps
          const fundamentalLogs = currentState.logs.concat([{
            stepName: 'fundamental',
            message: 'Fundamental analyst report compiled successfully.',
            timestamp: new Date().toISOString()
          }]);
          res.write(`data: ${JSON.stringify({
            step: 'fundamental',
            update: { fundamentalAnalysis: nodeOutput.fundamentalAnalysis },
            currentLogs: fundamentalLogs
          })}\n\n`);
          currentState.logs = fundamentalLogs;

          await new Promise(r => setTimeout(r, 600));

          const sentimentLogs = currentState.logs.concat([{
            stepName: 'sentiment',
            message: `Sentiment rating computed: ${nodeOutput.sentimentAnalysis?.score || 0}.`,
            timestamp: new Date().toISOString()
          }]);
          res.write(`data: ${JSON.stringify({
            step: 'sentiment',
            update: { sentimentAnalysis: nodeOutput.sentimentAnalysis },
            currentLogs: sentimentLogs
          })}\n\n`);
          currentState.logs = sentimentLogs;

          await new Promise(r => setTimeout(r, 600));

          const riskLogs = currentState.logs.concat([{
            stepName: 'risk',
            message: 'CRO Risk assessment finalized.',
            timestamp: new Date().toISOString()
          }]);
          res.write(`data: ${JSON.stringify({
            step: 'risk',
            update: { riskAnalysis: nodeOutput.riskAnalysis },
            currentLogs: riskLogs
          })}\n\n`);
          currentState.logs = riskLogs;

          await new Promise(r => setTimeout(r, 600));

          const committeeLogs = currentState.logs.concat([{
            stepName: 'committee',
            message: `Investment Committee consensus: ${nodeOutput.recommendation?.decision}.`,
            timestamp: new Date().toISOString()
          }]);
          res.write(`data: ${JSON.stringify({
            step: 'committee',
            update: { recommendation: nodeOutput.recommendation },
            currentLogs: committeeLogs
          })}\n\n`);
          currentState.logs = committeeLogs;
        } else {
          // Standard send event for resolver/fetcher
          res.write(`data: ${JSON.stringify({
            step: nodeName,
            update: nodeOutput,
            currentLogs: currentState.logs
          })}\n\n`);
        }
      }
    }

    // Graph finished, verify we have a valid recommendation
    if (!currentState.recommendation) {
      throw new Error('Research completed but no recommendation was produced by the Investment Committee.');
    }

    // Save report to database
    console.log(`[Server] Saving research report for ${currentState.ticker} to database.`);
    const savedReport = await saveReport({
      ticker: currentState.ticker,
      companyName: currentState.companyName,
      country: currentState.country,
      decision: currentState.recommendation.decision,
      confidence: currentState.recommendation.confidence,
      summary: currentState.recommendation.summary,
      details: {
        country: currentState.country,
        historicalPrices: currentState.historicalPrices,
        keyStats: currentState.keyStats,
        financials: currentState.financials,
        news: currentState.news,
        fundamentalAnalysis: currentState.fundamentalAnalysis,
        sentimentAnalysis: currentState.sentimentAnalysis,
        riskAnalysis: currentState.riskAnalysis,
        recommendation: currentState.recommendation,
        logs: currentState.logs
      }
    });

    // Send complete event with the report ID
    res.write(`data: ${JSON.stringify({
      step: 'complete',
      reportId: savedReport.id,
      report: savedReport
    })}\n\n`);
    
  } catch (err) {
    console.error('[Server] Research agent stream failed:', err);
    res.write(`data: ${JSON.stringify({
      step: 'error',
      message: err.message || 'An error occurred during investment research.'
    })}\n\n`);
  } finally {
    res.end();
    console.log(`[Server] Closed connection for query: "${query}"`);
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
