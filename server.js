import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// Security & Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors());
app.use(express.json());

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// API Endpoint for Chat
app.post('/api/chat', async (req, res) => {
  try {
    const { history, message, systemInstruction } = req.body;
    
    // Formatting history for Gemini SDK
    const formattedHistory = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: formattedHistory,
      systemInstruction: systemInstruction,
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();
    
    res.json({ text });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// API Endpoint for Fact Check with Structured Output
app.post('/api/fact-check', async (req, res) => {
  try {
    const { message } = req.body;
    
    const factCheckModel = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            risk: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
            confidence: { type: "integer" },
            reliability: { type: "string", enum: ["Very Low", "Low", "Moderate", "High"] },
            verdict: { type: "string", enum: ["True", "False", "Uncertain"] },
            fact: { type: "string" }
          },
          required: ["risk", "confidence", "reliability", "verdict", "fact"]
        }
      }
    });

    const prompt = `You are a fact-checking AI for Indian elections. Fact-check this election claim: "${message}"`;
    const result = await factCheckModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    res.json(JSON.parse(text));
  } catch (error) {
    console.error('Error in /api/fact-check:', error);
    res.status(500).json({ error: 'Failed to run fact check' });
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
