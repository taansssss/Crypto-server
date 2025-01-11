const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crypto';

// MongoDB Schema and Model
const cryptoSchema = new mongoose.Schema({
    coin: { type: String, required: true },
    price: { type: Number, required: true },
    marketCap: { type: Number, required: true },
    h24Change: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
});

const Crypto = mongoose.model('Crypto', cryptoSchema);

// Task 1: Background Job to Fetch Cryptocurrency Data
cron.schedule('0 */2 * * *', async () => {
    try {
        const coins = ['bitcoin', 'matic-network', 'ethereum'];
        const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
            params: {
                ids: coins.join(','),
                vs_currencies: 'usd',
                include_market_cap: true,
                include_24hr_change: true
            }
        });

        const updates = coins.map(coin => ({
            coin,
            price: data[coin].usd,
            marketCap: data[coin].usd_market_cap,
            h24Change: data[coin].usd_24h_change
        }));

        await Crypto.insertMany(updates);
        console.log('Crypto data updated successfully');
    } catch (error) {
        console.error('Error fetching cryptocurrency data:', error);
    }
});

// Task 2: API to Return Latest Cryptocurrency Data
app.get('/stats', async (req, res) => {
    const { coin } = req.query;
    if (!coin) return res.status(400).send({ error: 'Coin is required' });

    try {
        const latestData = await Crypto.findOne({ coin }).sort({ timestamp: -1 });
        if (!latestData) return res.status(404).send({ error: 'No data found for the requested coin' });

        res.send({
            price: latestData.price,
            marketCap: latestData.marketCap,
            h24Change: latestData.h24Change
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// Task 3: API to Return Standard Deviation of Prices
app.get('/deviation', async (req, res) => {
    const { coin } = req.query;
    if (!coin) return res.status(400).send({ error: 'Coin is required' });

    try {
        const records = await Crypto.find({ coin }).sort({ timestamp: -1 }).limit(100);
        if (records.length < 2) return res.status(400).send({ error: 'Not enough data to calculate deviation' });

        const prices = records.map(record => record.price);
        const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
        const deviation = Math.sqrt(variance).toFixed(2);

        res.send({ deviation: parseFloat(deviation) });
    } catch (error) {
        console.error('Error calculating deviation:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// Connect to MongoDB and Start Server
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(error => {
        console.error('MongoDB connection error:', error);
    });
(async () => {
    const coins = ['bitcoin', 'matic-network', 'ethereum'];
    try {
        const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
            params: {
                ids: coins.join(','),
                vs_currencies: 'usd',
                include_market_cap: true,
                include_24hr_change: true
            }
        });

        const updates = coins.map(coin => ({
            coin,
            price: data[coin].usd,
            marketCap: data[coin].usd_market_cap,
            h24Change: data[coin].usd_24h_change
        }));

        await Crypto.insertMany(updates);
        console.log('Manual data insertion successful.');
    } catch (error) {
        console.error('Error in manual insertion:', error.message);
    }
})();
