# 🗳️ CivicAI – Intelligent Election Assistant

> An AI-powered, context-aware election assistant that delivers personalized voting guidance, dynamic timelines, and real-time misinformation detection using confidence-based scoring. It enhances voter awareness, accessibility, and trust through intelligent, multilingual, and interactive user experiences.

---

## 🚀 Features

### 🔹 1. Hyper-Personalized Election Guide
- Enter your **Age**, **State/District**, and **First-time Voter** status
- AI generates exact registration steps, required documents, and nearby polling info
- Output personalized to your region: *"As a 19-year-old voter in West Bengal, here's your complete voting plan…"*

### 🔹 2. Smart Timeline Generator (Dynamic, Not Static)
- AI generates timelines based on election type: **General**, **State**, or **Local/Municipal**
- Dynamic milestones: `T-60 → Announced`, `T-30 → Registration`, `T-Day → Voting`, `T+3 → Results`

### 🔹 3. Election Process Visual Flow
- Interactive step-by-step journey: **Register → Verify → Voter ID → Vote → Count → Result**
- Clickable steps with tooltips and micro-interactions
- Progress tracking visualization

### 🔹 4. AI Misinformation Detection ⚡ (Killer Feature)
- Paste any election-related message (e.g., *"I got a message saying voting is tomorrow"*)
- AI returns: **Risk Level**, **Confidence Score**, **Source Reliability**
- Cross-references with official election data

### 🔹 5. AI Risk Scoring System
- Fake news probability scoring
- Trust score with visual indicators
- Confidence-based misinformation detection

### 🔹 6. Voice + Multilingual Assistant 🌍
- **English**, **Hindi (हिन्दी)**, **Bengali (বাংলা)** support
- Voice input via Web Speech API
- Text-to-Speech output for accessibility

### 🔹 7. "Explain Like I'm 10" Mode 🧒
- Toggle ELI10 mode to simplify complex election terms
- Example: *"Election Commission = People who organize voting"*

### 🔹 8. Scenario Simulation
- Ask: *"What happens if I miss registration?"*
- AI simulates outcomes and alternatives

### 🔹 9. Real-Time Q&A + Context Memory
- Conversational AI that remembers your profile
- Context-aware responses based on age, location, voter status

### 🔹 10. Smart Reminders 🔔
- Registration deadline alerts
- Voting day alerts
- Poll proximity notifications

### 🏆 Bonus Features
- 🧠 **Civic Knowledge Quiz** — 5-question quiz with scoring and badges
- 📊 **Impact Dashboard** — Track your civic engagement
- 👤 **Citizen Profile** — Activity history and level system

---

## 🧩 Architecture

```
User Interface (Web SPA)
        ↓
AI Interaction Layer (Hybrid: Mock + Live LLM)
        ↓
Context Engine (User Profile + Conversation Memory)
        ↓
Knowledge Base (Indian Election Rules + ECI Dataset)
        ↓
Modules:
   ├── Timeline Generator
   ├── Fraud/Misinfo Detection AI
   ├── Personalized Plan Engine
   ├── Scenario Simulator
   ├── Quiz Engine
   └── Language Engine (EN/HI/BN)
```

## 📊 AI Components
| Component | Technology | Purpose |
|-----------|-----------|---------|
| NLP | Pattern matching + Gemini API | Understand user queries |
| LLM | Mock responses + Google Gemini | Generate contextual answers |
| Classification | Rule-based + AI scoring | Detect fake information |
| Scoring | Confidence algorithm | Risk assessment |

---

## 🛠️ Tech Stack
- **Frontend**: HTML5, JavaScript (ES Modules), TailwindCSS (CDN)
- **Build Tool**: Vite
- **Fonts**: Inter (Google Fonts)
- **Icons**: Material Symbols Outlined
- **AI**: Hybrid system — Mock responses + optional Google Gemini API
- **Voice**: Web Speech API (recognition + synthesis)

---

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Optional: Enable Live AI (Google Gemini)
Add your API key as a URL parameter:
```
http://localhost:5173/?gemini_key=YOUR_GEMINI_API_KEY
```

---

## 🎯 Demo Script

1. **Start with the problem**: *"Millions of voters lack clear, personalized election guidance"*
2. **Show Chat**: Ask a question → AI responds with confidence score
3. **Show Personalization**: Enter age/state → Generate custom voting plan
4. **Show Timeline**: Switch between General/State/Local election types
5. **Show Misinformation Detection** ⚡: Paste fake message → See risk scoring
6. **Show ELI10 Mode**: Toggle simple explanations
7. **Show Multilingual**: Switch to Hindi/Bengali
8. **End with**: *"This is not just an assistant, it's a civic intelligence platform."*

---

## 📝 License
Built for hackathon demonstration purposes.
