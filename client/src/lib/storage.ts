import { 
  Activity, 
  DiaryEntry, 
  MoodEntry, 
  ChatMessage, 
  DiaryAnalysis
} from '@/types';
import { getAiDiaryAnalysis, getDailyWellnessTip, getMoodInsightAnalysis, getAiChatResponse } from './openai';

// Local storage keys
const STORAGE_KEYS = {
  Diary_ENTRIES: 'mindmate-Diary-entries',
  MOOD_ENTRIES: 'mindmate-mood-entries',
  CHAT_HISTORY: 'mindmate-chat-history',
  RECENT_ACTIVITIES: 'mindmate-recent-activities',
  DAILY_TIP: 'mindmate-daily-tip',
  DAILY_TIP_DATE: 'mindmate-daily-tip-date'
};

// Diary Functions
export function getDiaryEntries(): DiaryEntry[] {
  const entries = localStorage.getItem(STORAGE_KEYS.Diary_ENTRIES);
  return entries ? JSON.parse(entries) : [];
}

export function saveDiaryEntry(entry: DiaryEntry): void {
  const entries = getDiaryEntries();
  entries.unshift(entry); // Add to beginning
  localStorage.setItem(STORAGE_KEYS.Diary_ENTRIES, JSON.stringify(entries));
  
  // Add to recent activities
  addActivity({
    id: entry.id,
    type: 'Diary',
    title: 'Diary Entry',
    timestamp: new Date().toLocaleString(),
    icon: 'book'
  });
}

export async function analyzeDiaryEntry(content: string): Promise<DiaryAnalysis> {
  try {
    return await getAiDiaryAnalysis(content);
  } catch (error) {
    console.error('Error analyzing Diary entry:', error);
    return {
      insights: "Unable to analyze Diary entry at this time.",
      tags: ['unanalyzed']
    };
  }
}

// Mood Functions
export function getMoodEntries(): MoodEntry[] {
  const entries = localStorage.getItem(STORAGE_KEYS.MOOD_ENTRIES);
  return entries ? JSON.parse(entries) : [];
}

export function saveMoodEntry(entry: MoodEntry): void {
  const entries = getMoodEntries();
  
  // Check if already logged mood today
  const today = new Date().toDateString();
  const todayEntryIndex = entries.findIndex(e => 
    new Date(e.date).toDateString() === today
  );
  
  if (todayEntryIndex !== -1) {
    // Update today's entry
    entries[todayEntryIndex] = entry;
  } else {
    // Add new entry
    entries.unshift(entry);
  }
  
  localStorage.setItem(STORAGE_KEYS.MOOD_ENTRIES, JSON.stringify(entries));
  
  // Add to recent activities
  addActivity({
    id: entry.id,
    type: 'mood',
    title: `Mood Tracked: ${entry.mood.charAt(0).toUpperCase() + entry.mood.slice(1)}`,
    timestamp: new Date().toLocaleString(),
    icon: 'smile'
  });
}

export async function getMoodInsights(entries: MoodEntry[]): Promise<string> {
  try {
    return await getMoodInsightAnalysis(entries);
  } catch (error) {
    console.error('Error getting mood insights:', error);
    return "Track your mood regularly to get personalized insights.";
  }
}

// Chat Functions
export function getChatHistory(): ChatMessage[] {
  const history = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
  return history ? JSON.parse(history) : [];
}

export function saveChatHistory(messages: ChatMessage[]): void {
  localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(messages));
  
  // Only add to activities when a new message is added
  if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
    addActivity({
      id: Date.now().toString(),
      type: 'chat',
      title: 'AI Chat Session',
      timestamp: new Date().toLocaleString(),
      icon: 'comment-dots'
    });
  }
}

export async function getChatResponse(
  messages: ChatMessage[], 
  tone: string,
  responseLength: number
): Promise<string> {
  try {
    return await getAiChatResponse(messages, tone, responseLength);
  } catch (error) {
    console.error('Error getting chat response:', error);
    throw new Error('Failed to get response from AI assistant');
  }
}

// Daily Tip Functions
export function getDailyTip(): string {
  const lastDate = localStorage.getItem(STORAGE_KEYS.DAILY_TIP_DATE);
  const today = new Date().toDateString();
  
  // Check if tip was generated today
  if (lastDate === today) {
    const tip = localStorage.getItem(STORAGE_KEYS.DAILY_TIP);
    if (tip) return tip;
  }
  
  // Default tip if none exists or is outdated
  return "Taking a few minutes for mindful breathing can reset your nervous system and improve your focus throughout the day.";
}

export async function generateNewTip(tone: string): Promise<string> {
  try {
    const tip = await getDailyWellnessTip(tone);
    localStorage.setItem(STORAGE_KEYS.DAILY_TIP, tip);
    localStorage.setItem(STORAGE_KEYS.DAILY_TIP_DATE, new Date().toDateString());
    return tip;
  } catch (error) {
    console.error('Error generating daily tip:', error);
    return "Remember to take care of your mental health as much as your physical health.";
  }
}

// Activity Functions
export function getRecentActivities(): Activity[] {
  const activities = localStorage.getItem(STORAGE_KEYS.RECENT_ACTIVITIES);
  return activities ? JSON.parse(activities) : [];
}

function addActivity(activity: Activity): void {
  const activities = getRecentActivities();
  activities.unshift(activity);
  
  // Limit to 10 recent activities
  const limitedActivities = activities.slice(0, 10);
  localStorage.setItem(STORAGE_KEYS.RECENT_ACTIVITIES, JSON.stringify(limitedActivities));
}

// Data Management Functions
export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}

export function exportData(): any[] {
  try {
    const DiaryEntries = getDiaryEntries();
    const moodEntries = getMoodEntries();
    const chatHistory = getChatHistory();
    
    const data = [
      ...DiaryEntries.map(entry => ({ ...entry, type: 'Diary' })),
      ...moodEntries.map(entry => ({ ...entry, type: 'mood' })),
      ...chatHistory.map(entry => ({ ...entry, type: 'chat' }))
    ];
    
    // Create download
    const dataStr = JSON.stringify({
      DiaryEntries,
      moodEntries,
      chatHistory,
      exportDate: new Date().toISOString()
    }, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportName = `mindmate-data-${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
    
    return data;
  } catch (error) {
    console.error('Export failed:', error);
    return [];
  }
}
