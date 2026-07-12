# investAI // AI Investment Research Agent

investAI is a premium, state-of-the-art agentic AI web application that performs automated financial research on equities. Powered by **LangGraph** and **LangChain** on the backend and featuring a modern, dark-mode dashboard built in **React (Vite)** on the frontend, it delivers institutional-grade investment evaluations.

Repository Link: [https://github.com/regalanshu-ux/invest_ai](https://github.com/regalanshu-ux/invest_ai)
Live Demo Link: [https://invest-ai-brown.vercel.app/](https://invest-ai-brown.vercel.app/)

---

## Key Features

* **AI Ticker Resolver**: Translates natural language queries (e.g., "Apple" or "Google") into correct stock ticker symbols (e.g., `AAPL`, `GOOG`) with proper exchange suffixes for international markets (e.g., `.NS` for NSE).
* **Company Country Verification**: Resolves and displays the company's verified country of origin, retrieving metadata from LLM predictions and validating it against real-time financial profiles.
* **Unified Analyst Panel**: Combines multiple AI personas in a single workflow:
  * **Fundamental Analyst**: Reviews core valuation metrics, margins, and financial health.
  * **Sentiment Analyst**: Computes a news sentiment index based on real-time market headlines.
  * **Chief Risk Officer (CRO)**: Finalizes operational, financial, and macro-economic risk scores.
  * **Investment Committee**: Builds consensus on a final evaluation (`BUY`, `HOLD`, `SELL`, or `PASS`) with confidence scores and fair value estimates.
* **Live Console Logs Stream**: Integrates real-time console pipelines right below the navbar during execution, allowing you to watch the agent think step-by-step.
* **Optimized UI Layout**: An expanded single-pane workspace equipped with dynamic interactive charts (Recharts) and a **Home** navbar button for fluid page navigation.
* **No-SQL Storage**: Integrates a persistent database layer built on **MongoDB Atlas** for secure and scalable evaluation storage.

---

## Technology Stack

* **Frontend**: React.js (Vite), Recharts, Lucide Icons, HSL CSS design system.
* **Backend**: Node.js, Express.js.
* **AI Orchestration**: LangGraph (StateGraph), LangChain Core, OpenAI SDK bindings.
* **Database**: MongoDB (via MongoClient with replica-set failovers).
* **Data Source**: Yahoo Finance API integration.

---

## Setup & Installation

### Prerequisites
* **Node.js** (v18 or higher recommended)
* **MongoDB** (Atlas connection URI or a running local instance)
* **Groq API Key** or **OpenRouter API Key** (for LLM coordination)

### 1. Clone the Repository
```bash
git clone https://github.com/regalanshu-ux/invest_ai.git
cd invest_ai
```

### 2. Configure Environment Variables
Create or edit your `backend/.env` file with the following variables:
```env
# AI Model Configuration
LLM_PROVIDER=groq
LLM_MODEL=llama-3.1-8b-instant
LLM_API_KEY=your_groq_api_key

# MongoDB Connection String (Atlas Replica-Set format recommended)
MONGODB_URI=mongodb://username:password@shard0,shard1,shard2/?authSource=admin&replicaSet=atlas-11k9c2-shard-0&ssl=true

# Server Port
PORT=5000
```

### 3. Install Dependencies
Run the unified installer script in the root directory:
```bash
npm run install:all
```
*(This automatically runs `npm install` across the root, `backend`, and `frontend` folders).*

### 4. Start Development Servers
Run the dev task to start both servers concurrently:
```bash
npm run dev
```
* **Frontend**: Runs on [http://localhost:5173](http://localhost:5173)
* **Backend**: Runs on [http://localhost:5000](http://localhost:5000)

---

## Architecture Diagram

```mermaid
graph TD
    A[React Client] -->|Search Query| B[Express server.js]
    B -->|Stream Trigger| C[LangGraph researchAgent]
    C -->|1. Resolve Ticker| D[LLM Resolver Node]
    C -->|2. Get Stats & Profiles| E[Yahoo Finance Fetcher Node]
    C -->|3. Compile Evaluations| F[Analyst Panel Node]
    F -->|Consensus Decision| G[Save to MongoDB Atlas]
    G -->|Return ID| B
    B -->|SSE Stream Logs & Data| A
```

---

## Project Structure
```
├── backend/
│   ├── agent.js         # LangGraph workflow configurations
│   ├── db.js            # MongoDB client CRUD handlers
│   ├── server.js        # Express API endpoints & SSE streaming
│   └── .env             # Server configurations & credentials
└── frontend/
    ├── src/
    │   ├── App.jsx      # Core Dashboard application component
    │   ├── index.css    # Style definitions & design system
    │   └── main.jsx     # Vite client entry point
    └── index.html       # Client HTML page container
```

---

## Deployment Guide

Deploying this monorepo application involves launching the React client on Vercel and hosting the persistent Node.js Express server on a long-running instance provider (like Render, Railway, or Heroku).

### 1. Deploying Frontend (React/Vite) on Vercel
1. Log in to [Vercel](https://vercel.com) and click **Add New** > **Project**.
2. Select your cloned Git repository `https://github.com/regalanshu-ux/invest_ai`.
3. In the project setup panel, click **Edit** next to **Root Directory** and select `frontend`.
4. Vercel will automatically select the **Vite** framework preset.
5. In **Environment Variables**, add:
   * `VITE_BACKEND_URL`: `https://invest-ai.onrender.com` (point this to your deployed Express backend URL).
6. Click **Deploy**.

> [!NOTE]
> Make sure to update the fetch URLs in `frontend/src/App.jsx` to dynamically point to `import.meta.env.VITE_BACKEND_URL` in production.

### 2. Deploying Backend (Express/Node) on Render / Railway
Because the Express backend streams real-time console updates (via Server-Sent Events) and coordinates multiple LLM API request links which can exceed standard Vercel serverless function timeouts (typically 10-15s), it is best deployed on a persistent Node.js platform:
1. Log in to [Render](https://render.com) or Railway and select **New Web Service**.
2. Link your Git repository.
3. Configure the following build properties:
   * **Root Directory**: `backend`
   * **Build Command**: `npm install`
   * **Start Command**: `npm run dev` (or `node server.js`)
4. In the service's Environment Variables, paste the parameters from your `backend/.env` file:
   * `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`
   * `MONGODB_URI` (your resolved MongoDB Atlas connection string)
   * `PORT`: `5000` (or leave default)
5. Click **Create Web Service**. Once deployed, copy your custom web service URL and paste it as the `VITE_BACKEND_URL` environment variable in your Vercel React frontend.

