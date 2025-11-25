import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// .env faylından GEMINI_API_KEY-i yüklə
dotenv.config();

const app = express();
const port = 3001;
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("XƏTA: GEMINI_API_KEY .env faylında tapılmadı.");
    process.exit(1);
}

// Google GenAI instansiyası
const ai = new GoogleGenAI({ apiKey });
const modelName = 'gemini-2.5-flash-preview-09-2025';

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], // Frontend mühitinizi buraya əlavə edin
    methods: ['POST'],
    allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

// API Endpoints
// --------------------

/**
 * AI Maliyyə Analizi endpoint-i
 */
app.post('/api/analyze', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt daxil edilməyib.' });
    }

    try {
        console.log('Gemini Analiz sorğusu alınır...');
        
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {} // Əlavə konfiqurasiya yoxdur
        });
        
        const advice = response.text.trim();

        res.json({ advice });

    } catch (error) {
        console.error('Gemini API Analiz Xətası:', error);
        res.status(500).json({ error: 'AI analiz zamanı xəta baş verdi.' });
    }
});

/**
 * Ağıllı Sitat (Smart Quote) endpoint-i
 */
app.post('/api/quote', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt daxil edilməyib.' });
    }

    try {
        console.log('Gemini Sitat sorğusu alınır...');

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {}
        });

        const quote = response.text.trim().replace(/^"|"$/g, ''); // Dırnaqları təmizləyirik

        res.json({ quote });

    } catch (error) {
        console.error('Gemini API Sitat Xətası:', error);
        res.status(500).json({ error: 'AI sitat gətirmə zamanı xəta baş verdi.' });
    }
});

// Serveri başlat
app.listen(port, () => {
    console.log(`Backend serveri işləyir: http://localhost:${port}`);
    console.log(`API Key Hazırlanıb: ${apiKey.slice(0, 4)}...`);
});
