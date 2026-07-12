import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ChatOpenAI } from '@langchain/openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const model = new ChatOpenAI({
  apiKey: process.env.LLM_API_KEY,
  configuration: {
    baseURL: 'https://api.groq.com/openai/v1',
  },
  modelName: 'llama-3.1-8b-instant'
});

async function run() {
  const query = "Reliance Industries";
  const suggestedTicker = "RS";
  const suggestedName = "Reliance, Inc.";
  
  const prompt = `You are a financial asset resolver.
The user wants to research: "${query}".
Yahoo Finance search suggestion: Ticker "${suggestedTicker}" (Company "${suggestedName}").

Confirm if this is the correct ticker for trading on US or major international exchanges. If Yahoo Finance search is empty or incorrect, resolve it to the correct ticker symbol and official company name.

CRITICAL TICKER RULE:
- For international stocks (outside the US), Yahoo Finance requires the exchange suffix.
- For example, Indian NSE stocks require the '.NS' suffix (e.g., 'RELIANCE.NS' instead of 'RIL' or 'RELIANCE'). Japanese stocks require '.T' (e.g. '7203.T'). London stocks require '.L' (e.g. 'BP.L').
- Make sure you include the proper suffix for non-US assets so Yahoo Finance API does not error out.

Respond ONLY with a JSON object in this format:
{
  "ticker": "TICKER_SYMBOL",
  "companyName": "OFFICIAL_COMPANY_NAME"
}
Ensure there is no conversational text, just JSON.`;

  const res = await model.invoke(prompt);
  console.log('LLM Ticker Resolver Output with new prompt:', res.content);
}
run();
