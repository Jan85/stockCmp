# Stock Price History Plotter

Compare historical stock prices with interactive charts. Add multiple stocks, choose a date range, and visualize their performance with different normalization options.

## Features

- **Add multiple stocks** - Compare up to 10 stocks simultaneously
- **Date range selection** - Choose any date range to analyze
- **Three visualization modes**:
  - **Actual Price** - Show original stock prices
  - **% Change from Start** - Show percentage change relative to first price
  - **Normalize 0.0-1.0** - Scale each stock to 0-1 range based on its min/max (great for comparing stocks with different price ranges like $50 vs $500)
- **Performance statistics panel** - Shows current, start, highest, lowest prices and % changes vs start, vs highest, and vs lowest

## How to Run

### Install dependencies

```bash
npm install
```

### Start the server

```bash
npm start
```

### Open in browser

Navigate to: http://localhost:3000

## Usage

1. Enter a stock symbol (e.g., AAPL, GOOGL, MSFT)
2. Select a date range
3. Click "Add Stock" to add it to the chart
4. Repeat to add more stocks for comparison
5. Use the radio buttons to switch between visualization modes:
   - **Actual Price** - See raw prices
   - **% Change from Start** - See % gain/loss from period start
   - **Normalize 0.0-1.0** - See relative position within the period (0=lowest, 1=highest)
6. View the statistics panel below the chart for detailed metrics

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript, Chart.js
- **Backend**: Node.js, Express
- **Data Source**: Yahoo Finance API
- **AI**: OpenAI GPT-3.5 (optional, for AI summaries)

## AI Summary Feature

To enable AI-powered stock analysis summaries:

1. Set your OpenAI API key as an environment variable:
   ```bash
   OPENAI_API_KEY=your_api_key_here npm start
   ```

2. Click the "🤖 AI Summary" button after adding stocks
3. The AI will generate a brief comparison of your selected stocks
4. Cost is minimal (~$0.001 per summary using GPT-3.5-turbo)

