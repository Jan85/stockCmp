const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// OpenAI client (lazy initialization)
let openaiClient = null;
function getOpenAIClient() {
    if (!openaiClient && process.env.OPENAI_API_KEY) {
        openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openaiClient;
}

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

// Calculate technical analysis for a stock
app.post('/api/calculate-indicators', express.json(), (req, res) => {
    const { timestamps, prices } = req.body;
    
    if (!timestamps || !prices) {
        return res.status(400).json({ error: 'Missing timestamps or prices' });
    }
    
    // Filter valid prices and create pairs
    const data = [];
    for (let i = 0; i < timestamps.length; i++) {
        if (prices[i] !== null) {
            data.push({ ts: timestamps[i], price: prices[i] });
        }
    }
    
    if (data.length < 20) {
        return res.json({ indicators: null, error: 'Not enough data' });
    }
    
    const prices_only = data.map(d => d.price);
    
    // Calculate Simple Moving Averages
    function sma(data, period) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                result.push(null);
            } else {
                const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
                result.push(sum / period);
            }
        }
        return result;
    }
    
    // Calculate Standard Deviation (for volatility)
    function stdDev(data, period) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                result.push(null);
            } else {
                const slice = data.slice(i - period + 1, i + 1);
                const mean = slice.reduce((a, b) => a + b, 0) / period;
                const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
                result.push(Math.sqrt(variance));
            }
        }
        return result;
    }
    
    // Calculate indicators
    const ma20 = sma(prices_only, 20);
    const ma50 = sma(prices_only, 50);
    const ma200 = prices_only.length > 200 ? sma(prices_only, 200) : null;
    const volatility20 = stdDev(prices_only, 20);
    
    const currentPrice = prices_only[prices_only.length - 1];
    const ma20_current = ma20[ma20.length - 1];
    const ma50_current = ma50[ma50.length - 1];
    const ma200_current = ma200 ? ma200[ma200.length - 1] : null;
    const volatility_current = volatility20[volatility20.length - 1];
    
    // Determine trend
    let trend = 'neutral';
    if (ma20_current > ma50_current * 1.02) trend = 'bullish';
    else if (ma20_current < ma50_current * 0.98) trend = 'bearish';
    
    // Determine volatility level
    const avgVolatility = volatility20.filter(v => v !== null).reduce((a, b) => a + b, 0) / volatility20.filter(v => v !== null).length;
    let volatilityLevel = 'medium';
    if (volatility_current > avgVolatility * 1.5) volatilityLevel = 'high';
    else if (volatility_current < avgVolatility * 0.5) volatilityLevel = 'low';
    
    // Determine signals
    const signals = [];
    if (currentPrice > ma20_current) signals.push('Above MA20');
    else signals.push('Below MA20');
    
    if (ma20_current > ma50_current) signals.push('MA20 > MA50 ✓');
    else if (ma20_current < ma50_current) signals.push('MA20 < MA50');
    
    if (ma200_current) {
        if (currentPrice > ma200_current) signals.push('Above MA200 ✓');
        else signals.push('Below MA200');
    }
    
    // Position in range
    const minPrice = Math.min(...prices_only);
    const maxPrice = Math.max(...prices_only);
    const range = maxPrice - minPrice;
    const position = range > 0 ? ((currentPrice - minPrice) / range) * 100 : 50;
    
    let positionLabel = 'Mid-range';
    if (position > 80) positionLabel = 'Near High';
    else if (position < 20) positionLabel = 'Near Low';
    
    res.json({
        indicators: {
            trend,
            volatilityLevel,
            signals,
            positionLabel,
            position: position.toFixed(1),
            ma20: ma20_current ? ma20_current.toFixed(2) : null,
            ma50: ma50_current ? ma50_current.toFixed(2) : null,
            ma200: ma200_current ? ma200_current.toFixed(2) : null
        }
    });
});

// Generate AI summary
app.post('/api/ai-summary', express.json(), async (req, res) => {
    const { stocks } = req.body;
    
    if (!stocks || stocks.length === 0) {
        return res.status(400).json({ error: 'No stocks provided' });
    }
    
    const client = getOpenAIClient();
    if (!client) {
        return res.status(500).json({ error: 'OpenAI API key not configured. Set OPENAI_API_KEY environment variable.' });
    }
    
    try {
        const stocksInfo = stocks.map(s => 
            `• ${s.symbol}: Current $${s.stats.current.toFixed(2)}, Start $${s.stats.start.toFixed(2)}, High $${s.stats.highest.toFixed(2)}, Low $${s.stats.lowest.toFixed(2)}, Change vs Start: ${s.stats.vsStart >= 0 ? '+' : ''}${s.stats.vsStart.toFixed(2)}%, Trend: ${s.indicators?.trend || 'N/A'}, Volatility: ${s.indicators?.volatilityLevel || 'N/A'}, Position: ${s.indicators?.positionLabel || 'N/A'}`
        ).join('\n');
        
        const response = await client.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{
                role: 'system',
                content: 'You are a concise stock market analyst. Provide brief, actionable insights. Use bullet points. Keep it under 150 words.'
            }, {
                role: 'user',
                content: `Analyze these stocks:\n${stocksInfo}\n\nProvide a brief summary comparing their performance, mentioning which shows strength and which shows weakness.`
            }],
            max_tokens: 300,
            temperature: 0.7
        });
        
        res.json({
            summary: response.choices[0].message.content,
            usage: response.usage ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                estimatedCost: (response.usage.prompt_tokens * 0.0015 + response.usage.completion_tokens * 0.002) / 1000
            } : null
        });
    } catch (error) {
        console.error('OpenAI error:', error);
        res.status(500).json({ error: 'Failed to generate AI summary: ' + error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Stock Price Plotter running at http://localhost:${PORT}`);
    if (!process.env.OPENAI_API_KEY) {
        console.log('Note: Set OPENAI_API_KEY env variable for AI summaries');
    }
});
