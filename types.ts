import React from 'react';

export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  isStreaming?: boolean;
  timestamp: number;
  sources?: GroundingSource[];
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: number;
  messages: Message[];
}

export interface DailyVerse {
  text: string;
  reference: string;
}

export interface Topic {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

export interface PrayerRequest {
  id: string;
  title: string;
  content: string;
  description?: string;
  date: number;
  isAnswered: boolean;
  reminderTime?: number;
}

export interface ActivityLog {
  id: string;
  taskId: string;
  taskTitle: string;
  content: string;
  timestamp: number;
}

export interface FavoriteVerse {
  id: string;
  reference: string;
  text: string;
  date: number;
  source?: 'daily' | 'chat';
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  jobTitle: string;
  onlineStatus: 'Online' | 'Offline';
  bio: string;
  photo?: string; // base64 data url
  passwordHistory?: string[];
  // Accessibility & Performance Settings
  textSize?: number;
  highContrast?: boolean;
  reducedMotion?: boolean;
  voiceURI?: string;
  useLiteModel?: boolean;
}

export type ViewState = 'journey' | 'chat' | 'prayer' | 'illustrator' | 'settings' | 'favorites' | 'about' | 'zodiac' | 'accessibility' | 'search';