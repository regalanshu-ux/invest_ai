import { StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import YahooFinanceClass from 'yahoo-finance2';
import dotenv from 'dotenv';

dotenv.config();

const yahooFinance = new YahooFinanceClass();

// Initialize the model based on environment variables
let model;
let resolverModel;

const provider = (process.env.LLM_PROVIDER || 'groq').toLowerCase();
const envModelName = process.env.LLM_MODEL;
const apiKey = process.env.LLM_API_KEY;
const baseUrl = process.env.LLM_BASE_URL;

if (provider === 'groq') {
  const modelName = envModelName || "llama-3.1-8b-instant";
  console.log(`[Agent] Initializing Groq models. Active model: ${modelName}`);
  model = new ChatOpenAI({
    apiKey: apiKey || process.env.GROQ_API_KEY,
    openAIApiKey: apiKey || process.env.GROQ_API_KEY,
    configuration: {
      baseURL: "https://api.groq.com/openai/v1",
    },
    modelName: modelName,
    temperature: 0.1,
    maxTokens: 1000
  });
  resolverModel = new ChatOpenAI({
    apiKey: apiKey || process.env.GROQ_API_KEY,
    openAIApiKey: apiKey || process.env.GROQ_API_KEY,
    configuration: {
      baseURL: "https://api.groq.com/openai/v1",
    },
    modelName: modelName,
    temperature: 0.1,
    maxTokens: 150
  });
} else if (provider === 'openrouter') {
  const modelName = envModelName || "meta-llama/llama-3.1-8b-instruct";
  console.log(`[Agent] Initializing OpenRouter models. Active model: ${modelName}`);
  model = new ChatOpenAI({
    apiKey: apiKey || process.env.OPENROUTER_API_KEY,
    openAIApiKey: apiKey || process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/regalanshu-ux/invest_ai",
        "X-Title": "investAI Investment Agent"
      }
    },
    modelName: modelName,
    temperature: 0.1,
    maxTokens: 1000
  });
  resolverModel = new ChatOpenAI({
    apiKey: apiKey || process.env.OPENROUTER_API_KEY,
    openAIApiKey: apiKey || process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/regalanshu-ux/invest_ai",
        "X-Title": "investAI Investment Agent"
      }
    },
    modelName: modelName,
    temperature: 0.1,
    maxTokens: 150
  });
} else if (provider === 'openai' || provider === 'custom') {
  const modelName = envModelName || "gpt-4o-mini";
  console.log(`[Agent] Initializing Custom OpenAI-compatible models: ${modelName} at ${baseUrl}`);
  model = new ChatOpenAI({
    apiKey: apiKey,
    openAIApiKey: apiKey,
    configuration: {
      baseURL: baseUrl
    },
    modelName: modelName,
    temperature: 0.1,
    maxTokens: 1000
  });
  resolverModel = new ChatOpenAI({
    apiKey: apiKey,
    openAIApiKey: apiKey,
    configuration: {
      baseURL: baseUrl
    },
    modelName: modelName,
    temperature: 0.1,
    maxTokens: 150
  });
} else {
  throw new Error(`Unsupported LLM provider: ${provider}. Supported providers are: groq, openrouter, openai, custom.`);
}

function escapeRawNewlines(str) {
  let inString = false;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && (i === 0 || str[i-1] !== '\\')) {
      inString = !inString;
      result += char;
    } else if (inString && char === '\n') {
      result += '\\n';
    } else if (inString && char === '\r') {
      result += '\\r';
    } else {
      result += char;
    }
  }
  return result;
}

// JSON extraction helper for Llama 3
function extractJSON(text) {
  if (!text) return null;
  try {
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      let rawJsonStr = text.substring(startIdx, endIdx + 1);
      // Replace triple quotes python-style strings with single double quotes
      rawJsonStr = rawJsonStr.replace(/"""/g, '"');
      const jsonStr = escapeRawNewlines(rawJsonStr);
      return JSON.parse(jsonStr);
    }
  } catch (e) {
    console.error('Failed to parse extracted JSON. Error:', e.message);
  }
  
  // Direct parsing fallback
  try {
    return JSON.parse(escapeRawNewlines(text.replace(/"""/g, '"')));
  } catch (e) {
    return null;
  }
}

// Helper to log progress inside the graph state
function createLog(stepName, message) {
  return [{
    stepName,
    message,
    timestamp: new Date().toISOString()
  }];
}

// 1. Ticker Resolver Node
async function resolveTickerNode(state) {
  const query = state.query;
  console.log(`[Agent] Resolving ticker for query: "${query}"`);
  
  let suggestedTicker = "";
  let suggestedName = "";
  
  try {
    // Search Yahoo Finance first to get closest matches
    const searchResults = await yahooFinance.search(query);
    if (searchResults && searchResults.quotes && searchResults.quotes.length > 0) {
      // Find the first equity asset
      const equity = searchResults.quotes.find(q => q.quoteType === 'EQUITY' || q.typeDisp === 'Equity') || searchResults.quotes[0];
      suggestedTicker = equity.symbol;
      suggestedName = equity.longname || equity.shortname || equity.symbol;
    }
  } catch (e) {
    console.error("Yahoo Finance search error:", e);
  }
  
  const prompt = `You are a financial asset resolver.
The user wants to research: "${query}".
Yahoo Finance search suggestion: Ticker "${suggestedTicker}" (Company "${suggestedName}").

Confirm if this is the correct ticker for trading on US or major international exchanges. If Yahoo Finance search is empty or incorrect, resolve it to the correct ticker symbol, official company name, and company's country of origin.

CRITICAL COMPANY NAME RULE:
- Do not return any short form, colloquial name, brand name, or abbreviation for the company name (e.g. do not return "Apple", "Google", "Amazon", "Microsoft", "Tata Motors").
- You must resolve and output the official, full registered corporate name of the company (e.g. "Apple Inc.", "Alphabet Inc.", "Amazon.com, Inc.", "Microsoft Corporation", "Tata Motors Limited").

CRITICAL TICKER RULE:
- For international stocks (outside the US), Yahoo Finance requires the exchange suffix.
- For example, Indian NSE stocks require the '.NS' suffix (e.g., 'RELIANCE.NS' instead of 'RIL' or 'RELIANCE'). Japanese stocks require '.T' (e.g. '7203.T'). London stocks require '.L' (e.g. 'BP.L').
- Make sure you include the proper suffix for non-US assets so Yahoo Finance API does not error out.

Respond ONLY with a JSON object in this format:
{
  "ticker": "TICKER_SYMBOL",
  "companyName": "OFFICIAL_COMPANY_NAME",
  "country": "COMPANY_COUNTRY_OF_ORIGIN"
}
Ensure there is no conversational text, just JSON.`;

  let responseText = "";
  try {
    const res = await resolverModel.invoke(prompt);
    responseText = res.content;
  } catch (e) {
    console.error("LLM resolve ticker error, falling back to search suggestion:", e);
    return {
      ticker: suggestedTicker || query.toUpperCase(),
      companyName: suggestedName || query,
      country: "Unknown",
      logs: createLog("resolver", `Resolved ticker to ${suggestedTicker || query.toUpperCase()} (Fallback)`)
    };
  }
  
  const parsed = extractJSON(responseText);
  const finalTicker = (parsed && parsed.ticker) ? parsed.ticker.toUpperCase() : (suggestedTicker || query.toUpperCase());
  const finalName = (parsed && parsed.companyName) ? parsed.companyName : (suggestedName || query);
  const finalCountry = (parsed && parsed.country) ? parsed.country : "Unknown";
  
  return {
    ticker: finalTicker,
    companyName: finalName,
    country: finalCountry,
    logs: createLog("resolver", `Successfully resolved "${query}" to ticker: ${finalTicker} (${finalName}) in ${finalCountry}`)
  };
}

// 2. Financial Fetcher Node
async function fetchFinancialDataNode(state) {
  const ticker = state.ticker;
  console.log(`[Agent] Fetching financial data for: ${ticker}`);
  
  try {
    // 1. Fetch Quote
    const quote = await yahooFinance.quote(ticker);
    
    // 2. Fetch financial modules
    const quoteSummary = await yahooFinance.quoteSummary(ticker, {
      modules: [
        'summaryDetail',
        'defaultKeyStatistics',
        'financialData',
        'assetProfile'
      ]
    });
    
    // 3. Fetch recent news
    const searchRes = await yahooFinance.search(ticker);
    const news = (searchRes && searchRes.news) ? searchRes.news.slice(0, 3) : [];
    
    // 4. Fetch 1 year of historical prices
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    
    let historicalPrices = [];
    try {
      const chartResult = await yahooFinance.chart(ticker, {
        period1: oneYearAgo,
        period2: today,
        interval: '1d'
      });
      if (chartResult && chartResult.quotes) {
        // Map to simpler format and filter out nulls
        historicalPrices = chartResult.quotes
          .filter(q => q.date && q.close !== null && q.close !== undefined)
          .map(q => ({
            date: new Date(q.date).toISOString().split('T')[0],
            close: parseFloat(q.close.toFixed(2))
          }));
      }
    } catch (chartError) {
      console.error("Historical chart fetch error:", chartError);
    }
    
    // Compile statistics
    const summaryDetail = quoteSummary?.summaryDetail || {};
    const keyStats = quoteSummary?.defaultKeyStatistics || {};
    const finData = quoteSummary?.financialData || {};
    const assetProfile = quoteSummary?.assetProfile || {};
    const countryFromProfile = assetProfile.country || null;
    
    const formattedStats = {
      price: quote.regularMarketPrice || finData.currentPrice || summaryDetail.regularMarketOpen,
      changePercent: quote.regularMarketChangePercent || 0,
      marketCap: summaryDetail.marketCap || keyStats.marketCap || 0,
      peRatio: summaryDetail.trailingPE || quote.trailingPE || null,
      forwardPeRatio: summaryDetail.forwardPE || quote.forwardPE || null,
      pegRatio: keyStats.pegRatio || null,
      priceToBook: keyStats.priceToBook || null,
      fiftyTwoWeekHigh: summaryDetail.fiftyTwoWeekHigh || null,
      fiftyTwoWeekLow: summaryDetail.fiftyTwoWeekLow || null,
      dividendYield: summaryDetail.dividendYield || null,
      beta: summaryDetail.beta || null,
      currency: quote.currency || finData.financialCurrency || 'USD'
    };
    
    const formattedFinancials = {
      totalRevenue: finData.totalRevenue || null,
      revenueGrowth: finData.revenueGrowth || null,
      grossProfit: finData.grossProfits || null,
      ebitda: finData.ebitda || null,
      netIncome: keyStats.netIncomeToCommon || null,
      profitMargin: finData.profitMargins || keyStats.profitMargins || null,
      operatingMargin: finData.operatingMargins || null,
      returnOnEquity: finData.returnOnEquity || null,
      totalCash: finData.totalCash || null,
      totalDebt: finData.totalDebt || null,
      debtToEquity: finData.debtToEquity || null,
      currentRatio: finData.currentRatio || null,
      operatingCashflow: finData.operatingCashflow || null,
      freeCashflow: finData.freeCashflow || null
    };
    
    return {
      keyStats: formattedStats,
      financials: formattedFinancials,
      news: news.map(item => ({
        title: item.title,
        publisher: item.publisher,
        link: item.link,
        publishedAt: item.providerPublishTime
      })),
      historicalPrices: historicalPrices,
      country: countryFromProfile || state.country || 'Unknown',
      logs: createLog("fetcher", `Successfully fetched data from Yahoo Finance for ${ticker}. Collected quote, key metrics, and ${news.length} news items.`)
    };
  } catch (e) {
    console.error(`Error fetching Yahoo Finance data for ${ticker}:`, e);
    return {
      keyStats: {},
      financials: {},
      news: [],
      historicalPrices: [],
      country: state.country || 'Unknown',
      logs: createLog("fetcher", `Error fetching Yahoo Finance data for ${ticker}: ${e.message}`)
    };
  }
}

// 3. Unified Analyst Panel Node
async function analystPanelNode(state) {
  const { companyName, ticker, keyStats, financials, news } = state;
  console.log(`[Agent] Running unified analyst panel for ${ticker}`);
  
  if (!keyStats || !financials || Object.keys(keyStats).length === 0) {
    return {
      fundamentalAnalysis: "Fundamental data not available for analysis.",
      sentimentAnalysis: { score: 0, explanation: "No data", bullishPoints: [], bearishPoints: [] },
      riskAnalysis: "Risk analysis data not available.",
      recommendation: {
        decision: "PASS",
        confidence: 0,
        fairValueRange: "N/A",
        summary: "Aborted research due to missing stock details.",
        swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
        fullThesis: "The research run was aborted because financial details could not be downloaded."
      },
      logs: createLog("panel", "Aborted analysis due to empty stock data.")
    };
  }

  const currencyCode = keyStats.currency || 'USD';
  const getSymbol = (code) => {
    switch(code.toUpperCase()) {
      case 'USD': return '$';
      case 'INR': return '₹';
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'JPY': return '¥';
      case 'CAD': return 'C$';
      case 'AUD': return 'A$';
      default: return code + ' ';
    }
  };
  const currencySymbol = getSymbol(currencyCode);

  const headlines = news ? news.map((n, i) => `${i + 1}. ${n.title} (Publisher: ${n.publisher})`).join("\n") : "None";
  
  const prompt = `You are an elite AI Investment Research Panel. Your task is to perform a comprehensive research analysis on ${companyName} (${ticker}) and make a final investment decision.

Here is the data fetched:
---
STOCK QUOTE:
Price: ${currencySymbol}${keyStats.price} (Reporting Currency: ${currencyCode})
Market Cap: ${currencySymbol}${(keyStats.marketCap / 1e9).toFixed(2)} Billion
Trailing P/E: ${keyStats.peRatio || 'N/A'}
Forward P/E: ${keyStats.forwardPeRatio || 'N/A'}
PEG Ratio: ${keyStats.pegRatio || 'N/A'}
Price/Book: ${keyStats.priceToBook || 'N/A'}
Beta: ${keyStats.beta || 'N/A'}

FINANCIALS (in ${currencyCode} / Symbol: ${currencySymbol}):
Revenue: ${currencySymbol}${financials.totalRevenue ? (financials.totalRevenue / 1e9).toFixed(2) + ' B' : 'N/A'} (YoY Growth: ${financials.revenueGrowth ? (financials.revenueGrowth * 100).toFixed(2) + '%' : 'N/A'})
Net Income: ${currencySymbol}${financials.netIncome ? (financials.netIncome / 1e9).toFixed(2) + ' B' : 'N/A'} (Margin: ${financials.profitMargin ? (financials.profitMargin * 100).toFixed(2) + '%' : 'N/A'})
FCF: ${currencySymbol}${financials.freeCashflow ? (financials.freeCashflow / 1e9).toFixed(2) + ' B' : 'N/A'}
Operating Cash Flow: ${currencySymbol}${financials.operatingCashflow ? (financials.operatingCashflow / 1e9).toFixed(2) + ' B' : 'N/A'}
Debt to Equity: ${financials.debtToEquity || 'N/A'}
Current Ratio: ${financials.currentRatio || 'N/A'}
Cash: ${currencySymbol}${financials.totalCash ? (financials.totalCash / 1e9).toFixed(2) + ' B' : 'N/A'} | Debt: ${currencySymbol}${financials.totalDebt ? (financials.totalDebt / 1e9).toFixed(2) + ' B' : 'N/A'}

NEWS HEADLINES:
${headlines}
---

Your response must be a single, valid JSON object containing the following reports:
1. "fundamentalAnalysis": A concise fundamental analyst review (valuation, profitability, health, strengths, weaknesses) in Markdown format. Keep it under 200 words. Report prices/targets utilizing the proper currency symbol: ${currencySymbol}.
2. "sentimentAnalysis": A JSON object containing:
   - "score": A float between -1.0 and 1.0.
   - "explanation": Brief summary of news sentiment.
   - "bullishPoints": Array of 2 bullish points.
   - "bearishPoints": Array of 2 bearish points.
3. "riskAnalysis": A concise CRO risk report (financial, operational, macro, overall rating) in Markdown format. Keep it under 150 words.
4. "recommendation": A JSON object containing:
   - "decision": "BUY" | "HOLD" | "SELL" | "PASS"
   - "confidence": Integer 0-100
   - "fairValueRange": String (e.g. "${currencySymbol}180 - ${currencySymbol}200" using the proper currency symbol ${currencySymbol})
   - "summary": A 2-3 sentence overview.
   - "swot": { "strengths": [...], "weaknesses": [...], "opportunities": [...], "threats": [...] }
   - "fullThesis": A concise research thesis memo explaining the decision. Keep it under 200 words.

Format the response strictly as a JSON object, without any conversational text before or after.

CRITICAL JSON SYNTAX RULES:
- Never use double quotes inside string values. If you need to quote something inside your markdown text, use single quotes (e.g. 'like this') instead of double quotes. Double quotes inside strings will corrupt the JSON parsing.
- Ensure there are no trailing commas at the end of lists or objects (e.g. [1, 2] instead of [1, 2,]).
- Output valid JSON only. Do not include markdown codeblock wrappers (like \`\`\`json ... \`\`\`) in your output. Just start with { and end with }.`;

  try {
    const res = await model.invoke(prompt);
    const parsed = extractJSON(res.content);
    
    if (parsed && parsed.recommendation && parsed.fundamentalAnalysis) {
      return {
        fundamentalAnalysis: parsed.fundamentalAnalysis,
        sentimentAnalysis: parsed.sentimentAnalysis || { score: 0, explanation: "None", bullishPoints: [], bearishPoints: [] },
        riskAnalysis: parsed.riskAnalysis || "Risk details not available.",
        recommendation: parsed.recommendation,
        logs: createLog("panel", `Unified research panel complete. Compiled fundamental report, sentiment rating, risk score, and final thesis.`)
      };
    } else {
      throw new Error("Invalid format in panel response");
    }
  } catch (e) {
    console.error("Unified panel error:", e);
    return {
      fundamentalAnalysis: "Fundamental analysis failed due to system error.",
      sentimentAnalysis: { score: 0, explanation: "Sentiment analysis failed", bullishPoints: [], bearishPoints: [] },
      riskAnalysis: "Risk analysis failed due to system error.",
      recommendation: {
        decision: "PASS",
        confidence: 0,
        fairValueRange: "N/A",
        summary: "Unable to form recommendation.",
        swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
        fullThesis: `The analyst panel crashed: ${e.message}`
      },
      logs: createLog("panel", `Error: ${e.message}`)
    };
  }
}

// ==========================================
// LANGGRAPH WORKFLOW CONFIGURATION
// ==========================================

const graphChannels = {
  query: { value: null },
  ticker: { value: null },
  companyName: { value: null },
  country: { value: null },
  historicalPrices: { value: null },
  keyStats: { value: null },
  financials: { value: null },
  news: { value: null },
  fundamentalAnalysis: { value: null },
  sentimentAnalysis: { value: null },
  riskAnalysis: { value: null },
  recommendation: { value: null },
  logs: {
    value: (a, b) => (a || []).concat(b || []),
    default: () => []
  }
};

const workflow = new StateGraph({
  channels: graphChannels
});

// Register nodes
workflow.addNode("resolver", resolveTickerNode);
workflow.addNode("fetcher", fetchFinancialDataNode);
workflow.addNode("analystPanel", analystPanelNode);

// Define edges
workflow.addEdge("__start__", "resolver");
workflow.addEdge("resolver", "fetcher");
workflow.addEdge("fetcher", "analystPanel");
workflow.addEdge("analystPanel", "__end__");

// Compile the workflow graph
export const researchAgent = workflow.compile();
