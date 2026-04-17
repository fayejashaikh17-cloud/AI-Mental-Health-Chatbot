import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "./auth";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  getDiaryInsight, 
  getMoodInsight, 
  getChatResponse, 
  getHealthAdviceContent, 
  getMentalPeaceTechnique, 
  getDailyTip,
  clearRecentResponses 
} from "./fallback-content";

// Initialize Google Gemini client
let genAI: GoogleGenerativeAI | null = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

const hasGemini = Boolean(process.env.GEMINI_API_KEY);

if (!hasGemini) {
  console.warn("WARNING: No Gemini API key configured. Using fallback content only.");
} else {
  console.log("Using Google Gemini AI");
}

// 🚀 Response Cache - Reduces API calls by 70-80%
const responseCache = new Map<string, string>();

// Emotion keyword detection for quick responses without API calls
const emotionKeywordResponses: { [key: string]: string } = {
  "feel sad": "It sounds like you're feeling sad right now, and that's completely valid. Sadness is a natural emotion that often tells us something important needs our attention. What's been going on that's making you feel this way? Sometimes just talking about it can help. Remember, it's okay to feel sad sometimes, and reaching out like you're doing right now is a great step.",
  "feel stressed": "I can tell you're feeling stressed, and that's something a lot of people experience. Stress can feel overwhelming, but there are some things that might help. Take a moment to try some deep breathing - in through your nose for 4 counts, hold for 4, and out for 4. It helps calm your nervous system. What's causing the stress? Sometimes just identifying the source helps us feel more in control.",
  "feel anxious": "It sounds like anxiety is weighing on you. Anxiety can make us feel like something bad is about to happen, but it's usually our mind being protective. One thing that helps is grounding yourself in the present moment. Look around and name 5 things you can see, 4 you can hear, 3 you can touch, 2 you can smell, and 1 you can taste. That's called the 5-4-3-2-1 technique. What triggered this anxious feeling?",
  "feel overwhelmed": "Feeling overwhelmed means you're juggling a lot right now. That's tough, and it's important to acknowledge that. When everything feels like too much, try breaking things into smaller, manageable pieces. Pick just ONE thing to focus on first. Remember, you don't have to do everything at once. What's making you feel most overwhelmed right now?",
  "feel lonely": "It sounds like loneliness is touching your heart right now. That's something many people struggle with, and it's very real. Even in a crowded room, feeling disconnected can be painful. But reaching out like you are right now shows real courage. Is there someone you trust that you could talk to? Sometimes connection, even small moments of it, can ease that feeling.",
  "feel angry": "I hear that anger is present for you. Anger can be powerful and sometimes it's telling us that something important has been crossed. That's actually useful information. Before responding, take a moment to cool down - maybe go for a walk or splash cold water on your face. What happened that made you angry? What feels unfair or unjust about the situation?",
  "feel tired": "You're feeling tired, and that's your body or mind telling you something needs attention. Exhaustion can come from not enough sleep, stress, emotional toll, or just doing too much. What kind of tired are you feeling - physically, mentally, or emotionally? Sometimes taking a real break, not just scrolling but actual rest, can help restore your energy.",
  "feel unmotivated": "That lack of motivation is real, and it's often a sign you need to reconnect with something meaningful. Sometimes we lose motivation when things feel meaningless or when we're burnt out. What would feel meaningful to you right now? What used to excite you? Even small steps toward something you care about can reignite that spark.",
};

// Normalize text for caching (lowercase, trim)
function normalizeCacheKey(text: string): string {
  return text.toLowerCase().trim().substring(0, 200); // Limit to 200 chars
}

// Check if message contains emotion keywords and return quick response
function checkEmotionKeyword(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  for (const [keyword, response] of Object.entries(emotionKeywordResponses)) {
    if (lowerMessage.includes(keyword)) {
      console.log(`✨ Using emotion keyword response for: "${keyword}"`);
      return response;
    }
  }
  return null;
}

// 🚨 Crisis Detection - Identifies high-risk mental health signals
const crisisKeywords = [
  "want to die",
  "kill myself",
  "suicide",
  "end my life",
  "give up on life",
  "end it all",
  "not worth living",
  "life is not worth",
  "should kill myself",
  "better off dead",
  "don't want to live",
  "harm myself",
  "hurt myself",
  "ending everything",
  "no point in living"
];

function detectCrisis(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return crisisKeywords.some(keyword => lowerMessage.includes(keyword));
}

// Crisis Support Response with India Helpline Numbers
const crisisResponse = `I'm really concerned about what you've shared, and I want you to know that you're not alone. What you're feeling right now is real, but it can get better with the right support.

Please reach out to a mental health professional or crisis helpline right away:

📞 **India Mental Health Crisis Support:**
• **Kiran Mental Health Helpline**: 1800-599-0019 (Toll-free)
• **AASRA Helpline**: 9820466726 (24/7)
• **ICall Crisis Chat**: 9152987821 (WhatsApp available)
• **VANDREVALA FOUNDATION Helpline**: 9999 77 6555
• **Lifeline (iCall)**: 1800-230-5522 (India)

You can also:
✓ Call your nearest hospital emergency room
✓ Talk to someone you trust - a friend, family member, or counselor
✓ Text or chat with a crisis counselor (many are available 24/7)

Your life has value, and there are people who want to help. Please reach out today. You don't have to face this alone.

If you need support right now, please don't wait - contact one of these resources immediately.`;

// AI service calling function
async function callAIService(prompt: string, systemMessage: string, useJSON = false): Promise<string> {
  // 🚨 CRISIS DETECTION - Check FIRST before anything else
  if (detectCrisis(prompt)) {
    console.log("🚨 CRISIS ALERT! High-risk emotional signal detected. Providing immediate support resources.");
    return crisisResponse;
  }

  const cacheKey = normalizeCacheKey(prompt);
  
  // 🚀 Check cache first
  if (responseCache.has(cacheKey)) {
    console.log(`⚡ Cache HIT! Skipped API call for: "${prompt.substring(0, 50)}..."`);
    return responseCache.get(cacheKey) || '';
  }

  // 🚀 Check emotion keywords for instant response
  const emotionResponse = checkEmotionKeyword(prompt);
  if (emotionResponse) {
    responseCache.set(cacheKey, emotionResponse);
    return emotionResponse;
  }
  
  if (hasGemini && genAI) {
    try {
      // Rate limit protection: delay before each Gemini call to avoid per-minute limits
      await new Promise(resolve => setTimeout(resolve, 1500));

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const fullPrompt = `${systemMessage}\n\nUser: ${prompt}`;

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text() || '';
      
      // 🚀 Store in cache
      if (text) {
        responseCache.set(cacheKey, text);
        console.log(`💾 Cached response for: "${prompt.substring(0, 50)}..."`);
      }
      
      return text;
    } catch (error: any) {
      console.log("Gemini failed:", error.message);
    }
  }
  throw new Error("Gemini AI unavailable");
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ——— Auth routes ———
  app.get("/api/me", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      const u = req.user as { id: number; username: string };
      return res.json({ id: u.id, username: u.username });
    }
    return res.status(401).json({ message: "Not authenticated" });
  });

  // Validation helpers for auth
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  function validateUsername(username: unknown): string | null {
    if (typeof username !== "string" || !username.trim()) return "Username is required.";
    const u = username.trim();
    if (u.length < 3) return "Username must be at least 3 characters.";
    if (u.length > 32) return "Username must be at most 32 characters.";
    if (!usernameRegex.test(u)) return "Username can only contain letters, numbers, and underscores.";
    return null;
  }
  function validatePassword(password: unknown, isRegister: boolean): string | null {
    if (typeof password !== "string") return "Password is required.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (password.length > 128) return "Password must be at most 128 characters.";
    if (isRegister && !/[a-zA-Z]/.test(password)) return "Password must contain at least one letter.";
    if (isRegister && !/[0-9]/.test(password)) return "Password must contain at least one number.";
    return null;
  }

  app.post("/api/register", async (req, res) => {
    try {
      const { username: rawUsername, password: rawPassword } = req.body || {};
      const usernameErr = validateUsername(rawUsername);
      if (usernameErr) return res.status(400).json({ error: usernameErr });
      const passwordErr = validatePassword(rawPassword, true);
      if (passwordErr) return res.status(400).json({ error: passwordErr });
      const username = (rawUsername as string).trim();
      const password = rawPassword as string;
      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(409).json({ error: "Username already taken. Please choose another." });
      const hashed = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username, password: hashed });
      req.login(user, (err) => {
        if (err) return res.status(500).json({ error: "Session error. Please try again." });
        return res.json({ id: user.id, username: user.username });
      });
    } catch (e) {
      console.error("Register error:", e);
      return res.status(500).json({ error: "Registration failed. Please try again." });
    }
  });

  app.post("/api/login", (req, res, next) => {
    const usernameErr = validateUsername(req.body?.username);
    if (usernameErr) return res.status(400).json({ error: usernameErr });
    const passwordErr = validatePassword(req.body?.password, false);
    if (passwordErr) return res.status(400).json({ error: passwordErr });
    passport.authenticate("local", (err: any, user: Express.User | false, info: { message?: string }) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: "Incorrect username or password. Please try again." });
      req.login(user, (loginErr) => {
        if (loginErr) return res.status(500).json({ error: "Session error. Please try again." });
        const u = user as { id: number; username: string };
        return res.json({ id: u.id, username: u.username });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      return res.json({ success: true });
    });
  });

  // Diary analysis endpoint
  app.post("/api/ai/analyze-Diary", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "Diary content is required" });
    }

    // 🚨 CRISIS DETECTION - Check diary content for crisis signals
    if (detectCrisis(content)) {
      console.log("🚨 CRISIS ALERT! Crisis signal detected in diary entry. Providing immediate support resources.");
      return res.json({
        insights: crisisResponse,
        tags: ["crisis-support", "urgent-help-needed", "reach-out-now"],
        isCrisis: true
      });
    }

    const systemMessage = `
You are an empathetic wellness assistant analyzing a Diary entry.
Extract emotional themes, identify potential mood states, and provide brief, supportive insights that might help the user.
Respond ONLY with valid JSON, do not add any extra text.
Use the format:

{
  "insights": "<brief insight about the Diary entry>",
  "tags": ["<tag1>", "<tag2>", "<tag3>"]
}
`;

   
    const aiResponse = await callAIService(content, systemMessage, true);
    console.log("RAW AI RESPONSE:", aiResponse);


    let result;
    
    try {
      // Extract first JSON object from AI response to handle any extra text
      const match = aiResponse.match(/\{.*\}/s);
      result = match ? JSON.parse(match[0]) : {
        insights: aiResponse || "Your Diary entry shows thoughtful reflection on your experiences.",
        tags: ["reflection", "mindfulness", "self-awareness"]
      };
    } catch {
      result = {
        insights: aiResponse || "Your Diary entry shows thoughtful reflection on your experiences.",
        tags: ["reflection", "mindfulness", "self-awareness"]
      };
    }

    return res.json({
      insights: result.insights || '',
      tags: result.tags || ["reflection", "mindfulness", "self-awareness"]
    });
  } catch (error: any) {
    console.error("Error analyzing Diary:", error);
    return res.json({
      insights: getDiaryInsight(),
      tags: ["reflection", "mindfulness", "self-awareness"]
    });
  }
});


  // Mood insights endpoint
  app.post("/api/ai/mood-insights", async (req, res) => {
    try {
      const { entries } = req.body;
      if (!entries || !Array.isArray(entries)) {
        return res.status(400).json({ error: "Mood entries are required" });
      }

      // 🚨 CRISIS DETECTION - Check mood notes for crisis signals
      const moodEntriesText = JSON.stringify(entries);
      if (detectCrisis(moodEntriesText)) {
        console.log("🚨 CRISIS ALERT! Crisis signal detected in mood entries. Providing immediate support resources.");
        return res.json({
          insights: crisisResponse,
          isCrisis: true
        });
      }

      const systemMessage = "You are an empathetic wellness assistant analyzing mood entries. Based on the provided mood data, identify patterns and provide supportive, helpful insights. Keep your response concise (max 2-3 sentences). Respond in JSON format with an 'insights' field containing your analysis.";
      
      const aiResponse = await callAIService(JSON.stringify(entries), systemMessage, true);
      
      let result;
      try {
        result = JSON.parse(aiResponse);
      } catch {
        result = { insights: aiResponse || "Your mood patterns show important insights about your well-being journey." };
      }

      return res.json({
        insights: result.insights || ''
      });
    } catch (error: any) {
      console.error("Error generating mood insights:", error);
      return res.json({
        insights: getMoodInsight()
      });
    }
  });

  // Chat endpoint
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages, tone, responseLength } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Chat messages are required" });
      }

      let lengthInstruction = "Provide detailed, thoughtful, and well-explained responses. Take time to explore the topic thoroughly.";
      if (responseLength === 1) lengthInstruction = "Provide moderate detail - balanced between helpful and readable.";
      else if (responseLength === 3) lengthInstruction = "Provide comprehensive, in-depth responses with thorough explanations.";

      let toneInstruction = "Talk like a caring friend - be warm, empathetic, and conversational. Use contractions, casual language, and show genuine interest in how they're feeling.";
      switch (tone) {
        case 'clinical':
          toneInstruction = "Use a clinical, objective tone with medical accuracy. Focus on evidence-based practices and healthcare information.";
          break;
        case 'spiritual':
          toneInstruction = "Use a mindful, spiritual tone that emphasizes inner peace, meditation, and harmony with nature.";
          break;
      }

      const systemMessage = `You are MindMate, a friendly AI companion who's here to support someone's mental wellness journey. ${toneInstruction} ${lengthInstruction} 

Be like a trusted friend who really cares - ask follow-up questions when appropriate, share relatable thoughts, and make them feel heard and supported. Use phrases like "I totally get that", "That sounds really tough", "I'm here for you", "How does that make you feel?". Show empathy and understanding. For serious concerns, gently suggest professional help while staying supportive.

INTERACTIVE & DETAILED RESPONSES - ALWAYS:
1. Give thorough, well-structured answers - never give one-line or vague responses
2. Use bullet points, numbered lists, or clear paragraphs to organize information
3. Explain the "why" behind advice, not just the "what" - help users understand
4. End with an engaging follow-up: "Would you like me to elaborate on any of these?", "What resonates most with you?", "Want me to suggest more specific steps?"
5. Offer to go deeper: "I can break that down further if you'd like" or "Want more ideas on this?"

WHEN USERS ASK FOR SUGGESTIONS, ADVICE, OR IDEAS (phrases like "suggestions", "advice", "ideas", "what should I do", "help me", "any tips", "give me options"):
- Provide 3-5 specific, actionable suggestions with DETAILED explanations for each
- For EACH suggestion: (a) What to do step-by-step, (b) Why it helps, (c) How long / when to try it, (d) Any tips or variations
- Use clear formatting: numbered lists, bullet points, or headers so it's easy to scan
- Make suggestions personal and relevant to what they've shared in the conversation
- End with: "Which of these would you like to try first?" or "Want me to expand on any of these?"
- If the topic is broad, offer 2-3 categories of suggestions (e.g., immediate relief + long-term strategies)

IMPORTANT BEHAVIOR FOR EMOTIONS: When users express negative emotions like feeling sad, anxious, stressed, angry, etc.:
1. First, acknowledge and validate their feelings empathetically with detailed understanding
2. Ask gentle follow-up questions to understand WHY they're feeling this way (e.g., "What happened?" or "What's been going on?")
3. Try to understand the root cause or trigger by exploring their situation
4. When they ask for suggestions/advice/help, give the detailed suggestion format above
5. Proactively offer: "Would you like some suggestions that might help?" when they seem stuck

DETAILED ANSWERS TO QUESTIONS:
- For "how" questions: Provide step-by-step guidance with explanations
- For "what" questions: Give comprehensive overviews with examples
- For "why" questions: Explain causes, mechanisms, and context clearly
- For general topics: Cover multiple angles (physical, emotional, practical) when relevant

Keep responses conversational and natural - like chatting with a close friend who really wants to help. Make your responses warm, detailed, and engaging. Never be brief when the user needs depth.

IMPORTANT: Avoid repeating yourself! Look at the conversation history and vary your responses. Don't give the same advice twice, don't use the same phrases repeatedly, and try different approaches to show you care.

Remember: You're not a therapist, but you are a caring friend who wants to help them feel better. Make your responses detailed, thoughtful, genuinely supportive, and interactive.`;

      const lastMessage = messages[messages.length - 1];
      const conversationContext = messages.slice(0, -1).map(m => `${m.role}: ${m.content}`).join('\n');
      const prompt = conversationContext ? `${conversationContext}\n\nuser: ${lastMessage.content}` : lastMessage.content;

      // Extract recent AI responses to avoid repetition
      const recentAIResponses = messages
        .filter(m => m.role === 'assistant')
        .slice(-3) // Last 3 AI responses
        .map(m => m.content.toLowerCase());

      const repetitionWarning = recentAIResponses.length > 0
        ? `\n\nIMPORTANT: Do NOT repeat these recent responses or similar advice: ${recentAIResponses.join(' | ')}. Find fresh ways to respond and offer different suggestions.`
        : '';

      const fullPrompt = `${systemMessage}${repetitionWarning}\n\n${prompt}`;

      const aiResponse = await callAIService(fullPrompt, systemMessage);

      return res.json({
        response: aiResponse || 'I apologize, but I could not generate a response at this time.'
      });
    } catch (error: any) {
      console.error("Error generating chat response:", error);
      return res.json({
        response: getChatResponse(req.body.tone || 'friendly')
      });
    }
  });

  // Clear recent responses endpoint (for chat reset)
  app.post("/api/clear-recent-responses", async (req, res) => {
    try {
      clearRecentResponses();
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Error clearing recent responses:", error);
      return res.status(500).json({ error: "Failed to clear recent responses" });
    }
  });

  // Health advice endpoint
  app.post("/api/ai/health-advice", async (req, res) => {
    try {
      const { category, tone } = req.body;
      if (!category) {
        return res.status(400).json({ error: "Category is required" });
      }

      let toneInstruction = "Use a friendly, conversational tone.";
      switch (tone) {
        case 'clinical':
          toneInstruction = "Use a clinical, objective tone with medical accuracy.";
          break;
        case 'spiritual':
          toneInstruction = "Use a mindful, spiritual tone that emphasizes inner peace.";
          break;
      }

      let categoryPrompt = "";
      switch (category) {
        case 'general': categoryPrompt = "general wellness"; break;
        case 'diet': categoryPrompt = "nutrition and healthy eating"; break;
        case 'sleep': categoryPrompt = "sleep hygiene"; break;
        case 'hydration': categoryPrompt = "proper hydration"; break;
        case 'posture': categoryPrompt = "ergonomics and posture"; break;
        default: categoryPrompt = "general wellness";
      }

      const systemMessage = `You are Dr. Mind AI. ${toneInstruction} Provide practical, evidence-based advice about ${categoryPrompt}. Give 3-5 actionable tips with short explanations.`;
      const prompt = `I would like some advice about ${categoryPrompt}.`;

      const aiResponse = await callAIService(prompt, systemMessage);

      return res.json({
        advice: aiResponse || 'I could not generate health advice at this time.'
      });
    } catch (error: any) {
      console.error("Error generating health advice:", error);
      return res.json({
        advice: getHealthAdviceContent(req.body.category || 'general')
      });
    }
  });

  // Mental peace techniques endpoint
  app.post("/api/ai/mental-peace", async (req, res) => {
    try {
      const { category, tone } = req.body;
      if (!category) {
        return res.status(400).json({ error: "Category is required" });
      }

      let toneInstruction = "Use a friendly, conversational tone.";
      if (tone === 'clinical') toneInstruction = "Use a clinical, objective tone.";
      else if (tone === 'spiritual') toneInstruction = "Use a mindful, spiritual tone.";

      let categoryPrompt = "";
      switch (category) {
        case 'mindfulness': categoryPrompt = "mindfulness practices"; break;
        case 'stress': categoryPrompt = "stress reduction"; break;
        case 'breathing': categoryPrompt = "breathing exercises"; break;
        case 'affirmations': categoryPrompt = "positive affirmations"; break;
        case 'meditation': categoryPrompt = "meditation practices"; break;
        default: categoryPrompt = "mindfulness and mental well-being";
      }

      const systemMessage = `You are Dr.Mind AI. ${toneInstruction} Provide a practical technique for ${categoryPrompt} with step-by-step instructions and benefits.`;
      const prompt = `I would like to learn a technique for ${categoryPrompt}.`;

      const aiResponse = await callAIService(prompt, systemMessage);

      return res.json({
        technique: aiResponse || 'I could not generate a mental peace technique at this time.'
      });
    } catch (error: any) {
      console.error("Error generating mental peace technique:", error);
      return res.json({
        technique: getMentalPeaceTechnique(req.body.category || 'mindfulness')
      });
    }
  });

  // Daily tip endpoint
  app.post("/api/ai/daily-tip", async (req, res) => {
    try {
      const { tone } = req.body;

      let toneInstruction = "Use a friendly, conversational tone.";
      if (tone === 'clinical') toneInstruction = "Use a clinical, objective tone.";
      else if (tone === 'spiritual') toneInstruction = "Use a mindful, spiritual tone.";

      const systemMessage = `You are Dr.Mind AI. ${toneInstruction} Generate a one-sentence daily wellness tip in JSON format with a 'tip' field.`;

      const aiResponse = await callAIService("Generate today's wellness tip.", systemMessage, true);

      let result;
      try {
        result = JSON.parse(aiResponse);
      } catch {
        result = { tip: aiResponse || 'Take a moment to breathe deeply and center yourself.' };
      }

      return res.json({
        tip: result.tip || 'Take a moment to breathe deeply and center yourself.'
      });
    } catch (error: any) {
      console.error("Error generating daily tip:", error);
      return res.json({
        tip: getDailyTip()
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
