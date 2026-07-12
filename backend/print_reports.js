import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-investment-research';
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('reports');
    
    const rows = await collection.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
      
    rows.forEach(r => {
      console.log(`=========================================`);
      console.log(`Report ID: ${r._id.toString()}`);
      console.log(`Ticker: ${r.ticker}`);
      console.log(`Company Name: ${r.companyName}`);
      console.log(`Decision: ${r.decision}`);
      console.log(`Created At: ${r.createdAt}`);
      const details = r.details || {};
      console.log(`Has Historical Prices?: ${!!details.historicalPrices && details.historicalPrices.length > 0}`);
      if (details.historicalPrices) {
        console.log(`Prices Count: ${details.historicalPrices.length}`);
      }
    });
  } catch (err) {
    console.error('Error printing reports:', err);
  } finally {
    await client.close();
  }
}

run();
