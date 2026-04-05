import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GenerateContentResponse, Content } from "@google/genai";
import { getChatSession, resetChatSession, fetchBibleVerse, generateTTS, GeminiVoiceName } from '../services/geminiService';
import { Message, Role, ChatSession as ChatSessionType, DailyVerse, GroundingSource } from '../types';
import { SendIcon, RefreshIcon, DoveIcon, BookIcon, HeartIcon, ShareIcon, CheckIcon, SpeakerIcon, StopIcon, CopyIcon, PlusIcon, SearchIcon, XIcon, LinkIcon, FireIcon } from './Icons';
import { DailyVerseCard } from './DailyVerseCard';
import { db } from '../services/firebase';
import { collection, doc, setDoc, getDoc, addDoc, updateDoc } from 'firebase/firestore';
import { ShareModal } from './ShareModal';

interface ChatProps {
  userId: string;
  chatId: string | null;
  onChatCreated: (id: string) => void;
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
}

const findBibleReference = (text: string): string | null => {
  const regex = /\b((?:1|2|3|I|II|III)\s?)?[A-Z][a-z]+\.?\s\d+(?::\d+(?:-\d+)?)?\b/;
  const match = text.match(regex);
  return match ? match[0] : null;
};

export const Chat: React.FC<ChatProps> = ({ userId, chatId, onChatCreated, initialPrompt, onClearInitialPrompt }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [sharingMessage, setSharingMessage] = useState<{text: string, id: string} | null>(null);
  const [preferredVoice, setPreferredVoice] = useState<GeminiVoiceName>('Zephyr');
  const [useLite, setUseLite] = useState(false);
  
  // Audio state
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Verse Lookup State
  const [showVerseLookup, setShowVerseLookup] = useState(false);
  const [lookupRef, setLookupRef] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasLoadedHistory = useRef(false);

  // Load User Preferences (Voice & Model)
  useEffect(() => {
    const fetchPreferences = async () => {
        if (!userId) return;
        
        let voice: GeminiVoiceName = 'Zephyr';
        let lite = false;
        
        if (userId === 'guest-dev-user') {
            const saved = localStorage.getItem('lumen_user_profile');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    voice = (parsed.voiceURI as GeminiVoiceName) || 'Zephyr';
                    lite = parsed.useLiteModel || false;
                } catch (e) {}
            }
        } else if (db) {
            try {
                const docRef = doc(db, 'users', userId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    voice = (data.voiceURI as GeminiVoiceName) || 'Zephyr';
                    lite = data.useLiteModel || false;
                }
            } catch (e) {}
        }
        setPreferredVoice(voice);
        setUseLite(lite);
    };
    fetchPreferences();
  }, [userId]);

  // Load specific chat history
  useEffect(() => {
    const loadHistory = async () => {
      hasLoadedHistory.current = false;
      if (!chatId) {
        const welcomeMsg: Message = { id: 'welcome', role: Role.MODEL, text: "Welcome. I am Lumen. How can I support your spiritual journey today?", timestamp: Date.now() };
        setMessages([welcomeMsg]);
        resetChatSession([], useLite);
        hasLoadedHistory.current = true;
        return;
      }

      try {
        if (userId === 'guest-dev-user') {
          const saved = localStorage.getItem('lumen_chats');
          if (saved) {
             const allChats = JSON.parse(saved) as ChatSessionType[];
             const currentChat = allChats.find(c => c.id === chatId);
             if (currentChat) {
               setMessages(currentChat.messages);
               const history: Content[] = currentChat.messages
                 .filter((m: Message) => m.id !== 'welcome' && !m.isStreaming)
                 .map((m: Message) => ({
                   role: m.role,
                   parts: [{ text: m.text }]
                 }));
               resetChatSession(history, useLite);
             }
          }
        } else if (db) {
            const docRef = doc(db, 'users', userId, 'chats', chatId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const savedMessages = docSnap.data().messages as Message[];
              setMessages(savedMessages);
              
              const history: Content[] = savedMessages
                .filter(m => m.id !== 'welcome' && !m.isStreaming)
                .map(m => ({
                  role: m.role,
                  parts: [{ text: m.text }]
                }));
              resetChatSession(history, useLite);
            }
        }
      } catch (e) {
        console.error("Error loading chat history", e);
      } finally {
        hasLoadedHistory.current = true;
      }
    };
    
    if (userId) loadHistory();
  }, [userId, chatId, useLite]);

  // Save specific chat history
  useEffect(() => {
    if (!hasLoadedHistory.current || messages.length === 0 || !chatId) return;
    const saveHistory = async () => {
        try {
            const title = messages.find(m => m.role === Role.USER)?.text.substring(0, 40) || 'New Conversation';
            const lastMessage = messages[messages.length - 1].text;
            
            if (userId === 'guest-dev-user') {
                const saved = localStorage.getItem('lumen_chats');
                let allChats = saved ? JSON.parse(saved) as ChatSessionType[] : [];
                const chatIndex = allChats.findIndex(c => c.id === chatId);
                
                if (chatIndex >= 0) {
                    allChats[chatIndex] = { ...allChats[chatIndex], messages, lastMessage, timestamp: Date.now() };
                } else {
                    allChats.push({ id: chatId, title, lastMessage, timestamp: Date.now(), messages });
                }
                localStorage.setItem('lumen_chats', JSON.stringify(allChats));
            } else if (db) {
                await setDoc(doc(db, 'users', userId, 'chats', chatId), { 
                  messages, 
                  title, 
                  lastMessage, 
                  timestamp: Date.now() 
                }, { merge: true });
            }
        } catch (e) { console.error("Error saving chat", e); }
    };
    const timeout = setTimeout(saveHistory, 1000);
    return () => clearTimeout(timeout);
  }, [messages, userId, chatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const stopAudio = () => {
    if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e){}
        sourceNodeRef.current = null;
    }
    setSpeakingId(null);
  };

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    stopAudio();

    let currentChatId = chatId;
    
    if (!currentChatId) {
      currentChatId = Date.now().toString();
      onChatCreated(currentChatId);
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const chat = getChatSession(undefined, useLite);
      const botMsgId = (Date.now() + 1).toString();
      setMessages(prev => [
        ...prev,
        {
          id: botMsgId,
          role: Role.MODEL,
          text: '',
          isStreaming: true,
          timestamp: Date.now(),
        }
      ]);

      const result = await chat.sendMessageStream({ message: text });
      let fullText = '';
      let lastChunk: any = null;

      for await (const chunk of result) {
        lastChunk = chunk;
        const chunkText = (chunk as GenerateContentResponse).text || '';
        fullText += chunkText;
        setMessages(prev => prev.map(msg => msg.id === botMsgId ? { ...msg, text: fullText } : msg));
      }

      // Extract Grounding Chunks
      let sources: GroundingSource[] = [];
      if (lastChunk?.candidates?.[0]?.groundingMetadata?.groundingChunks) {
          const chunks = lastChunk.candidates[0].groundingMetadata.groundingChunks;
          sources = chunks
            .map((c: any) => c.web)
            .filter((w: any) => w)
            .map((w: any) => ({ uri: w.uri, title: w.title }));
      }

      setMessages(prev => prev.map(msg => msg.id === botMsgId ? { ...msg, isStreaming: false, sources } : msg));

    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: Role.MODEL, text: "I apologize, but I am having trouble connecting right now.", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, chatId, onChatCreated, useLite]);

  const handleLookupVerse = async () => {
    if (!lookupRef.trim() || isLookingUp) return;
    
    setIsLookingUp(true);
    try {
      const result = await fetchBibleVerse(lookupRef, useLite);
      if (result) {
        const userMsg: Message = {
          id: Date.now().toString(),
          role: Role.USER,
          text: `Lookup verse: ${lookupRef}`,
          timestamp: Date.now(),
        };

        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: Role.MODEL,
          text: `**${result.reference}**\n\n"${result.text}"`,
          timestamp: Date.now() + 1,
        };

        if (!chatId) {
            onChatCreated(Date.now().toString());
        }

        setMessages(prev => [...prev, userMsg, botMsg]);
        setLookupRef('');
        setShowVerseLookup(false);
      }
    } catch (e) {
      console.error("Verse lookup failed", e);
    } finally {
      setIsLookingUp(false);
    }
  };

  useEffect(() => {
    if (initialPrompt && hasLoadedHistory.current) {
      handleSend(initialPrompt);
      if(onClearInitialPrompt) onClearInitialPrompt();
    }
  }, [initialPrompt, hasLoadedHistory.current, useLite]);

  const handleReset = () => {
    onChatCreated(''); 
  };

  const handleRegenerate = async () => {
    if (isLoading || messages.length < 2) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== Role.MODEL) return;
    const userMsg = messages[messages.length - 2];
    if (!userMsg || userMsg.role !== Role.USER) return;
    
    stopAudio();

    const keptMessages = messages.slice(0, -2);
    setMessages(keptMessages);
    
    const history = keptMessages
      .filter(m => m.id !== 'welcome' && !m.isStreaming)
      .map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      
    resetChatSession(history, useLite);
    await handleSend(userMsg.text);
  };

  const handleSaveVerse = async (text: string, reference: string) => {
      const newFav = { reference, text, date: Date.now(), source: 'chat' as const };
      try {
        if (userId === 'guest-dev-user') {
            const local = localStorage.getItem('lumen_favorites');
            const favs = local ? JSON.parse(local) : [];
            favs.unshift({ ...newFav, id: Date.now().toString() });
            localStorage.setItem('lumen_favorites', JSON.stringify(favs));
        } else if (db) {
            await addDoc(collection(db, 'users', userId, 'favorites'), newFav);
        }
        alert("Verse saved to favorites!");
      } catch (e) { console.error("Error saving favorite", e); }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) { console.error('Failed to copy text', err); }
  };

  const handleSpeak = async (text: string, id: string) => {
      if (speakingId === id) {
          stopAudio();
          return;
      }

      stopAudio();
      setSpeakingId(id);

      try {
          const buffer = await generateTTS(text, preferredVoice);
          if (buffer) {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const source = audioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => {
                if (speakingId === id) setSpeakingId(null);
            };
            source.start();
            sourceNodeRef.current = source;
          } else {
            setSpeakingId(null);
          }
      } catch (e) {
          console.error("Audio playback error", e);
          setSpeakingId(null);
      }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAudio();
  }, []);

  return (
    <div className="flex flex-col h-full relative" role="main" aria-label="Conversation interface">
      <div className="shrink-0 px-6 py-4 bg-white/80 backdrop-blur-md border-b border-brand-100 flex justify-between items-center z-10">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" aria-hidden="true"></div>
          <span className="text-brand-800 font-display font-semibold tracking-wide flex items-center">
            {chatId ? "Continuing Study" : "New Study Session"}
            {useLite && <FireIcon className="w-4 h-4 ml-2 text-gold-500" title="Lightning Mode Active" />}
          </span>
        </div>
        <button 
            onClick={handleReset} 
            className="flex items-center space-x-2 px-4 py-2 bg-brand-50 text-brand-700 rounded-xl hover:bg-brand-100 transition-colors text-sm font-bold uppercase tracking-wider"
            aria-label="Start a new chat conversation"
        >
          <PlusIcon className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-4 sm:p-6 pb-32" 
        role="log" 
        aria-live="polite" 
        aria-relevant="additions"
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {!chatId && <DailyVerseCard userId={userId} />}
          {messages.map((msg, index) => {
            const reference = msg.role === Role.MODEL && !msg.isStreaming ? findBibleReference(msg.text) : null;
            const isLastMessage = index === messages.length - 1;
            const isVerseCard = msg.role === Role.MODEL && msg.text.startsWith('**') && msg.text.includes('"');
            
            return (
            <div key={msg.id} className={`flex w-full ${msg.role === Role.USER ? 'justify-end' : 'justify-start items-end'}`}>
              {msg.role === Role.MODEL && (
                <div className="flex-shrink-0 mr-2.5 mb-1" aria-hidden="true">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-100 to-white border border-brand-200 flex items-center justify-center shadow-sm text-brand-500">
                    <DoveIcon className="w-4 h-4" />
                  </div>
                </div>
              )}
              <div 
                className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-5 py-4 shadow-sm leading-relaxed ${
                  msg.role === Role.USER 
                  ? 'bg-brand-600 text-white rounded-br-none' 
                  : isVerseCard 
                    ? 'bg-white border-2 border-brand-100 text-slate-800 italic font-serif' 
                    : 'bg-gradient-to-br from-white to-brand-50 text-slate-700 rounded-bl-none border border-brand-100'
                } group relative`}
                role="article"
                aria-label={msg.role === Role.USER ? "Your message" : "Lumen's message"}
              >
                <div className="whitespace-pre-wrap font-sans text-[15px] sm:text-[16px]">
                  {msg.text}
                  {msg.isStreaming && msg.text.length > 0 && <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-brand-400/80 animate-pulse rounded-[1px]" aria-label="Streaming response"></span>}
                  {msg.isStreaming && msg.text.length === 0 && (
                    <div className="flex space-x-1 items-center h-6 my-1" aria-label="Lumen is thinking">
                      <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce"></div>
                    </div>
                  )}
                </div>

                {/* Grounding Sources */}
                {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-brand-100/50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                            <SearchIcon className="w-2.5 h-2.5 mr-1" />
                            Sources
                        </p>
                        <div className="flex flex-col space-y-2">
                            {msg.sources.map((source, sIdx) => (
                                <a 
                                    key={sIdx} 
                                    href={source.uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-center space-x-2 text-xs text-brand-600 hover:text-brand-800 bg-brand-50/50 p-2 rounded-lg transition-colors border border-brand-100"
                                >
                                    <LinkIcon className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{source.title || source.uri}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {msg.role === Role.MODEL && !msg.isStreaming && (
                  <div className="mt-3 pt-3 border-t border-brand-100/50 flex flex-wrap gap-2 items-center justify-between">
                    <div>
                      {reference && (
                        <button 
                          onClick={() => handleSend(`Read surrounding verses for ${reference}`)} 
                          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/60 hover:bg-white rounded-lg text-xs font-medium text-brand-700 transition-colors border border-brand-100 shadow-sm"
                          aria-label={`Read context for ${reference}`}
                        >
                          <BookIcon className="w-3.5 h-3.5 text-brand-400" />
                          <span>Read Context</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                       {isLastMessage && !isVerseCard && (
                           <button 
                             onClick={handleRegenerate} 
                             className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-brand-600 transition-colors hover:bg-white/60"
                             aria-label="Regenerate last AI response"
                           >
                              <RefreshIcon className="w-4 h-4" />
                              <span className="hidden sm:inline">Regenerate</span>
                           </button>
                       )}
                       <button 
                         onClick={() => handleSpeak(msg.text, msg.id)} 
                         className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-brand-600 transition-colors hover:bg-white/60"
                         aria-label={speakingId === msg.id ? "Stop audio playback" : "Listen to this message read aloud"}
                       >
                          {speakingId === msg.id ? <StopIcon className="w-4 h-4 text-brand-600 animate-pulse" /> : <SpeakerIcon className="w-4 h-4" />}
                          <span className="hidden sm:inline">{speakingId === msg.id ? 'Stop' : 'Listen'}</span>
                       </button>
                       {reference && (
                        <button 
                          onClick={() => handleSaveVerse(msg.text, reference)} 
                          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-500 transition-colors hover:bg-white/60"
                          aria-label="Save this verse to favorites"
                        >
                            <HeartIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">Save</span>
                        </button>
                       )}
                       <button 
                         onClick={() => handleCopy(msg.text, msg.id)} 
                         className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-brand-600 transition-colors hover:bg-white/60"
                         aria-label="Copy message text to clipboard"
                       >
                          {copiedId === msg.id ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                          <span className="hidden sm:inline">{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                       </button>
                       <button 
                         onClick={() => setSharingMessage({ text: msg.text, id: msg.id })} 
                         className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-brand-600 transition-colors hover:bg-white/60"
                         aria-label="Share this message"
                       >
                          <ShareIcon className="w-4 h-4" />
                          <span className="hidden sm:inline">Share</span>
                       </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )})}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
        <div className="max-w-3xl mx-auto flex flex-col space-y-2">
            
            {showVerseLookup && (
                <div className="bg-white rounded-2xl shadow-2xl border border-brand-100 p-4 mb-2 animate-in fade-in slide-in-from-bottom-4 flex items-center space-x-2">
                    <div className="shrink-0 p-2 bg-brand-50 rounded-xl text-brand-600">
                        <BookIcon className="w-5 h-5" />
                    </div>
                    <input 
                        autoFocus
                        type="text"
                        value={lookupRef}
                        onChange={(e) => setLookupRef(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleLookupVerse(); }}
                        placeholder="Enter reference (e.g. John 3:16)..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-800 placeholder-slate-400"
                    />
                    <button 
                        onClick={handleLookupVerse}
                        disabled={!lookupRef.trim() || isLookingUp}
                        className="p-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-all"
                    >
                        {isLookingUp ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <SearchIcon className="w-5 h-5" />}
                    </button>
                    <button onClick={() => setShowVerseLookup(false)} className="p-2 text-slate-400 hover:text-slate-600">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-xl border border-brand-100 p-2 flex items-end space-x-2 ring-1 ring-brand-100/50">
              <button 
                onClick={() => setShowVerseLookup(!showVerseLookup)}
                className={`p-3 rounded-xl transition-all ${showVerseLookup ? 'bg-brand-600 text-white' : 'bg-slate-50 text-brand-600 hover:bg-brand-50'}`}
                aria-label="Look up a Bible verse"
              >
                <BookIcon className="w-5 h-5" />
              </button>
              <label htmlFor="chatInput" className="sr-only">Type your question or message for Lumen</label>
              <textarea
                id="chatInput"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input); }}}
                placeholder="Ask about faith or current events..."
                className="flex-1 max-h-32 min-h-[52px] bg-transparent border-none focus:ring-0 text-slate-800 placeholder-slate-400 resize-none p-3"
                rows={1}
              />
              <button 
                onClick={() => handleSend(input)} 
                disabled={!input.trim() || isLoading} 
                className={`p-3 rounded-xl flex-shrink-0 transition-all duration-200 ${input.trim() && !isLoading ? 'bg-brand-600 text-white shadow-md hover:bg-brand-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                aria-label="Send message"
              >
                <SendIcon className="w-5 h-5" />
              </button>
            </div>
        </div>
      </div>
      
      <ShareModal isOpen={!!sharingMessage} onClose={() => setSharingMessage(null)} text={sharingMessage?.text || ''} />
    </div>
  );
};