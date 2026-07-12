import YahooFinanceClass from 'yahoo-finance2';
const yahooFinance = new YahooFinanceClass();

const query = 'Reliance';
try {
  console.log(`Searching Yahoo Finance for "${query}"...`);
  const searchResults = await yahooFinance.search(query);
  
  console.log(`Results quotes:`);
  searchResults.quotes.forEach((q, i) => {
    console.log(`${i+1}. Ticker: ${q.symbol}, Name: ${q.shortname || q.longname}, Type: ${q.quoteType}, Exchange: ${q.exchange}`);
  });
} catch (e) {
  console.error('Search error:', e);
}
