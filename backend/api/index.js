import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

const app = express();

// Vercel serverless function üçün lazımi middleware
app.use(cors()); 
app.use(express.json());

// API Key birbaşa Vercel environment dəyişənlərindən götürülür
const apiKey = process.env.GEMINI_API_KEY;

let ai = null;
if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
    console.log(`Gemini Servisi Hazır: Key (${apiKey.slice(0, 4)}...) ilə.`);
} else {
    console.error("XƏTA: GEMINI_API_KEY mühit dəyişənlərində təyin edilməyib.");
}

const modelName = 'gemini-2.5-flash-preview-09-2025';

// API Endpoints
// --------------------

/**
 * AI Maliyyə Analizi endpoint-i
 */
app.post('/analyze', async (req, res) => {
    if (!ai) return res.status(503).json({ error: 'AI servisi hazır deyil. Xahiş edirik GEMINI_API_KEY-i təyin edin.' });
    
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt daxil edilməyib.' });
    }

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {}
        });
        
        const advice = response.text.trim();
        res.json({ advice });

    } catch (error) {
        console.error('Gemini API Analiz Xətası:', error);
        res.status(500).json({ error: 'AI analiz zamanı xəta baş verdi.', details: error.message });
    }
});

/**
 * Ağıllı Sitat (Smart Quote) endpoint-i
 */
app.post('/quote', async (req, res) => {
    if (!ai) return res.status(503).json({ error: 'AI servisi hazır deyil. Xahiş edirik GEMINI_API_KEY-i təyin edin.' });

    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt daxil edilməyib.' });
    }

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {}
        });

        const quote = response.text.trim().replace(/^"|"$/g, ''); 
        res.json({ quote });

    } catch (error) {
        console.error('Gemini API Sitat Xətası:', error);
        res.status(500).json({ error: 'AI sitat gətirmə zamanı xəta baş verdi.', details: error.message });
    }
});

// Vercel serverless function olaraq Express app-i export edirik
export default app;
