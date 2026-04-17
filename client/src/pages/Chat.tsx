// pages/chat.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useSettings } from '@/contexts/SettingsContext';
import { getChatHistory, saveChatHistory, getChatResponse } from '@/lib/storage';
import { ChatMessage } from '@/types';

// Typing Indicator Component
const TypingIndicator: React.FC = () => (
  <div className="flex items-start mb-4">
    <div className="bg-white dark:bg-card p-2 rounded-full shadow-sm border border-primary/20">
      <i className="fas fa-robot text-primary text-lg"></i>
    </div>
    <div className="mx-3 py-3 px-5 rounded-xl bg-muted/50 rounded-bl-none shadow-sm">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  </div>
);

// Quick Suggestions Component - includes suggestion-focused prompts
const QuickSuggestions: React.FC<{ onSelect: (suggestion: string) => void; messageCount: number }> = ({ onSelect, messageCount }) => {
  const suggestionSets = [
    [
      "I'm feeling really stressed right now",
      "Give me suggestions for managing anxiety",
      "I need some motivation to get started",
      "I'm feeling really down today",
      "What can I do to sleep better?"
    ],
    [
      "Can you suggest something for my anxiety?",
      "I need detailed advice on negative thoughts",
      "Give me practical tips for when I'm overwhelmed",
      "What are some self-care ideas I can try today?",
      "I need help - any suggestions?"
    ],
    [
      "I'm having trouble focusing - give me suggestions",
      "I feel unmotivated. What should I do?",
      "How do I deal with difficult emotions? (with steps)",
      "I need a confidence boost - any ideas?",
      "What's a good daily routine for mental health? Explain in detail"
    ],
    [
      "Give me suggestions for tough days",
      "I need self-care ideas with step-by-step guidance",
      "What helps with decision making? I need advice",
      "I'm feeling disconnected - what can I do?",
      "How can I build better habits? Give me a detailed plan"
    ],
    [
      "I'd like suggestions for coping with this",
      "What are some things I could try right now?",
      "Can you give me 3-5 actionable ideas?",
      "I need advice - what would you recommend?",
      "Want to suggest something that might help?"
    ]
  ];

  // Rotate through suggestion sets based on message count
  const currentSet = suggestionSets[messageCount % suggestionSets.length];

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {currentSet.map((suggestion, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          onClick={() => onSelect(suggestion)}
          className="text-xs rounded-full hover:bg-primary/10"
        >
          {suggestion}
        </Button>
      ))}
    </div>
  );
};

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const { aiTone, responseLength } = useSettings();

  // Helper: call API to translate text
  const translateText = async (text: string, targetLang: string): Promise<string> => {
    if (targetLang === 'en') return text;
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang }),
      });
      const data = await res.json();
      return data.translatedText || text;
    } catch (err) {
      console.error('Translation error:', err);
      return text;
    }
  };

  // Load chat history or welcome message
  useEffect(() => {
    const history = getChatHistory();
    if (history.length === 0) {
      const hour = new Date().getHours();
      let greeting = "Hello";
      if (hour < 12) greeting = "Good morning";
      else if (hour < 17) greeting = "Good afternoon";
      else greeting = "Good evening";

      const welcomeMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `${greeting}! I'm your MindMate - think of me as that friend who's always got your back when it comes to feeling good. I'm here to chat, listen, and help you navigate whatever's going on. You can share how you're feeling, ask me anything, or ask for suggestions and I'll give you detailed, practical advice. How are you really doing today? 😊`,
        timestamp: new Date().toISOString(),
      };
      setMessages([welcomeMessage]);
      saveChatHistory([welcomeMessage]);
      speakText(welcomeMessage.content);
    } else {
      setMessages(history);
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speech recognition setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => setInput(event.results[0][0].transcript);

    recognitionRef.current = recognition;
  }, []);

  // Speak text
  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = selectedLanguage;
      utterance.pitch = 1;
      utterance.rate = 1;
      utterance.volume = 1;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Translate all messages when language changes
  useEffect(() => {
    const translateAllMessages = async () => {
      if (messages.length === 0) return;
      const translatedMessages: ChatMessage[] = [];
      for (const msg of messages) {
        const translatedContent = await translateText(msg.content, selectedLanguage);
        translatedMessages.push({ ...msg, content: translatedContent });
      }
      setMessages(translatedMessages);
    };
    translateAllMessages();
  }, [selectedLanguage]);

  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsProcessing(true);

    try {
      const response = await getChatResponse(updatedMessages, aiTone, responseLength);
      const translatedResponse = await translateText(response, selectedLanguage);

      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: translatedResponse,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      saveChatHistory(finalMessages);

      speakText(translatedResponse);
    } catch {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Oops, I had a little hiccup there! Technology can be finicky sometimes. Could you try saying that again? I'm all ears! 🙏",
        timestamp: new Date().toISOString(),
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = async () => {
    const hour = new Date().getHours();
    let greeting = "Hello";
    if (hour < 12) greeting = "Good morning";
    else if (hour < 17) greeting = "Good afternoon";
    else greeting = "Good evening";

    const welcomeMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `${greeting}! I'm your MindMate - think of me as that friend who's always got your back when it comes to feeling good. I'm here to chat, listen, and help you navigate whatever's going on. You can share how you're feeling, ask me anything, or ask for suggestions and I'll give you detailed, practical advice. How are you really doing today? 😊`,
      timestamp: new Date().toISOString(),
    };
    setMessages([welcomeMessage]);
    saveChatHistory([welcomeMessage]);
    speakText(welcomeMessage.content);

    // Clear recent responses on server to start fresh
    try {
      await fetch('/api/clear-recent-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Failed to clear recent responses:', error);
    }
  };

  const handleReaction = (messageId: string, reaction: string) => {
    setMessageReactions(prev => ({
      ...prev,
      [messageId]: reaction
    }));
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    // Could add a toast notification here
  };

  const handleVoiceInput = () => {
    if (!recognitionRef.current) return alert('Speech Recognition is not supported.');
    if (!isListening) recognitionRef.current.start();
    else recognitionRef.current.stop();
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">AI Chat</h1>
      <Card className="flex-1 flex flex-col overflow-hidden rounded-xl shadow-lg border-2 border-primary/10">
        <div className="p-4 border-b border-border flex justify-between items-center bg-gradient-to-r from-primary/10 to-secondary/10">
          <div className="flex items-center">
            <div className="bg-white dark:bg-card p-3 rounded-full shadow-sm">
              <i className="fas fa-robot text-primary text-xl"></i>
            </div>
            <div className="ml-3">
              <h3 className="font-heading font-medium text-lg">Your MindMate</h3>
              <p className="text-xs text-muted-foreground">Your friendly wellness companion 💙</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Language" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="gu">Gujarati</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => (isSpeaking ? stopSpeaking() : speakText(messages[messages.length - 1]?.content))}
              className="rounded-full hover:bg-white/20 dark:hover:bg-card/20"
            >
              <i className={`fas ${isSpeaking ? "fa-stop" : "fa-play"}`}></i>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="rounded-full hover:bg-white/20 dark:hover:bg-card/20"
            >
              <i className="fas fa-redo-alt"></i>
            </Button>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex items-start ${msg.role === 'user' ? 'justify-end' : ''} animate-fadeIn`}>
              {msg.role === 'assistant' && (
                <div className="bg-white dark:bg-card p-2 rounded-full shadow-sm border border-primary/20">
                  <i className="fas fa-robot text-primary text-lg"></i>
                </div>
              )}
              <div className="mx-3 flex-1">
                <div
                  className={`py-3 px-5 rounded-xl max-w-[80%] shadow-sm chat-message ${
                    msg.role === 'user'
                      ? 'chat-message-user bg-gradient-to-br from-primary to-secondary text-primary-foreground rounded-br-none ml-auto'
                      : 'chat-message-ai bg-muted/50 rounded-bl-none'
                  }`}
                >
                  <p>{msg.content}</p>
                </div>
                <div className={`text-xs text-muted-foreground mt-1 ${msg.role === 'user' ? 'text-right' : ''} flex items-center justify-between`}>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <div className="flex items-center space-x-1">
                    {msg.role === 'assistant' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReaction(msg.id, messageReactions[msg.id] === '👍' ? '' : '👍')}
                          className="h-6 w-6 p-0 text-xs"
                        >
                          {messageReactions[msg.id] === '👍' ? '👍' : '👍'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReaction(msg.id, messageReactions[msg.id] === '❤️' ? '' : '❤️')}
                          className="h-6 w-6 p-0 text-xs"
                        >
                          {messageReactions[msg.id] === '❤️' ? '❤️' : '❤️'}
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyMessage(msg.content)}
                      className="h-6 w-6 p-0 text-xs"
                      title="Copy message"
                    >
                      <i className="fas fa-copy"></i>
                    </Button>
                  </div>
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="bg-gradient-to-br from-primary to-secondary p-2 rounded-full shadow-sm">
                  <i className="fas fa-user text-white text-lg"></i>
                </div>
              )}
            </div>
          ))}
          {isProcessing && <TypingIndicator />}
          {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !isProcessing && (
            <QuickSuggestions onSelect={(suggestion) => setInput(suggestion)} messageCount={messages.length} />
          )}
          {messages.length === 1 && messages[0].role === 'assistant' && !isProcessing && (
            <p className="text-xs text-muted-foreground mt-3 italic">Tap a prompt below or type your own — ask for suggestions anytime for detailed advice!</p>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-border">
          <form onSubmit={handleSubmit} className="flex items-center space-x-3">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Share how you feel, ask a question, or request suggestions... 💭"
              disabled={isProcessing}
              className="flex-1 h-12 pl-4 pr-4 border-2 border-primary/10 focus-visible:ring-primary/30 rounded-full text-lg"
            />
            <Button
              type="button"
              onClick={handleVoiceInput}
              className={`btn rounded-full h-12 w-12 p-0 ${
                isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-r from-primary to-secondary'
              } text-white`}
              title={isListening ? 'Stop listening' : 'Start speaking'}
            >
              <i className={`fas ${isListening ? 'fa-microphone-slash' : 'fa-microphone'} text-lg`}></i>
            </Button>
            <Button
              type="submit"
              disabled={isProcessing}
              className="btn rounded-full h-12 w-12 p-0 bg-gradient-to-r from-primary to-secondary hover:shadow-lg text-white"
            >
              {isProcessing ? (
                <i className="fas fa-spinner fa-spin text-lg"></i>
              ) : (
                <i className="fas fa-paper-plane text-lg"></i>
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            <i className="fas fa-lightbulb mr-1"></i> Tip: Ask for suggestions anytime—e.g. "give me suggestions" or "I need advice"—for detailed, actionable ideas.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            <i className="fas fa-lock mr-1"></i> Your conversations are private and stored locally on your device only.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Chat;
