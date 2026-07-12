import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, Search, TrendingUp, AlertTriangle, TrendingDown, Info, Layers, 
  BookOpen, Database, Cpu, Clock, ArrowUpRight, ExternalLink, 
  ShieldAlert, Newspaper, FileText, CheckCircle2, RefreshCw, HelpCircle
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

// Simple markdown formatter helper to avoid dependency bloat
function renderMarkdown(text) {
  if (!text) return '';
  const lines = text.split('\n');
  let inList = false;
  let html = [];
  
  for (let line of lines) {
    let trimmed = line.trim();
    
    // Title level 3
    if (trimmed.startsWith('###')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h3>${trimmed.replace(/^###\s*/, '')}</h3>`);
    } 
    // Title level 2
    else if (trimmed.startsWith('##')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h3>${trimmed.replace(/^##\s*/, '')}</h3>`);
    } 
    // Bold title lines
    else if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h3>${trimmed.substring(2, trimmed.length - 2)}</h3>`);
    }
    // Bullet list items
    else if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
      if (!inList) { html.push('<ul>'); inList = true; }
      const content = trimmed.replace(/^[\*\-]\s*/, '');
      const formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      html.push(`<li>${formatted}</li>`);
    }
    // Empty line
    else if (trimmed === '') {
      if (inList) { html.push('</ul>'); inList = false; }
    }
    // Standard paragraph line
    else {
      if (inList) { html.push('</ul>'); inList = false; }
      const formatted = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      html.push(`<p>${formatted}</p>`);
    }
  }
  if (inList) html.push('</ul>');
  return html.join('\n');
}

// Utility to format numbers into clean financial notation
function formatMoney(value, symbol = '$') {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  if (Math.abs(value) >= 1e12) return `${symbol}${(value / 1e12).toFixed(2)} T`;
  if (Math.abs(value) >= 1e9) return `${symbol}${(value / 1e9).toFixed(2)} B`;
  if (Math.abs(value) >= 1e6) return `${symbol}${(value / 1e6).toFixed(2)} M`;
  return `${symbol}${value.toLocaleString()}`;
}

// Resolve currency symbol from currency code
function getCurrencySymbol(code) {
  if (!code) return '$';
  switch(code.toUpperCase()) {
    case 'USD': return '$';
    case 'INR': return '₹';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'JPY': return '¥';
    case 'CAD': return 'C$';
    case 'AUD': return 'A$';
    case 'HKD': return 'HK$';
    default: return code + ' ';
  }
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function App() {
  const [query, setQuery] = useState('');
  const [reportsHistory, setReportsHistory] = useState([]);
  const [activeReportId, setActiveReportId] = useState(null);
  const [activeReport, setActiveReport] = useState(null);
  const [activeReportTab, setActiveReportTab] = useState('thesis');
  const [llmConfig, setLlmConfig] = useState({ provider: 'groq', model: 'llama-3.1-8b-instant' });
  
  // Running/Streaming states
  const [isLoading, setIsLoading] = useState(false);
  const [activeStage, setActiveStage] = useState('idle'); // idle, resolver, fetcher, fundamental, sentiment, risk, committee
  const [currentLogs, setCurrentLogs] = useState([]);
  const [streamData, setStreamData] = useState({
    ticker: '',
    companyName: '',
  });

  const topTerminalRef = useRef(null);
  const tabTerminalRef = useRef(null);

  // Fetch reports history on mount
  useEffect(() => {
    fetchHistory();
    fetchConfig();
  }, []);

  // Scroll to bottom of terminal containers when logs change
  useEffect(() => {
    if (topTerminalRef.current) {
      topTerminalRef.current.scrollTop = topTerminalRef.current.scrollHeight;
    }
    if (tabTerminalRef.current) {
      tabTerminalRef.current.scrollTop = tabTerminalRef.current.scrollHeight;
    }
  }, [currentLogs]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/reports`);
      const data = await res.json();
      setReportsHistory(data);
    } catch (e) {
      console.error('Error fetching research history:', e);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/config`);
      if (res.ok) {
        const data = await res.json();
        setLlmConfig(data);
      }
    } catch (e) {
      console.error('Error fetching LLM config:', e);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear all research history? This cannot be undone.")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/reports`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setReportsHistory([]);
        setActiveReport(null);
        setActiveReportId(null);
      } else {
        alert('Failed to clear research history.');
      }
    } catch (e) {
      console.error('Error clearing history:', e);
      alert('Error connecting to backend.');
    }
  };

  const loadReportDetails = async (id) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/reports/${id}`);
      const data = await res.json();
      setActiveReport(data);
      setActiveReportId(id);
      setIsLoading(false);
      setActiveReportTab('thesis');
    } catch (e) {
      console.error('Error loading report details:', e);
    }
  };

  const runResearch = async (searchQuery) => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    // Initialize activeReport state immediately to transition to dashboard viewer
    setActiveReport({
      companyName: searchQuery,
      ticker: '...',
      details: {
        keyStats: {},
        financials: {},
        historicalPrices: [],
        news: []
      }
    });
    setActiveReportId(null);
    setActiveStage('resolver');
    setActiveReportTab('logs'); // Default to showing live logs
    setCurrentLogs([]);

    const searchUrl = `${BACKEND_URL}/api/research/run?query=${encodeURIComponent(searchQuery)}`;
    const eventSource = new EventSource(searchUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.step === 'connected') {
          setCurrentLogs([{
            stepName: 'system',
            message: data.message,
            timestamp: new Date().toISOString()
          }]);
        } 
        else if (data.step === 'resolver') {
          setActiveStage('fetcher');
          if (data.update && data.update.ticker) {
            setActiveReport(prev => ({
              ...prev,
              companyName: data.update.companyName,
              ticker: data.update.ticker,
              country: data.update.country
            }));
          }
          if (data.currentLogs) setCurrentLogs(data.currentLogs);
        }
        else if (data.step === 'fetcher') {
          setActiveStage('fundamental');
          if (data.update) {
            setActiveReport(prev => ({
              ...prev,
              country: data.update.country || prev?.country,
              details: {
                ...prev?.details,
                keyStats: data.update.keyStats,
                financials: data.update.financials,
                historicalPrices: data.update.historicalPrices,
                news: data.update.news
              }
            }));
          }
          if (data.currentLogs) setCurrentLogs(data.currentLogs);
        }
        else if (data.step === 'fundamental') {
          setActiveStage('sentiment');
          if (data.update) {
            setActiveReport(prev => ({
              ...prev,
              details: {
                ...prev?.details,
                fundamentalAnalysis: data.update.fundamentalAnalysis
              }
            }));
            setActiveReportTab('fundamentals'); // Automatically open fundamental tab when ready!
          }
          if (data.currentLogs) setCurrentLogs(data.currentLogs);
        }
        else if (data.step === 'sentiment') {
          setActiveStage('risk');
          if (data.update) {
            setActiveReport(prev => ({
              ...prev,
              details: {
                ...prev?.details,
                sentimentAnalysis: data.update.sentimentAnalysis
              }
            }));
          }
          if (data.currentLogs) setCurrentLogs(data.currentLogs);
        }
        else if (data.step === 'risk') {
          setActiveStage('committee');
          if (data.update) {
            setActiveReport(prev => ({
              ...prev,
              details: {
                ...prev?.details,
                riskAnalysis: data.update.riskAnalysis
              }
            }));
          }
          if (data.currentLogs) setCurrentLogs(data.currentLogs);
        }
        else if (data.step === 'committee') {
          if (data.update && data.update.recommendation) {
            setActiveReport(prev => ({
              ...prev,
              decision: data.update.recommendation.decision,
              confidence: data.update.recommendation.confidence,
              summary: data.update.recommendation.summary,
              details: {
                ...prev?.details,
                recommendation: data.update.recommendation
              }
            }));
            setActiveReportTab('thesis'); // Automatically open final recommendation thesis!
          }
          if (data.currentLogs) setCurrentLogs(data.currentLogs);
        }
        else if (data.step === 'complete') {
          eventSource.close();
          fetchHistory();
          if (data.report) {
            setActiveReport(data.report);
            setActiveReportId(data.report.id);
          } else {
            loadReportDetails(data.reportId);
          }
          setIsLoading(false);
          setActiveStage('idle');
        }
        else if (data.step === 'error') {
          eventSource.close();
          setIsLoading(false);
          setActiveStage('idle');
          alert(`Research Agent Error: ${data.message}`);
        }
      } catch (err) {
        console.error('Error parsing stream event:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      eventSource.close();
      setIsLoading(false);
      setActiveStage('idle');
      alert('Lost connection to backend research stream.');
    };
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    runResearch(query);
  };

  const handleSuggestionClick = (company) => {
    setQuery(company);
    runResearch(company);
  };

  const getDecisionClass = (decision) => {
    if (!decision) return '';
    return decision.toUpperCase();
  };

  const getDecisionBadge = (decision) => {
    switch(decision?.toUpperCase()) {
      case 'BUY': return 'badge-buy';
      case 'HOLD': return 'badge-hold';
      case 'SELL': return 'badge-sell';
      case 'PASS': return 'badge-pass';
      default: return '';
    }
  };

  return (
    <div className="app-container">
      {/* Main Content Pane */}
      <main className="main-content">
        {/* Top Control Bar */}
        <header className="header-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="logo-icon" style={{ width: '28px', height: '28px', fontSize: '13px' }}>i</div>
              <div className="logo-text" style={{ fontSize: '18px' }}>investAI</div>
            </div>
            
            <button
              type="button"
              onClick={() => {
                setActiveReport(null);
                setActiveReportId(null);
                setQuery('');
              }}
              disabled={isLoading}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--glass-border)',
                borderRadius: '10px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                transition: 'all 0.2s',
                gap: '6px',
                fontSize: '13px',
                fontWeight: '600',
                fontFamily: 'Outfit, sans-serif'
              }}
              onMouseOver={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }
              }}
              onMouseOut={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                }
              }}
            >
              <Home size={14} style={{ color: 'var(--accent-cyan)' }} />
              <span>Home</span>
            </button>
          </div>

          <form className="search-form" onSubmit={handleSearchSubmit}>
            <Search className="search-icon-left" size={18} />
            <input 
              className="search-input"
              type="text" 
              placeholder="Enter stock ticker or company name... (e.g. Apple, TSLA, NVDA)" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isLoading}
            />
            <button className="search-btn" type="submit" disabled={isLoading || !query.trim()}>
              {isLoading ? (
                <>
                  <RefreshCw className="animate-spin" size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
                  Analyzing
                </>
              ) : (
                'Research'
              )}
            </button>
          </form>
          
          <div className="info-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Cpu size={14} style={{ color: 'var(--accent-cyan)' }} /> {llmConfig.model} ({llmConfig.provider.toUpperCase()})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={14} style={{ color: 'var(--accent-cyan)' }} /> Yahoo Finance
            </span>
          </div>
        </header>

        {/* Dynamic Display Area */}
        {activeReport ? (
          /* Analysis results viewer layout dashboard (Renders both historical reports & live streams) */
          (() => {
            const currencyCode = activeReport.details?.keyStats?.currency || 'USD';
            const currencySymbol = getCurrencySymbol(currencyCode);
            
            // Compact styling helper for the dynamic progress bar
            const nodeStyle = (isActive, isCompleted) => ({
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '800',
              background: isActive ? 'rgba(6, 182, 212, 0.12)' : (isCompleted ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255, 255, 255, 0.02)'),
              border: isActive ? '1px solid var(--accent-cyan)' : (isCompleted ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.05)'),
              color: isActive ? 'var(--accent-cyan)' : (isCompleted ? '#34d399' : 'var(--text-muted)'),
              flex: 1,
              textAlign: 'center',
              transition: 'all 0.4s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            });

            const connectorStyle = (isCompleted) => ({
              height: '2px',
              flex: '0 0 16px',
              background: isCompleted ? '#34d399' : 'rgba(255, 255, 255, 0.05)',
              transition: 'all 0.4s ease'
            });

            return (
              <div className="dashboard-viewer">
                {isLoading && (
                  <div className="col-12 card" style={{ marginBottom: '24px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(0, 242, 254, 0.25)', boxShadow: '0 0 20px rgba(0, 242, 254, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="pulse-loader" style={{ width: '10px', height: '10px' }}></div>
                        <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px', color: 'var(--text-primary)' }}>
                          AGENT PIPELINE RUNNING
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>
                        STAGE: {activeStage}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                      <div style={nodeStyle(activeStage === 'resolver', ['fetcher', 'fundamental', 'sentiment', 'risk', 'committee', 'idle'].includes(activeStage) && activeStage !== 'resolver')}>
                        Resolver
                      </div>
                      <div style={connectorStyle(['fetcher', 'fundamental', 'sentiment', 'risk', 'committee', 'idle'].includes(activeStage) && activeStage !== 'resolver')}></div>
                      
                      <div style={nodeStyle(activeStage === 'fetcher', ['fundamental', 'sentiment', 'risk', 'committee', 'idle'].includes(activeStage) && !['resolver', 'fetcher'].includes(activeStage))}>
                        Fetcher
                      </div>
                      <div style={connectorStyle(['fundamental', 'sentiment', 'risk', 'committee', 'idle'].includes(activeStage) && !['resolver', 'fetcher'].includes(activeStage))}></div>
                      
                      <div style={nodeStyle(['fundamental', 'sentiment', 'risk'].includes(activeStage), ['committee', 'idle'].includes(activeStage) && !['resolver', 'fetcher', 'fundamental', 'sentiment', 'risk'].includes(activeStage))}>
                        Analysts
                      </div>
                      <div style={connectorStyle(['committee', 'idle'].includes(activeStage) && !['resolver', 'fetcher', 'fundamental', 'sentiment', 'risk'].includes(activeStage))}></div>
                      
                      <div style={nodeStyle(activeStage === 'committee', false)}>
                        Committee
                      </div>
                    </div>

                    {/* Live Console Logs Stream */}
                    <div style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                          LIVE PIPELINE OUTPUT
                        </span>
                        <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>
                          STATUS: streaming
                        </span>
                      </div>
                      <div 
                        ref={topTerminalRef}
                        style={{ 
                          background: 'rgba(0,0,0,0.25)', 
                          padding: '12px 16px', 
                          borderRadius: '8px', 
                          fontFamily: 'monospace', 
                          fontSize: '12px', 
                          maxHeight: '140px', 
                          overflowY: 'auto',
                          border: '1px solid rgba(255,255,255,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        {currentLogs.map((log, index) => (
                          <div key={index} style={{ display: 'flex', gap: '8px', lineBreak: 'anywhere' }}>
                            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            <span style={{ color: 'var(--accent-cyan)', fontWeight: '700', flexShrink: 0 }}>{log.stepName.toUpperCase()}:</span>
                            <span style={{ color: 'var(--text-primary)' }}>{log.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="report-grid">
              
              {/* Header Ticker Banner */}
              <div className="col-12" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '8px' }}>
                <div>
                  <h1 style={{ fontSize: '32px', fontWeight: '800', fontFamily: 'Outfit' }}>{activeReport.companyName}</h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontFamily: 'Outfit', fontWeight: '500' }}>
                    Asset Ticker: <span style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>{activeReport.ticker}</span>
                    {activeReport.country && (
                      <>
                        <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.15)' }}>|</span>
                        Country of Origin: <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{activeReport.country}</span>
                      </>
                    )}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '28px', fontWeight: '800', fontFamily: 'Outfit', color: 'var(--text-primary)' }}>
                    {currencySymbol}{activeReport.details.keyStats?.price ? activeReport.details.keyStats.price.toFixed(2) : 'N/A'}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: (activeReport.details.keyStats?.changePercent >= 0) ? '#34d399' : '#f87171' }}>
                    {activeReport.details.keyStats?.changePercent >= 0 ? '+' : ''}
                    {activeReport.details.keyStats?.changePercent ? activeReport.details.keyStats.changePercent.toFixed(2) : '0.00'}%
                  </div>
                </div>
              </div>

              {/* 1. Investment Recommendation Hero Card */}
              {!activeReport.decision ? (
                <div className="col-8 card decision-card PASS" style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.3), rgba(15, 23, 42, 0.5))', border: '1px dashed rgba(6, 182, 212, 0.3)', minHeight: '170px' }}>
                  <div className="decision-glow-panel" style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.05)', boxShadow: 'none' }}>
                    <div className="decision-badge-large" style={{ color: 'var(--text-muted)', fontSize: '20px', animation: 'pulse-glow 1.5s infinite ease-in-out' }}>PENDING</div>
                    <div className="decision-confidence" style={{ color: 'var(--text-muted)' }}>ANALYZING...</div>
                  </div>
                  <div className="decision-info-panel">
                    <div className="decision-header-info">
                      <div className="decision-title-group">
                        <h2>Committee Evaluation</h2>
                        <div className="decision-ticker-label" style={{ animation: 'pulse-glow 1.5s infinite ease-in-out' }}>COLLECTING ANALYST CONSENSUS...</div>
                      </div>
                      <div className="decision-valuation-label">
                        <span className="val-label">EST. FAIR VALUE RANGE</span>
                        <span className="val-value" style={{ color: 'var(--text-muted)' }}>Calculating...</span>
                      </div>
                    </div>
                    <p className="decision-summary-text" style={{ color: 'var(--text-muted)' }}>
                      The AI investment research committee is compiling fundamental reviews, sentiment scoring, and risk profiling reports. Real-time data will populate below.
                    </p>
                  </div>
                </div>
              ) : (
                <div className={`col-8 card decision-card ${getDecisionClass(activeReport.decision)}`}>
                  <div className="decision-glow-panel">
                    <div className="decision-badge-large">{activeReport.decision}</div>
                    <div className="decision-confidence">CONF: {activeReport.confidence}%</div>
                  </div>
                  <div className="decision-info-panel">
                    <div className="decision-header-info">
                      <div className="decision-title-group">
                        <h2>Committee Consensus</h2>
                        <div className="decision-ticker-label">TARGET HORIZON: 12-18 MONTHS</div>
                      </div>
                      <div className="decision-valuation-label">
                        <span className="val-label">EST. FAIR VALUE RANGE</span>
                        <span className="val-value">{activeReport.details.recommendation?.fairValueRange || 'N/A'}</span>
                      </div>
                    </div>
                    <p className="decision-summary-text">
                      {activeReport.summary}
                    </p>
                  </div>
                </div>
              )}

              {/* 2. Short Stats Grid */}
              <div className="col-4 card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span className="card-title" style={{ marginBottom: '14px' }}>
                  <Layers size={14} style={{ color: 'var(--accent-cyan)' }} /> Key Financial Ratios
                </span>
                <div className="metrics-grid">
                  <div className="metric-cell">
                    <span className="metric-cell-label">P/E Ratio</span>
                    <span className="metric-cell-value">
                      {activeReport.details.keyStats?.peRatio ? activeReport.details.keyStats.peRatio.toFixed(2) : 'N/A'}
                    </span>
                  </div>
                  <div className="metric-cell">
                    <span className="metric-cell-label">PEG Ratio</span>
                    <span className="metric-cell-value">
                      {activeReport.details.keyStats?.pegRatio ? activeReport.details.keyStats.pegRatio.toFixed(2) : 'N/A'}
                    </span>
                  </div>
                  <div className="metric-cell">
                    <span className="metric-cell-label">ROE</span>
                    <span className="metric-cell-value">
                      {activeReport.details.financials?.returnOnEquity ? (activeReport.details.financials.returnOnEquity * 100).toFixed(1) + '%' : 'N/A'}
                    </span>
                  </div>
                  <div className="metric-cell">
                    <span className="metric-cell-label">Debt / Equity</span>
                    <span className="metric-cell-value">
                      {activeReport.details.financials?.debtToEquity ? activeReport.details.financials.debtToEquity.toFixed(2) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Recharts Historical Price Chart */}
              <div className="col-8 card" style={{ minHeight: '340px' }}>
                <span className="card-title">
                  <TrendingUp size={14} style={{ color: 'var(--accent-cyan)' }} /> Price Trend (12 Months History)
                </span>
                <div style={{ width: '100%', height: '240px', marginTop: '10px' }}>
                  {activeReport.details.historicalPrices && activeReport.details.historicalPrices.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activeReport.details.historicalPrices} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="date" 
                          stroke="var(--text-muted)" 
                          tickLine={false}
                          tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                          minTickGap={60}
                        />
                        <YAxis 
                          stroke="var(--text-muted)" 
                          tickLine={false}
                          tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          contentStyle={{ 
                            background: 'rgba(11, 15, 25, 0.85)', 
                            border: '1px solid var(--glass-border)',
                            borderRadius: '12px',
                            backdropFilter: 'blur(8px)'
                          }}
                          labelStyle={{ color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '11px', marginBottom: '4px' }}
                          itemStyle={{ color: 'var(--text-primary)', fontSize: '13px' }}
                        />
                        <Area type="monotone" dataKey="close" stroke="var(--accent-cyan)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorPrice)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      Historical chart data not available for this asset.
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Financial Statistics Table */}
              <div className="col-4 card">
                <span className="card-title">
                  <Info size={14} style={{ color: 'var(--accent-cyan)' }} /> Key Financial Numbers
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Revenue:</span>
                    <span style={{ fontWeight: '600' }}>{formatMoney(activeReport.details.financials?.totalRevenue, currencySymbol)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Revenue Growth:</span>
                    <span style={{ fontWeight: '600', color: activeReport.details.financials?.revenueGrowth >= 0 ? '#34d399' : '#f87171' }}>
                      {activeReport.details.financials?.revenueGrowth ? (activeReport.details.financials.revenueGrowth * 100).toFixed(1) + '%' : 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Net Income:</span>
                    <span style={{ fontWeight: '600' }}>{formatMoney(activeReport.details.financials?.netIncome, currencySymbol)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Profit Margin:</span>
                    <span style={{ fontWeight: '600' }}>
                      {activeReport.details.financials?.profitMargin ? (activeReport.details.financials.profitMargin * 100).toFixed(1) + '%' : 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Free Cash Flow:</span>
                    <span style={{ fontWeight: '600', color: '#34d399' }}>{formatMoney(activeReport.details.financials?.freeCashflow, currencySymbol)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '2px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Cash / Debt:</span>
                    <span style={{ fontWeight: '600', fontSize: '12px' }}>
                      {formatMoney(activeReport.details.financials?.totalCash, currencySymbol)} / {formatMoney(activeReport.details.financials?.totalDebt, currencySymbol)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. SWOT Analysis Grid */}
              <div className="col-12 card">
                <span className="card-title">
                  <BookOpen size={14} style={{ color: 'var(--accent-cyan)' }} /> Strategic SWOT Profiling
                </span>
                {!activeReport.details.recommendation?.swot ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {[...Array(4)].map((_, index) => (
                      <div key={index} className="swot-box" style={{ background: 'rgba(255,255,255,0.01)', minHeight: '110px' }}>
                        <div className="swot-box-title" style={{ color: 'var(--text-muted)', animation: 'pulse-glow 1.5s infinite ease-in-out' }}>
                          {['STRENGTHS', 'WEAKNESSES', 'OPPORTUNITIES', 'THREATS'][index]} (LOADING...)
                        </div>
                        <ul className="swot-list">
                          <li style={{ background: 'rgba(255,255,255,0.02)', height: '12px', width: '90%', borderRadius: '4px', margin: '8px 0', animation: 'pulse-glow 1.5s infinite ease-in-out' }}></li>
                          <li style={{ background: 'rgba(255,255,255,0.02)', height: '12px', width: '70%', borderRadius: '4px', margin: '8px 0', animation: 'pulse-glow 1.5s infinite ease-in-out' }}></li>
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="swot-grid">
                    <div className="swot-box S">
                      <div className="swot-box-title">STRENGTHS</div>
                      <ul className="swot-list">
                        {activeReport.details.recommendation?.swot?.strengths?.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                    <div className="swot-box W">
                      <div className="swot-box-title">WEAKNESSES</div>
                      <ul className="swot-list">
                        {activeReport.details.recommendation?.swot?.weaknesses?.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                    <div className="swot-box O">
                      <div className="swot-box-title">OPPORTUNITIES</div>
                      <ul className="swot-list">
                        {activeReport.details.recommendation?.swot?.opportunities?.map((o, i) => <li key={i}>{o}</li>)}
                      </ul>
                    </div>
                    <div className="swot-box T">
                      <div className="swot-box-title">THREATS</div>
                      <ul className="swot-list">
                        {activeReport.details.recommendation?.swot?.threats?.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Tabs Panel for Individual Analyst Sub-Reports */}
              <div className="col-12 card" style={{ minHeight: '400px', marginBottom: '40px' }}>
                <div className="tabs-header">
                  {isLoading && (
                    <button className={`tab-btn ${activeReportTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveReportTab('logs')}>
                      <Clock size={14} style={{ animation: 'spin-glow 1.5s infinite ease-in-out' }} /> Thought Stream
                    </button>
                  )}
                  <button className={`tab-btn ${activeReportTab === 'thesis' ? 'active' : ''}`} onClick={() => setActiveReportTab('thesis')}>
                    <FileText size={14} /> Committee Thesis
                  </button>
                  <button className={`tab-btn ${activeReportTab === 'fundamentals' ? 'active' : ''}`} onClick={() => setActiveReportTab('fundamentals')}>
                    <Layers size={14} /> Fundamental Report
                  </button>
                  <button className={`tab-btn ${activeReportTab === 'sentiment' ? 'active' : ''}`} onClick={() => setActiveReportTab('sentiment')}>
                    <TrendingUp size={14} /> Sentiment Analysis
                  </button>
                  <button className={`tab-btn ${activeReportTab === 'risks' ? 'active' : ''}`} onClick={() => setActiveReportTab('risks')}>
                    <ShieldAlert size={14} /> Risk Analysis
                  </button>
                  <button className={`tab-btn ${activeReportTab === 'news' ? 'active' : ''}`} onClick={() => setActiveReportTab('news')}>
                    <Newspaper size={14} /> Live News Source
                  </button>
                </div>

                <div className="tab-body">
                  {activeReportTab === 'logs' && (
                    <div className="console-logs-wrap" style={{ minHeight: '340px' }}>
                      <div ref={tabTerminalRef} className="console-terminal" style={{ height: '340px', borderRadius: '12px' }}>
                        {currentLogs.map((log, index) => (
                          <div key={index} className="console-line">
                            <span className="console-time">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            <span className="console-source">{log.stepName.toUpperCase()}:</span>
                            <span className="console-message">{log.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeReportTab === 'thesis' && (
                    !activeReport.details.recommendation?.fullThesis ? (
                      <div style={{ padding: '20px 0' }}>
                        <h3 style={{ color: 'var(--text-muted)', animation: 'pulse-glow 1.5s infinite ease-in-out' }}>Writing Investment Committee Thesis Memo...</h3>
                        <div style={{ background: 'rgba(255,255,255,0.02)', height: '14px', width: '100%', borderRadius: '4px', margin: '14px 0', animation: 'pulse-glow 1.5s infinite ease-in-out' }}></div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', height: '14px', width: '95%', borderRadius: '4px', margin: '14px 0', animation: 'pulse-glow 1.5s infinite ease-in-out' }}></div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', height: '14px', width: '80%', borderRadius: '4px', margin: '14px 0', animation: 'pulse-glow 1.5s infinite ease-in-out' }}></div>
                      </div>
                    ) : (
                      <div className="report-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(activeReport.details.recommendation?.fullThesis) }}></div>
                    )
                  )}

                  {activeReportTab === 'fundamentals' && (
                    !activeReport.details.fundamentalAnalysis ? (
                      <div style={{ padding: '20px 0' }}>
                        <h3 style={{ color: 'var(--text-muted)', animation: 'pulse-glow 1.5s infinite ease-in-out' }}>Compiling Fundamental Valuation Report...</h3>
                        <div style={{ background: 'rgba(255,255,255,0.02)', height: '14px', width: '100%', borderRadius: '4px', margin: '14px 0', animation: 'pulse-glow 1.5s infinite ease-in-out' }}></div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', height: '14px', width: '90%', borderRadius: '4px', margin: '14px 0', animation: 'pulse-glow 1.5s infinite ease-in-out' }}></div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', height: '14px', width: '60%', borderRadius: '4px', margin: '14px 0', animation: 'pulse-glow 1.5s infinite ease-in-out' }}></div>
                      </div>
                    ) : (
                      <div className="report-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(activeReport.details.fundamentalAnalysis) }}></div>
                    )
                  )}

                  {activeReportTab === 'risks' && (
                    !activeReport.details.riskAnalysis ? (
                      <div style={{ padding: '20px 0' }}>
                        <h3 style={{ color: 'var(--text-muted)', animation: 'pulse-glow 1.5s infinite ease-in-out' }}>Evaluating Operational & Financial Risks...</h3>
                        <div style={{ background: 'rgba(255,255,255,0.02)', height: '14px', width: '100%', borderRadius: '4px', margin: '14px 0', animation: 'pulse-glow 1.5s infinite ease-in-out' }}></div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', height: '14px', width: '95%', borderRadius: '4px', margin: '14px 0', animation: 'pulse-glow 1.5s infinite ease-in-out' }}></div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', height: '14px', width: '70%', borderRadius: '4px', margin: '14px 0', animation: 'pulse-glow 1.5s infinite ease-in-out' }}></div>
                      </div>
                    ) : (
                      <div className="report-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(activeReport.details.riskAnalysis) }}></div>
                    )
                  )}

                  {activeReportTab === 'sentiment' && (
                    !activeReport.details.sentimentAnalysis || activeReport.details.sentimentAnalysis.score === undefined ? (
                      <div style={{ padding: '20px 0' }}>
                        <h3 style={{ color: 'var(--text-muted)', animation: 'pulse-glow 1.5s infinite ease-in-out' }}>Analyzing Live News Sentiment Index...</h3>
                        <div style={{ background: 'rgba(255,255,255,0.02)', height: '14px', width: '100%', borderRadius: '4px', margin: '14px 0', animation: 'pulse-glow 1.5s infinite ease-in-out' }}></div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', height: '14px', width: '85%', borderRadius: '4px', margin: '14px 0', animation: 'pulse-glow 1.5s infinite ease-in-out' }}></div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(0,0,0,0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div style={{ flexShrink: 0, textTransform: 'uppercase', fontSize: '11px', fontWeight: '800', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Sentiment Index:</div>
                          <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                            <div 
                              style={{ 
                                position: 'absolute', 
                                left: '50%',
                                width: `${Math.abs((activeReport.details.sentimentAnalysis?.score || 0)) * 50}%`,
                                transform: (activeReport.details.sentimentAnalysis?.score || 0) < 0 ? 'translateX(-100%)' : 'none',
                                height: '100%',
                                background: (activeReport.details.sentimentAnalysis?.score || 0) >= 0 ? 'var(--decision-buy)' : 'var(--decision-sell)'
                              }}
                            ></div>
                            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: '#fff', transform: 'translateX(-50%)' }}></div>
                          </div>
                          <div style={{ 
                            fontSize: '18px', 
                            fontWeight: '800', 
                            color: (activeReport.details.sentimentAnalysis?.score || 0) >= 0 ? '#34d399' : '#f87171' 
                          }}>
                            {activeReport.details.sentimentAnalysis?.score !== undefined ? activeReport.details.sentimentAnalysis.score.toFixed(2) : '0.00'}
                          </div>
                        </div>

                        <div className="report-markdown">
                          <h3>Sentiment Thesis</h3>
                          <p>{activeReport.details.sentimentAnalysis?.explanation || 'No summary available.'}</p>
                        </div>

                        <div className="sentiment-bullets">
                          <div className="sentiment-bullets-group">
                            <span className="sentiment-bullets-group-title bullish-title">Bullish Indicators</span>
                            <ul className="sentiment-list bullish-list">
                              {activeReport.details.sentimentAnalysis?.bullishPoints?.map((p, i) => <li key={i}>{p}</li>)}
                            </ul>
                          </div>
                          
                          <div className="sentiment-bullets-group" style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '16px' }}>
                            <span className="sentiment-bullets-group-title bearish-title">Bearish Concerns</span>
                            <ul className="sentiment-list bearish-list">
                              {activeReport.details.sentimentAnalysis?.bearishPoints?.map((p, i) => <li key={i}>{p}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  {activeReportTab === 'news' && (
                    <div className="news-list">
                      {activeReport.details.news && activeReport.details.news.length > 0 ? (
                        activeReport.details.news.map((n, i) => (
                          <div className="news-card-item" key={i}>
                            <div className="news-info">
                              <h4 className="news-item-title">{n.title}</h4>
                              <div className="news-item-meta">
                                <span>Publisher: {n.publisher}</span>
                                <span style={{ margin: '0 8px' }}>|</span>
                                <span>{new Date(n.publishedAt * 1000).toLocaleDateString()}</span>
                              </div>
                            </div>
                            {n.link && (
                              <a href={n.link} className="news-link-btn" target="_blank" rel="noopener noreferrer">
                                Read News <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        ))
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '40px', textAlign: 'center' }}>
                          No recent headlines recorded for this company.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()
        ) : (
          /* Empty/Initial Welcome Screen */
          <div className="dashboard-empty">
            <div className="empty-icon-wrap">💎</div>
            <h1 className="empty-title">investAI INVESTMENT RESEARCH</h1>
            <p className="empty-desc">
              Harness localized agent intelligence powered by LangGraph, MongoDB evaluations, and your configured LLM ({llmConfig.model}).
              Input a company name or ticker symbol to trigger fundamental reviews, sentiment scoring,
              risk profiling, and final investment committee recommendations.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>
                SUGGESTED REVIEWS
              </div>
              <div className="suggestion-chips">
                <button className="suggestion-chip" onClick={() => handleSuggestionClick('Apple Inc.')}>Apple (AAPL)</button>
                <button className="suggestion-chip" onClick={() => handleSuggestionClick('Tesla')}>Tesla (TSLA)</button>
                <button className="suggestion-chip" onClick={() => handleSuggestionClick('NVIDIA')}>NVIDIA (NVDA)</button>
                <button className="suggestion-chip" onClick={() => handleSuggestionClick('Microsoft')}>Microsoft (MSFT)</button>
                <button className="suggestion-chip" onClick={() => handleSuggestionClick('Alphabet')}>Google (GOOGL)</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
