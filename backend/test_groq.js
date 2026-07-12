import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const apiKey = process.env.LLM_API_KEY;
console.log('Testing Groq Key starting with:', apiKey ? apiKey.substring(0, 10) + '...' : 'Undefined');
console.log('Key length:', apiKey ? apiKey.length : 0);

async function testDirectGroq() {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'test' }]
      })
    });
    
    console.log('Response Status:', res.status, res.statusText);
    const body = await res.text();
    console.log('Response Body:', body);
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

testDirectGroq();
