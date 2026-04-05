
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GenerateContentResponse, Content } from "@google/genai";
import { getCharacterChatSession } from '../services/geminiService';
import { Message, Role } from '../types';
// Added CheckIcon to the imports
import { SendIcon, RefreshIcon, DoveIcon, AnchorIcon, FireIcon, FeatherIcon, SunIcon, BookIcon, XIcon, ArrowDownIcon, SpeakerIcon, StopIcon, CopyIcon, SparklesIcon, ChevronDownIcon, CheckIcon } from './Icons';

interface Mentor {
  id: string;
  name: string;
  title: string;
  instruction: string;
  description: string;
  avatar: string; // URL or placeholder
  color: string;
  bgGradient: string;
  starterPrompt: string;
}

const MENTORS: Mentor[] = [
  {
    id: 'paul',
    name: 'Paul',
    title: 'Apostle to the Gentiles',
    description: 'Seek wisdom on perseverance, grace, and building the Church.',
    instruction: 'You are the Apostle Paul. You are passionate, intellectual, and deeply committed to the Gospel of Grace. Use your experience from your missionary journeys and your letters to provide guidance.',
    avatar: 'https://images.unsplash.com/photo-1590070110356-83675003058a?q=80&w=200&h=200&auto=format&fit=crop',
    color: 'bg-indigo-600',
    bgGradient: 'from-indigo-900 to-slate-900',
    starterPrompt: 'Brother Paul, I am struggling to stay faithful during a difficult season. What would you say to me?'
  },
  {
    id: 'esther',
    name: 'Esther',
    title: 'Queen of Persia',
    description: 'Discuss courage, divine timing, and standing up for your people.',
    instruction: 'You are Queen Esther. You are courageous, wise, and humble. You understand what it means to be placed in a position "for such a time as this." Speak with royal dignity and quiet strength.',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&h=200&auto=format&fit=crop',
    color: 'bg-purple-600',
    bgGradient: 'from-purple-900 to-slate-900',
    starterPrompt: 'Queen Esther, how can I find the courage to speak up when I am afraid?'
  },
  {
    id: 'peter',
    name: 'Peter',
    title: 'The Rock',
    description: 'Learn about second chances, impulsive faith, and restoration.',
    instruction: 'You are the Apostle Peter. You were a fisherman who became a fisher of men. You know what it is like to fail deeply and be restored by Jesus. Speak with the rough-around-the-edges honesty of a fisherman transformed by Love.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&auto=format&fit=crop',
    color: 'bg-teal-600',
    bgGradient: 'from-teal-900 to-slate-900',
    starterPrompt: 'Peter, I feel like I have let God down. Is there still a place for me in His work?'
  },
  {
    id: 'david',
    name: 'David',
    title: 'King & Psalmist',
    description: 'A man after God\'s heart. Discuss worship, repentance, and leadership.',
    instruction: 'You are King David. You are a warrior, a king, and a poet. You have scaled heights of joy and walked through dark valleys. Use the language of the Psalms to comfort and guide the seeker.',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?q=80&w=200&h=200&auto=format&fit=crop',
    color: 'bg-amber-600',
    bgGradient: 'from-amber-900 to-slate-900',
    starterPrompt: 'King David, how can I keep my heart focused on God when life feels like a battle?'
  }
];

export const FaithMentors: React.FC = () => {
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSelectMentor = (mentor: Mentor) => {
    setSelectedMentor(mentor);
    setMessages([{
      id: 'welcome',
      role: Role.MODEL,
      text: `Greetings. I am ${mentor.name}. I am here to share the wisdom I have found in my walk with the Almighty. How may I encourage you today?`,
      timestamp: Date.now()
    }]);
  };

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || !selectedMentor) return;

    window.speechSynthesis.cancel();
    setSpeakingId(null);

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
      const history: Content[] = messages
        .filter(m => m.id !== 'welcome' && !m.isStreaming)
        .map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }));

      const chat = getCharacterChatSession(selectedMentor.name, selectedMentor.instruction, history);
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

      for await (const chunk of result) {
        const chunkText = (chunk as GenerateContentResponse).text || '';
        fullText += chunkText;
        setMessages(prev => prev.map(msg => msg.id === botMsgId ? { ...msg, text: fullText } : msg));
      }

      setMessages(prev => prev.map(msg => msg.id === botMsgId ? { ...msg, isStreaming: false } : msg));

    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: Role.MODEL, text: "I apologize, brother/sister, but the connection is faint. Let us try again.", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, selectedMentor, messages]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) { console.error('Failed to copy text', err); }
  };

  const handleSpeak = (text: string, id: string) => {
      if (speakingId === id) {
          window.speechSynthesis.cancel();
          setSpeakingId(null);
      } else {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => setSpeakingId(null);
          utterance.onerror = () => setSpeakingId(null);
          window.speechSynthesis.speak(utterance);
          setSpeakingId(id);
      }
  };

  if (!selectedMentor) {
    return (
      <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
        <div className="shrink-0 px-6 py-8 text-center bg-white border-b border-brand-100">
           <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-600 shadow-inner">
              <SparklesIcon className="w-8 h-8" />
           </div>
           <h1 className="font-display text-3xl font-bold text-slate-800 mb-2">Faith Mentors</h1>
           <p className="text-slate-500 max-w-md mx-auto">Engage in deep, scripturally-grounded dialogue with biblical figures. Seek wisdom from their lives and experiences.</p>
        </div>

        <div className="flex-1 p-6 md:p-10">
            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                {MENTORS.map(mentor => (
                    <button 
                        key={mentor.id}
                        onClick={() => handleSelectMentor(mentor)}
                        className="group relative bg-white rounded-3xl p-6 border border-brand-100 shadow-sm hover:shadow-xl transition-all duration-300 text-left overflow-hidden flex flex-col sm:flex-row items-center sm:items-start gap-6"
                    >
                        <div className={`absolute top-0 right-0 w-24 h-24 ${mentor.color} opacity-5 rounded-bl-full transition-all group-hover:scale-150`}></div>
                        
                        <div className="shrink-0 w-24 h-24 rounded-2xl overflow-hidden shadow-lg border-2 border-white ring-4 ring-brand-50/50 relative z-10 group-hover:scale-105 transition-transform">
                            <img src={mentor.avatar} alt={mentor.name} className="w-full h-full object-cover" />
                        </div>
                        
                        <div className="flex-1 text-center sm:text-left relative z-10">
                            <span className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] mb-1 block">{mentor.title}</span>
                            <h3 className="font-display text-2xl font-bold text-slate-800 mb-2">{mentor.name}</h3>
                            <p className="text-sm text-slate-500 leading-relaxed mb-4">{mentor.description}</p>
                            <div className="flex items-center text-xs font-bold text-brand-600 uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                                Begin Dialogue
                                <ArrowDownIcon className="w-3 h-3 ml-1 -rotate-90" />
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white relative animate-in fade-in duration-500">
        {/* Mentor Header */}
        <div className={`shrink-0 px-6 py-4 ${selectedMentor.bgGradient} text-white flex justify-between items-center shadow-lg relative z-20`}>
            <div className="flex items-center space-x-4">
                <button 
                    onClick={() => setSelectedMentor(null)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    aria-label="Go back to character selection"
                >
                    <XIcon className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30">
                    <img src={selectedMentor.avatar} alt={selectedMentor.name} className="w-full h-full object-cover" />
                </div>
                <div>
                    <h2 className="font-display text-xl font-bold leading-none">{selectedMentor.name}</h2>
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{selectedMentor.title}</span>
                </div>
            </div>
            <div className="hidden sm:flex items-center space-x-2 bg-white/10 px-3 py-1 rounded-full border border-white/10">
                <SparklesIcon className="w-3.5 h-3.5 text-yellow-300" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Ancient Scholar View</span>
            </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-32 bg-slate-50/50 scrollbar-hide">
            <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((msg, index) => (
                    <div key={msg.id} className={`flex w-full ${msg.role === Role.USER ? 'justify-end' : 'justify-start items-end'}`}>
                        {msg.role === Role.MODEL && (
                            <div className="flex-shrink-0 mr-2.5 mb-1">
                                <div className={`w-8 h-8 rounded-full ${selectedMentor.color} flex items-center justify-center shadow-sm text-white overflow-hidden`}>
                                    <img src={selectedMentor.avatar} alt={selectedMentor.name} className="w-full h-full object-cover" />
                                </div>
                            </div>
                        )}
                        <div 
                            className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-5 py-4 shadow-sm leading-relaxed ${
                                msg.role === Role.USER 
                                ? `${selectedMentor.color} text-white rounded-br-none` 
                                : 'bg-white text-slate-700 rounded-bl-none border border-slate-100 font-serif italic'
                            } group relative`}
                        >
                            <div className="whitespace-pre-wrap text-[15px] sm:text-[16px]">
                                {msg.text}
                                {msg.isStreaming && <span className={`inline-block w-1.5 h-4 ml-0.5 align-middle ${msg.role === Role.USER ? 'bg-white/50' : 'bg-brand-400/80'} animate-pulse rounded-[1px]`}></span>}
                            </div>
                            
                            {msg.role === Role.MODEL && !msg.isStreaming && (
                                <div className="mt-3 pt-3 border-t border-slate-50 flex space-x-2 justify-end">
                                    <button 
                                        onClick={() => handleSpeak(msg.text, msg.id)} 
                                        className="p-1.5 text-slate-300 hover:text-brand-500 rounded-lg transition-colors"
                                    >
                                        {speakingId === msg.id ? <StopIcon className="w-4 h-4 animate-pulse" /> : <SpeakerIcon className="w-4 h-4" />}
                                    </button>
                                    <button 
                                        onClick={() => handleCopy(msg.text, msg.id)} 
                                        className="p-1.5 text-slate-300 hover:text-brand-500 rounded-lg transition-colors"
                                    >
                                        {copiedId === msg.id ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent">
            <div className="max-w-3xl mx-auto">
                {messages.length === 1 && (
                    <button 
                        onClick={() => handleSend(selectedMentor.starterPrompt)}
                        className="mb-4 w-full p-4 bg-white rounded-2xl border-2 border-dashed border-brand-100 text-brand-600 font-medium text-sm hover:bg-brand-50 transition-all text-center flex items-center justify-center space-x-2"
                    >
                        <FeatherIcon className="w-4 h-4" />
                        <span>Try: "{selectedMentor.starterPrompt}"</span>
                    </button>
                )}
                <div className="bg-white rounded-2xl shadow-2xl border border-brand-100 p-2 flex items-end space-x-2 ring-1 ring-brand-100/50">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input); }}}
                        placeholder={`Talk with ${selectedMentor.name}...`}
                        className="flex-1 max-h-32 min-h-[52px] bg-transparent border-none focus:ring-0 text-slate-800 placeholder-slate-400 resize-none p-3"
                        rows={1}
                    />
                    <button 
                        onClick={() => handleSend(input)} 
                        disabled={!input.trim() || isLoading} 
                        className={`p-3 rounded-xl flex-shrink-0 transition-all duration-200 ${input.trim() && !isLoading ? `${selectedMentor.color} text-white shadow-md` : 'bg-slate-100 text-slate-400'}`}
                    >
                        <SendIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};
