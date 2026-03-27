const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Yahoo Finance API proxy endpoint
app.get('/api/stock-history', async (req, res) => {
    const { symbol, from, to } = req.query;
    
    if (!symbol || !from || !to) {
        return res.status(400).json({ error: 'Missing required parameters: symbol, from, to' });
    }
    
    try {
        // Convert dates to timestamps
        const fromTimestamp = Math.floor(new Date(from).getTime() / 1000);
        const toTimestamp = Math.floor(new Date(to).getTime() / 1000);
        
        // Yahoo Finance chart API URL
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${fromTimestamp}&period2=${toTimestamp}&interval=1d`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Yahoo Finance API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Check if there's valid data
        if (data.chart && data.chart.result && data.chart.result[0]) {
            const result = data.chart.result[0];
            const timestamps = result.timestamp || [];
            const quote = result.indicators.quote[0] || {};
            
            res.json({
                symbol: result.meta.symbol,
                timestamps: timestamps,
                prices: quote.close || [],
                volumes: quote.volume || [],
                currency: result.meta.currency || 'USD'
            });
        } else {
            res.status(404).json({ error: 'No data found for this symbol or date range' });
        }
    } catch (error) {
        console.error('Error fetching stock data:', error);
        res.status(500).json({ error: 'Failed to fetch stock data: ' + error.message });
    }
});

// Validate stock symbol exists
app.get('/api/validate-symbol', async (req, res) => {
    const { symbol } = req.query;
    
    if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
    }
    
    try {
        // Get a small date range (last 5 days) to validate symbol
        const now = Math.floor(Date.now() / 1000);
        const fiveDaysAgo = now - (5 * 24 * 60 * 60);
        
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${fiveDaysAgo}&period2=${now}&interval=1d`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const data = await response.json();
        
        if (data.chart && data.chart.result && data.chart.result[0]) {
            const result = data.chart.result[0];
            res.json({
                valid: true,
                symbol: result.meta.symbol,
                name: result.meta.shortName || result.meta.symbol,
                currency: result.meta.currency || 'USD'
            });
        } else {
            res.json({ valid: false, error: 'Symbol not found' });
        }
    } catch (error) {
        console.error('Error validating symbol:', error);
        res.status(500).json({ valid: false, error: 'Failed to validate symbol' });
    }
});

app.listen(PORT, () => {
    console.log(`Stock Price Plotter running at http://localhost:${PORT}`);
});
