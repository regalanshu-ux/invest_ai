import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

let client;
let db;

export async function initDb() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-investment-research';
    client = new MongoClient(uri);
    await client.connect();
    db = client.db();
    console.log('Connected to MongoDB database successfully.');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    throw err;
  }
}

export async function saveReport({ ticker, companyName, country, decision, confidence, summary, details }) {
  try {
    const collection = db.collection('reports');
    
    let parsedDetails = details;
    if (typeof details === 'string') {
      try {
        parsedDetails = JSON.parse(details);
      } catch (e) {
        // Fallback if not valid JSON
      }
    }

    const document = {
      ticker,
      companyName,
      country: country || 'Unknown',
      decision,
      confidence,
      summary,
      details: parsedDetails,
      createdAt: new Date()
    };
    
    const result = await collection.insertOne(document);
    
    return {
      id: blockIdToString(result.insertedId),
      ticker,
      companyName,
      country: document.country,
      decision,
      confidence,
      summary,
      details: parsedDetails,
      createdAt: document.createdAt.toISOString()
    };
  } catch (err) {
    console.error('Error saving report to MongoDB:', err);
    throw err;
  }
}

function blockIdToString(id) {
  return id ? id.toString() : '';
}

export async function getAllReports() {
  try {
    const collection = db.collection('reports');
    const docs = await collection.find({}, {
      projection: {
        ticker: 1,
        companyName: 1,
        country: 1,
        decision: 1,
        confidence: 1,
        summary: 1,
        createdAt: 1
      }
    }).sort({ createdAt: -1 }).toArray();

    return docs.map(doc => ({
      id: doc._id.toString(),
      ticker: doc.ticker,
      companyName: doc.companyName,
      country: doc.country || 'Unknown',
      decision: doc.decision,
      confidence: doc.confidence,
      summary: doc.summary,
      createdAt: doc.createdAt
    }));
  } catch (err) {
    console.error('Error getting reports from MongoDB:', err);
    throw err;
  }
}

export async function getReportById(id) {
  try {
    const collection = db.collection('reports');
    let queryId;
    try {
      queryId = new ObjectId(id);
    } catch (e) {
      return null;
    }
    const doc = await collection.findOne({ _id: queryId });
    if (!doc) return null;
    
    return {
      id: doc._id.toString(),
      ticker: doc.ticker,
      companyName: doc.companyName,
      country: doc.country || 'Unknown',
      decision: doc.decision,
      confidence: doc.confidence,
      summary: doc.summary,
      details: doc.details,
      createdAt: doc.createdAt
    };
  } catch (err) {
    console.error('Error getting report by ID from MongoDB:', err);
    throw err;
  }
}

export async function clearAllReports() {
  try {
    const collection = db.collection('reports');
    await collection.deleteMany({});
  } catch (err) {
    console.error('Error clearing reports in MongoDB:', err);
    throw err;
  }
}
