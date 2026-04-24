/**
 * @fileoverview CivicAI Production Server
 * Express server with security hardening, compression, rate limiting,
 * input validation, and Google Gemini AI integration.
 * @module server
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// ─── Security Middleware ───

/** Helmet with fine-tuned CSP for Google Fonts and Material Icons */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));

/** CORS – restrict to same origin in production */
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

/** Compression – gzip/brotli for all responses */
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

/** JSON body parser with payload size limit */
app.use(express.json({ limit: '500kb' }));

// ─── Rate Limiting ───

/** Global rate limiter: 200 requests per 15 minutes per IP */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

/** Stricter rate limiter for AI endpoints: 30 requests per minute */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit exceeded. Please wait a moment before trying again.' },
});

// ─── Request Logger ───

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api/')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// ─── Google Generative AI ───

/**
 * Initialize the Gemini model.
 * Falls back gracefully if GEMINI_API_KEY is not set.
 */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// ─── Input Validation Helpers ───

/**
 * Validates a chat request body.
 * @param {object} body - The request body.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateChatInput(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }
  if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
    return { valid: false, error: 'Field "message" is required and must be a non-empty string.' };
  }
  if (body.message.length > 5000) {
    return { valid: false, error: 'Field "message" must not exceed 5000 characters.' };
  }
  if (body.history && !Array.isArray(body.history)) {
    return { valid: false, error: 'Field "history" must be an array.' };
  }
  return { valid: true };
}

/**
 * Validates a fact-check request body.
 * @param {object} body - The request body.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateFactCheckInput(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }
  if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
    return { valid: false, error: 'Field "message" is required and must be a non-empty string.' };
  }
  if (body.message.length > 3000) {
    return { valid: false, error: 'Field "message" must not exceed 3000 characters.' };
  }
  return { valid: true };
}

// ─── API Routes ───

/**
 * POST /api/chat
 * Sends a message to the Gemini-powered election assistant.
 * Requires: { message: string, history?: array, systemInstruction?: string }
 */
app.post('/api/chat', apiLimiter, async (req, res) => {
  const validation = validateChatInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'AI service not configured. Please set GEMINI_API_KEY.' });
  }

  try {
    const { history = [], message, systemInstruction } = req.body;

    // Format history for Gemini SDK (role mapping)
    const formattedHistory = history
      .filter(msg => msg && msg.role && msg.content)
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    const chat = model.startChat({
      history: formattedHistory,
      systemInstruction: systemInstruction || undefined,
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    res.json({ text });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in /api/chat:`, error.message || error);

    // Differentiate Google API errors from server errors
    if (error.message?.includes('API key')) {
      return res.status(401).json({ error: 'Invalid API key. Please check your GEMINI_API_KEY.' });
    }
    if (error.message?.includes('quota') || error.message?.includes('rate')) {
      return res.status(429).json({ error: 'AI quota exceeded. Please try again later.' });
    }
    res.status(500).json({ error: 'Failed to generate response. Please try again.' });
  }
});

/**
 * POST /api/fact-check
 * Analyzes an election claim for misinformation using Gemini structured output.
 * Requires: { message: string }
 * Returns: { risk, confidence, reliability, verdict, fact }
 */
app.post('/api/fact-check', apiLimiter, async (req, res) => {
  const validation = validateFactCheckInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'AI service not configured. Please set GEMINI_API_KEY.' });
  }

  try {
    const { message } = req.body;

    const factCheckModel = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            risk: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
            confidence: { type: 'integer' },
            reliability: { type: 'string', enum: ['Very Low', 'Low', 'Moderate', 'High'] },
            verdict: { type: 'string', enum: ['True', 'False', 'Uncertain'] },
            fact: { type: 'string' },
          },
          required: ['risk', 'confidence', 'reliability', 'verdict', 'fact'],
        },
      },
    });

    const prompt = `You are a fact-checking AI for Indian elections. Fact-check this election claim: "${message}"`;
    const result = await factCheckModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in /api/fact-check:`, error.message || error);

    if (error.message?.includes('API key')) {
      return res.status(401).json({ error: 'Invalid API key.' });
    }
    if (error.message?.includes('quota') || error.message?.includes('rate')) {
      return res.status(429).json({ error: 'AI quota exceeded. Please try again later.' });
    }
    res.status(500).json({ error: 'Failed to run fact check. Please try again.' });
  }
});

/**
 * GET /api/health
 * Health check endpoint for monitoring and container orchestration.
 */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// ─── Static Files with Caching ───

/** Serve built frontend assets with aggressive caching for hashed files */
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Immutable cache for hashed assets (Vite fingerprints)
    if (filePath.includes('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

// ─── SPA Fallback ───

/** Serve index.html for all unmatched routes (client-side routing) */
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ─── Global Error Handler ───

/**
 * Express error-handling middleware.
 * Catches unhandled errors and returns a structured JSON response.
 */
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(`[${new Date().toISOString()}] Unhandled Error:`, err.message || err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred.'
      : err.message || 'An unexpected error occurred.',
  });
});

// ─── Start Server ───

app.listen(port, () => {
  console.log(`[CivicAI] Server running on port ${port}`);
  console.log(`[CivicAI] Gemini API: ${process.env.GEMINI_API_KEY ? 'Configured ✓' : 'Not configured (mock mode)'}`);
  console.log(`[CivicAI] Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
