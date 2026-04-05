import React, { useState, useEffect, useMemo } from 'react';
import { ActivityLog } from '../types';
import { 
  CalendarIcon, FireIcon, FeatherIcon, BookIcon, LeafIcon, ChevronDownIcon, CheckIcon, TrashIcon, EditIcon, SparklesIcon, TrendingUpIcon, SearchIcon, InfoIcon, LinkIcon, GlobeIcon
} from './Icons';
import { db } from '../services/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { generateJournalInsight, fetchSpiritualNews, NewsItem } from '../services/geminiService';
import { TOPICS } from '../App';
import { DailyVerseCard } from './DailyVerseCard';
import { DailyInspirationImage } from './DailyInspirationImage';

type Priority = 'high' | 'medium' | 'low';

interface Task {
  id: string;
  title: string;
  duration: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  placeholder: string;
  actionLabel?: string;
  actionPrompt?: string;
  priority: Priority;
}

const TASKS: Task[] = [
  { 
    id: 'journal', 
    title: 'Spiritual Journal', 
    duration: '1 MIN', 
    icon: <FeatherIcon className="w-5 h-5" />, 
    color: 'bg-green-100 text-green-600',
    description: "Reflect on today's blessings. Write down three things you are grateful for and how you've seen God's hand in your life today.",
    placeholder: "Today I am grateful for...",
    priority: 'medium'
  },
  { 
    id: 'verse', 
    title: 'Your Verse', 
    duration: '3 MIN', 
    icon: <BookIcon className="w-5 h-5" />, 
    color: 'bg-blue-100 text-blue-600',
    description: "Read Psalm 23 today. Focus on the comfort of the Shepherd's presence in the valley. Meditate on His guidance.",
    placeholder: "This verse speaks to me because...",
    actionLabel: "Read Psalm 23",
    actionPrompt: "Please show me Psalm 23 and guide me through a short meditation on it.",
    priority: 'high'
  },
  { 
    id: 'devotional', 
    title: 'Personalized Devotional', 
    duration: '3 MIN', 
    icon: <LeafIcon className="w-5 h-5" />, 
    color: 'bg-purple-100 text-purple-600',
    description: "Today's devotional focuses on Trust. Learn how letting go of control can bring a deeper sense of peace and purpose.",
    placeholder: "My takeaway from today's devotional is...",
    actionLabel: "Start Devotional",
    actionPrompt: "Please share a short devotional about Trust and letting go of control, including a relevant scripture.",
    priority: 'high'
  },
  {
    id: 'meditation',
    title: 'Mindful Prayer',
    duration: '5 MIN',
    icon: <FireIcon className="w-5 h-5" />,
    color: 'bg-orange-100 text-orange-600',
    description: "Find a quiet space. Focus on your breathing and recite 'The Lord is my Shepherd' with every breath for 5 minutes.",
    placeholder: "I felt...",
    priority: 'low'
  }
];

interface JourneyProps {
  userId: string;
  onNavigateToChat: (prompt: string) => void;
}

export const Journey: React.FC<JourneyProps> = ({ userId, onNavigateToChat }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [inputContent, setInputContent] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState(false);

  // Filter State
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'incomplete'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');

  // Load News
  useEffect(() => {
    const loadNews = async () => {
        setIsNewsLoading(true);
        const stored = localStorage.getItem('lumen_spiritual_news');
        const today = new Date().toISOString().split('T')[0];
        
        if (stored) {
            const { date, data } = JSON.parse(stored);
            if (date === today) {
                setNews(data);
                setIsNewsLoading(false);
                return;
            }
        }

        const freshNews = await fetchSpiritualNews();
        if (freshNews.length > 0) {
            setNews(freshNews);
            localStorage.setItem('lumen_spiritual_news', JSON.stringify({ date: today, data: freshNews }));
        }
        setIsNewsLoading(false);
    };
    loadNews();
  }, []);

  // Load Logs
  useEffect(() => {
    if (!userId) return;

    if (userId === 'guest-dev-user') {
        const local = localStorage.getItem('lumen_logs');
        if (local) setLogs(JSON.parse(local));
        return;
    }

    if (!db) return;

    const q = query(collection(db, 'users', userId, 'logs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityLog[];
      setLogs(loadedLogs);
    });
    return () => unsubscribe();
  }, [userId]);

  const updateLocalLogs = (newLogs: ActivityLog[]) => {
    setLogs(newLogs);
    localStorage.setItem('lumen_logs', JSON.stringify(newLogs));
  };

  const toggleExpand = (id: string) => {
    if (activeTaskId && activeTaskId !== id) {
        setActiveTaskId(null);
        setInputContent('');
        setEditingLogId(null);
    }
    setExpandedId(expandedId === id ? null : id);
  };

  const handleStartTask = (task: Task) => {
    setActiveTaskId(task.id);
    setExpandedId(task.id);
    setInputContent('');
    setEditingLogId(null);
  };

  const handleSaveLog = async () => {
    if (!activeTaskId && !editingLogId) return;
    if (!inputContent.trim()) return;

    try {
        if (editingLogId) {
            if (userId === 'guest-dev-user') {
                const updated = logs.map(l => l.id === editingLogId ? { ...l, content: inputContent } : l);
                updateLocalLogs(updated);
            } else if (db) {
                const logRef = doc(db, 'users', userId, 'logs', editingLogId);
                await updateDoc(logRef, { content: inputContent });
            }
            setEditingLogId(null);
        } else if (activeTaskId) {
            const task = TASKS.find(t => t.id === activeTaskId);
            if (!task) return;
            const newLogData = {
                taskId: task.id,
                taskTitle: task.title,
                content: inputContent,
                timestamp: Date.now(),
            };
            
            if (userId === 'guest-dev-user') {
                const newLog = { ...newLogData, id: Date.now().toString() };
                updateLocalLogs([newLog, ...logs]);
            } else if (db) {
                await addDoc(collection(db, 'users', userId, 'logs'), newLogData);
            }
        }
        setActiveTaskId(null);
        setInputContent('');
    } catch (e) {
        console.error("Error saving log", e);
    }
  };

  const handleEditLog = (log: ActivityLog) => {
    setEditingLogId(log.id);
    setActiveTaskId(log.taskId);
    setInputContent(log.content);
    setExpandedId(log.taskId);
  };

  const handleDeleteLog = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
        if (userId === 'guest-dev-user') {
            const updated = logs.filter(l => l.id !== id);
            updateLocalLogs(updated);
        } else if (db) {
            await deleteDoc(doc(db, 'users', userId, 'logs', id));
        }
    }
  };

  const handleDeepenReflection = async () => {
    if (!inputContent.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const insight = await generateJournalInsight(inputContent);
      if (insight) {
        setInputContent(prev => `${prev}\n\n--- Spiritual Insight ---\n${insight}`);
      }
    } catch (e) {
      console.error("Analysis failed", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const today = new Date().setHours(0,0,0,0);
  const todaysLogs = logs.filter(log => log.timestamp >= today);
  const uniqueTasksDone = new Set(todaysLogs.map(l => l.taskId)).size;
  const progress = Math.min(100, Math.round((uniqueTasksDone / TASKS.length) * 100));
  const currentDateDisplay = new Date().getDate();

  const filteredTasks = useMemo(() => {
    return TASKS.filter(task => {
      const isCompleted = todaysLogs.some(l => l.taskId === task.id);
      
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'completed' && isCompleted) || 
        (statusFilter === 'incomplete' && !isCompleted);
      
      const matchesPriority = 
        priorityFilter === 'all' || 
        task.priority === priorityFilter;

      return matchesStatus && matchesPriority;
    });
  }, [todaysLogs, statusFilter, priorityFilter]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 relative pb-20" role="main" aria-label="Daily Spiritual Journey">
       <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-brand-50/50 to-transparent"></div>
       </div>

      <div className="relative z-10 max-w-2xl mx-auto p-6 space-y-8">
        
        <div className="text-center pt-4 space-y-2">
          <h1 className="font-display text-4xl font-bold text-slate-800 leading-tight">Your Daily Walk</h1>
        </div>

        <div role="region" aria-label="Daily Motivating Image">
            <DailyInspirationImage />
        </div>

        {/* Faith in the World (Real-time Events) */}
        <div role="region" aria-label="Real-time spiritual news">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="font-display font-bold text-lg text-slate-800 flex items-center">
                    <GlobeIcon className="w-5 h-5 mr-2 text-blue-500" />
                    Faith in the World
                </h3>
            </div>
            
            {isNewsLoading ? (
                <div className="bg-white rounded-2xl p-6 border border-brand-100 flex items-center justify-center space-x-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin"></div>
                    <span className="text-sm font-medium text-slate-400">Searching global spiritual news...</span>
                </div>
            ) : (
                <div className="space-y-4">
                    {news.map((item, idx) => (
                        <div 
                            key={idx} 
                            className="bg-white p-5 rounded-2xl border border-brand-50 shadow-sm hover:shadow-md transition-all group"
                        >
                            <h4 className="font-bold text-slate-800 mb-1 group-hover:text-brand-600 transition-colors">{item.title}</h4>
                            <p className="text-xs text-slate-500 mb-4 line-clamp-2">{item.summary}</p>
                            <div className="flex items-center justify-between">
                                <a 
                                    href={item.uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-center text-[10px] font-bold text-brand-400 uppercase tracking-widest hover:text-brand-600"
                                >
                                    <LinkIcon className="w-3 h-3 mr-1" />
                                    Read Article
                                </a>
                                <button 
                                    onClick={() => onNavigateToChat(`I'd like to discuss the recent news: "${item.title}". Can you tell me more about its spiritual significance?`)}
                                    className="flex items-center text-[10px] font-bold text-indigo-500 uppercase tracking-widest hover:text-indigo-700"
                                >
                                    <SparklesIcon className="w-3 h-3 mr-1" />
                                    Discuss with AI
                                </button>
                            </div>
                        </div>
                    ))}
                    {news.length === 0 && (
                        <div className="text-center py-6 bg-white/50 border border-dashed border-brand-200 rounded-2xl">
                            <p className="text-sm text-slate-400">Unable to fetch current events right now. Please try again later.</p>
                        </div>
                    )}
                </div>
            )}
        </div>

        <div role="region" aria-label="Verse of the Day section">
          <DailyVerseCard userId={userId} />
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl shadow-brand-100/50 overflow-hidden border border-brand-50/50" role="region" aria-label="Today's progress summary">
          <div className="p-6 pb-8 bg-gradient-to-b from-white to-brand-50/30">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-display font-bold text-xl shadow-lg shadow-brand-200" aria-hidden="true">S</div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Spiritual Growth</h2>
                  <div className="text-xs text-brand-600 font-medium mt-0.5">Continuing your journey</div>
                </div>
              </div>
              <div className="flex items-center bg-slate-800 text-white px-3 py-1.5 rounded-lg space-x-2 shadow-lg" aria-label={`Current day: ${currentDateDisplay}`}>
                <CalendarIcon className="w-4 h-4 text-slate-400" />
                <span className="text-brand-400 font-bold">{currentDateDisplay}</span>
              </div>
            </div>

            <div className="space-y-2">
               <div className="flex justify-between items-end px-1">
                  <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Progress today</span>
                  <span className="text-lg font-bold text-brand-600" aria-label={`${progress} percent complete`}>{progress}%</span>
               </div>
               <div className="h-2 w-full bg-brand-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-brand-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
               </div>
            </div>
          </div>
        </div>

        <div role="region" aria-label="Trending suggested topics">
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="font-display font-bold text-lg text-slate-800 flex items-center">
              <TrendingUpIcon className="w-5 h-5 mr-2 text-brand-500" />
              Trending Today
            </h3>
          </div>
          <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
            {TOPICS.map((topic) => (
              <button
                key={topic.id}
                onClick={() => onNavigateToChat(topic.prompt)}
                className="flex-shrink-0 w-40 bg-white p-4 rounded-2xl border border-brand-100 shadow-sm hover:shadow-md hover:border-brand-300 transition-all text-left group"
                aria-label={`Start chat about ${topic.label}`}
              >
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-500 mb-3 group-hover:scale-110 transition-transform">
                  {topic.icon}
                </div>
                <div className="font-bold text-slate-700 text-sm leading-tight">{topic.label}</div>
                <div className="mt-2 flex items-center text-[10px] font-bold text-brand-400 uppercase tracking-widest">
                  Start Study
                  <SparklesIcon className="w-2.5 h-2.5 ml-1" />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4" role="region" aria-label="Daily tasks list">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
            <h3 className="font-display font-bold text-lg text-slate-800">Tasks for You</h3>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative group">
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="appearance-none bg-white border border-brand-100 rounded-lg px-3 py-1.5 text-xs font-bold text-brand-700 outline-none focus:ring-2 focus:ring-brand-200 pr-8 cursor-pointer shadow-sm uppercase tracking-wider"
                  aria-label="Filter by completion status"
                >
                  <option value="all">Status: All</option>
                  <option value="completed">Completed</option>
                  <option value="incomplete">Remaining</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-brand-400">
                  <ChevronDownIcon className="w-4 h-4" />
                </div>
              </div>

              <div className="relative group">
                <select 
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as any)}
                  className="appearance-none bg-white border border-brand-100 rounded-lg px-3 py-1.5 text-xs font-bold text-brand-700 outline-none focus:ring-2 focus:ring-brand-200 pr-8 cursor-pointer shadow-sm uppercase tracking-wider"
                  aria-label="Filter by priority"
                >
                  <option value="all">Priority: All</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-brand-400">
                  <ChevronDownIcon className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="bg-white/50 border border-brand-100 rounded-2xl p-8 text-center animate-in fade-in duration-300">
              <InfoIcon className="w-10 h-10 text-brand-200 mx-auto mb-2" />
              <p className="text-slate-500 font-medium italic">No tasks match your current filters.</p>
              <button 
                onClick={() => { setStatusFilter('all'); setPriorityFilter('all'); }}
                className="mt-3 text-xs font-bold text-brand-600 uppercase tracking-widest hover:text-brand-800 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="space-y-3" role="list">
              {filteredTasks.map((task) => {
                const isCompletedToday = todaysLogs.some(l => l.taskId === task.id);
                const isWriting = activeTaskId === task.id;
                const isExpanded = expandedId === task.id;

                return (
                    <div 
                      key={task.id} 
                      role="listitem"
                      className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 hover:shadow-md ${isCompletedToday ? 'border-green-100' : 'border-white'}`}
                    >
                    <button 
                      id={`task-btn-${task.id}`}
                      aria-expanded={isExpanded}
                      aria-controls={`task-content-${task.id}`}
                      className={`w-full p-4 flex items-center justify-between cursor-pointer ${isCompletedToday ? 'bg-green-50/20' : 'bg-white'}`} 
                      onClick={() => toggleExpand(task.id)}
                    >
                        <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${task.color} bg-opacity-20 relative`} aria-hidden="true">
                                {task.icon}
                                {isCompletedToday && <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center"><CheckIcon className="w-2.5 h-2.5 text-white" /></div>}
                            </div>
                            <div className="flex flex-col text-left">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-700 text-sm tracking-wide uppercase">{task.title}</span>
                                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border ${
                                    task.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100' :
                                    task.priority === 'medium' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                    'bg-slate-50 text-slate-500 border-slate-100'
                                  }`}>
                                    {task.priority}
                                  </span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-400 tracking-wider">{task.duration} • ESTIMATED</span>
                            </div>
                        </div>
                        <ChevronDownIcon className={`w-5 h-5 text-slate-300 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isExpanded && (
                        <div id={`task-content-${task.id}`} className="p-5 text-sm text-slate-600 bg-white border-t border-slate-50" role="region" aria-labelledby={`task-btn-${task.id}`}>
                            <p className="mb-4 leading-relaxed text-slate-500">{task.description}</p>
                            
                            {!isWriting && task.actionLabel && task.actionPrompt && (
                              <button onClick={(e) => { e.stopPropagation(); onNavigateToChat(task.actionPrompt!); }} className="w-full mb-4 py-2.5 rounded-xl border border-brand-200 text-brand-600 font-semibold text-xs uppercase tracking-wider hover:bg-brand-50 transition-colors flex items-center justify-center space-x-2" aria-label={`Start activity: ${task.actionLabel}`}>
                                <SparklesIcon className="w-4 h-4 text-gold-400" />
                                <span>{task.actionLabel}</span>
                              </button>
                            )}

                            {isWriting ? (
                                <div className="space-y-3 animate-in fade-in duration-300">
                                    <label htmlFor={`textarea-${task.id}`} className="sr-only">{task.placeholder}</label>
                                    <textarea 
                                      id={`textarea-${task.id}`}
                                      value={inputContent} 
                                      onChange={(e) => setInputContent(e.target.value)} 
                                      placeholder={task.placeholder} 
                                      rows={6} 
                                      className="w-full p-3 rounded-xl border border-brand-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none bg-brand-50/30 resize-none" 
                                      autoFocus 
                                    />
                                    
                                    <div className="flex justify-between items-center mb-1">
                                        <button 
                                          onClick={handleDeepenReflection}
                                          disabled={!inputContent.trim() || isAnalyzing}
                                          className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center space-x-1 hover:text-indigo-800 transition-colors disabled:opacity-50"
                                          aria-label="Use AI to deepen your reflection"
                                        >
                                           {isAnalyzing ? (
                                             <span className="animate-pulse">Analyzing...</span>
                                           ) : (
                                             <>
                                               <SparklesIcon className="w-3 h-3" />
                                               <span>Deepen Reflection (AI)</span>
                                             </>
                                           )}
                                        </button>
                                    </div>

                                    <div className="flex space-x-2">
                                        <button onClick={() => { setActiveTaskId(null); setEditingLogId(null); setInputContent(''); }} className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-xl font-medium text-xs uppercase tracking-wider hover:bg-slate-50" aria-label="Cancel reflection entry">Cancel</button>
                                        <button onClick={handleSaveLog} disabled={!inputContent.trim()} className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl font-medium text-xs uppercase tracking-wider hover:bg-brand-700 disabled:opacity-50" aria-label="Save reflection entry">Save Entry</button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={(e) => { e.stopPropagation(); handleStartTask(task); }} className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm ${isCompletedToday ? 'bg-green-50 text-green-600 border border-green-100 hover:bg-green-100' : 'bg-brand-600 text-white hover:bg-brand-700'}`} aria-label={`${isCompletedToday ? 'Add another reflection to' : 'Start reflection for'} ${task.title}`}>
                                    {isCompletedToday ? 'Add Another Entry' : 'Write Reflection'}
                                </button>
                            )}
                        </div>
                    )}
                    </div>
                );
              })}
            </div>
          )}
        </div>

        {logs.length > 0 && (
            <div className="pt-6 border-t border-slate-200/60" role="region" aria-label="Activity history">
                <h3 className="font-display font-bold text-lg text-slate-800 mb-4 px-1">Recent Activity</h3>
                <div className="space-y-4" role="list">
                    {logs.map((log) => (
                        <div key={log.id} role="listitem" className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 group relative">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center space-x-2">
                                    <span className="text-xs font-bold text-brand-500 uppercase tracking-wide px-2 py-0.5 bg-brand-50 rounded-full border border-brand-100">{log.taskTitle}</span>
                                    <span className="text-xs text-slate-400" aria-label={`Recorded on ${new Date(log.timestamp).toLocaleDateString()}`}>{new Date(log.timestamp).toLocaleDateString()}</span>
                                </div>
                                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditLog(log)} className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg" aria-label="Edit entry"><EditIcon className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => handleDeleteLog(log.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" aria-label="Delete entry"><TrashIcon className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-serif italic" aria-label="Log content">"{log.content}"</p>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};