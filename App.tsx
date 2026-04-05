import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Chat } from './components/Chat';
import { PrayerWall } from './components/PrayerWall';
import { Journey } from './components/Journey';
import { ProfileSettings } from './components/ProfileSettings';
import { Favorites } from './components/Favorites';
import { About } from './components/About';
import { ZodiacDaily } from './components/ZodiacDaily';
import { AccessibilitySettings } from './components/AccessibilitySettings';
import { LoginScreen } from './components/LoginScreen';
import { BibleIllustrator } from './components/BibleIllustrator';
import { ReminderListener } from './components/ReminderListener';
import { GlobalSearch } from './components/GlobalSearch';
import { 
  MenuIcon, BookIcon, MessageCircleIcon, HandsIcon, MapIcon, SettingsIcon, DoveIcon, BookmarkIcon,
  SparklesIcon, HeartIcon, FeatherIcon, SunIcon, AnchorIcon, ShieldIcon, UsersIcon, BriefcaseIcon, LeafIcon, FireIcon,
  MoonIcon, CloudIcon, LightbulbIcon, SmileIcon, TrendingUpIcon, ArrowDownIcon, InfoIcon, StarIcon, AccessibilityIcon, ImageIcon, PlusIcon, ClockIcon, TrashIcon, SearchIcon
} from './components/Icons';
import { ViewState, Topic, ChatSession } from './types';
import { auth, isFirebaseConfigValid, db } from './services/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';

export const TOPICS: Topic[] = [
  { id: 'anxiety', label: 'Anxiety & Peace', icon: <DoveIcon className="w-5 h-5" />, prompt: "I am feeling anxious. Can you share some bible verses to help me find peace?" },
  { id: 'faith', label: 'Growing Faith', icon: <BookIcon className="w-5 h-5" />, prompt: "How can I strengthen my faith in difficult times?" },
  { id: 'guidance', label: 'Seeking Guidance', icon: <MapIcon className="w-5 h-5" />, prompt: "I need guidance for a big decision. What does the Bible say about wisdom?" },
  { id: 'relationships', label: 'Relationships', icon: <HandsIcon className="w-5 h-5" />, prompt: "How can I build Godly relationships and handle conflict?" },
  { id: 'purpose', label: 'Purpose & Calling', icon: <SparklesIcon className="w-5 h-5" />, prompt: "What does the Bible say about finding my purpose in life?" },
  { id: 'healing', label: 'Healing & Comfort', icon: <HeartIcon className="w-5 h-5" />, prompt: "I need comfort and healing. Please share some scriptures for physical and emotional restoration." },
  { id: 'forgiveness', label: 'Forgiveness', icon: <FeatherIcon className="w-5 h-5" />, prompt: "I'm struggling to forgive. How can I let go of bitterness and find grace?" },
  { id: 'stress', label: 'Stress & Rest', icon: <CloudIcon className="w-5 h-5" />, prompt: "I'm burnt out and stressed. Show me what the Bible says about rest and refreshing my soul." },
  { id: 'finance', label: 'Financial Wisdom', icon: <ShieldIcon className="w-5 h-5" />, prompt: "I need biblical wisdom regarding finances and trust in God's provision." },
  { id: 'courage', label: 'Strength & Courage', icon: <FireIcon className="w-5 h-5" />, prompt: "I need courage to face a challenge. What verses can inspire strength and boldness?" },
];

const MOCK_USER = {
  uid: 'guest-dev-user',
  email: 'guest@lumen.app',
  displayName: 'Guest User',
  isAnonymous: true,
  providerId: 'guest',
} as User;

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [guestUser, setGuestUser] = useState<User | null>(MOCK_USER);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('journey');
  const [startPrompt, setStartPrompt] = useState<string | undefined>(undefined);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // History State
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [recentChats, setRecentChats] = useState<ChatSession[]>([]);

  const isDemoMode = !isFirebaseConfigValid();
  const activeUser = user || guestUser;
  const effectiveUser = activeUser || MOCK_USER;

  // Listen for Auth
  useEffect(() => {
    if (isDemoMode || !auth) {
      setIsAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setGuestUser(null);
        localStorage.setItem('lumen_guest_mode', 'false');
        setShowAuthModal(false);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [isDemoMode]);

  // Global Settings Application
  useEffect(() => {
    const applySettings = async () => {
      if (!effectiveUser.uid) return;
      let settings: any = {};
      if (effectiveUser.uid === 'guest-dev-user') {
        const saved = localStorage.getItem('lumen_user_profile');
        if (saved) settings = JSON.parse(saved);
      } else if (db) {
        try {
          const docRef = doc(db, 'users', effectiveUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) settings = docSnap.data();
        } catch (e) {}
      }
      if (settings.textSize) document.documentElement.style.fontSize = `${settings.textSize}px`;
      if (settings.highContrast) document.body.classList.add('high-contrast');
      else document.body.classList.remove('high-contrast');
      if (settings.reducedMotion) document.body.classList.add('reduced-motion');
      else document.body.classList.remove('reduced-motion');
    };
    applySettings();
  }, [effectiveUser.uid]);

  // Load Recent Chats
  useEffect(() => {
    if (!effectiveUser.uid) return;
    if (effectiveUser.uid === 'guest-dev-user') {
      const saved = localStorage.getItem('lumen_chats');
      if (saved) {
        setRecentChats(JSON.parse(saved));
      }
      return;
    }
    if (db) {
      const q = query(collection(db, 'users', effectiveUser.uid, 'chats'), orderBy('timestamp', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setRecentChats(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatSession)));
      });
      return () => unsubscribe();
    }
  }, [effectiveUser.uid]);

  const handleLogout = useCallback(async () => {
    try {
      if (guestUser) { setShowAuthModal(true); return; }
      if (user && auth) await signOut(auth);
      setGuestUser(MOCK_USER);
      localStorage.setItem('lumen_guest_mode', 'true');
      setCurrentView('journey');
      document.documentElement.style.fontSize = '';
      document.body.classList.remove('high-contrast', 'reduced-motion');
    } catch (error) {}
  }, [user, guestUser]);

  const handleTopicClick = (prompt: string) => {
    setStartPrompt(prompt);
    setActiveChatId(null); // Start fresh
    setCurrentView('chat');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const selectChat = (id: string) => {
    setActiveChatId(id);
    setCurrentView('chat');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleGlobalSearch = (q: string) => {
    setSearchQuery(q);
    setCurrentView('search');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const deleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    try {
      if (effectiveUser.uid === 'guest-dev-user') {
        const filtered = recentChats.filter(c => c.id !== id);
        setRecentChats(filtered);
        localStorage.setItem('lumen_chats', JSON.stringify(filtered));
      } else if (db) {
        await deleteDoc(doc(db, 'users', effectiveUser.uid, 'chats', id));
      }
      if (activeChatId === id) setActiveChatId(null);
    } catch (err) {}
  };

  if (isAuthLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-50" role="status" aria-label="Loading Bible Chat">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-brand-200 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-brand-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-brand-50 text-slate-800 overflow-hidden font-sans relative">
      {effectiveUser && <ReminderListener userId={effectiveUser.uid} />}
      {showAuthModal && <LoginScreen onLoginSuccess={() => setShowAuthModal(false)} onGuestLogin={() => setShowAuthModal(false)} onClose={() => setShowAuthModal(false)} isDemoMode={isDemoMode} />}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden" aria-hidden="true" onClick={() => setIsSidebarOpen(false)}></div>}

      <aside 
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-brand-100 transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        aria-label="Sidebar navigation"
      >
        <div className="p-6 flex items-center justify-center border-b border-brand-50/50">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/30 mr-3">
            <DoveIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-slate-800 leading-none">Bible Chat</h1>
            <span className="text-[10px] font-medium text-brand-400 uppercase tracking-widest">Holy Bible Study</span>
          </div>
        </div>

        {/* Global Search Entry */}
        <div className="p-4 px-6">
            <div className="relative group">
                <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                <label htmlFor="sidebar-search" className="sr-only">Search your library</label>
                <input 
                  id="sidebar-search"
                  type="text" 
                  value={currentView === 'search' ? searchQuery : ''}
                  onChange={(e) => handleGlobalSearch(e.target.value)}
                  onFocus={() => { if (currentView !== 'search') setCurrentView('search'); }}
                  placeholder="Search your library..." 
                  className="w-full bg-slate-50 border-none rounded-xl pl-9 pr-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-brand-200 transition-all"
                />
            </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 pt-0 space-y-6" aria-label="Main navigation menu">
          <div className="space-y-1">
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2" id="main-nav-label">Main</p>
            <ul className="space-y-1" aria-labelledby="main-nav-label">
              <li>
                <button 
                  onClick={() => { setCurrentView('journey'); setIsSidebarOpen(false); }} 
                  aria-current={currentView === 'journey' ? 'page' : undefined}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-colors ${currentView === 'journey' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <MapIcon className="w-5 h-5" />
                  <span className="font-medium">Journey</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { setCurrentView('chat'); setActiveChatId(null); setIsSidebarOpen(false); }} 
                  aria-current={currentView === 'chat' && !activeChatId ? 'page' : undefined}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-colors ${currentView === 'chat' && !activeChatId ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <PlusIcon className="w-5 h-5" />
                  <span className="font-medium">New Study</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { setCurrentView('illustrator'); setIsSidebarOpen(false); }} 
                  aria-current={currentView === 'illustrator' ? 'page' : undefined}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-colors ${currentView === 'illustrator' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <ImageIcon className="w-5 h-5" />
                  <span className="font-medium">Illustrator</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { setCurrentView('prayer'); setIsSidebarOpen(false); }} 
                  aria-current={currentView === 'prayer' ? 'page' : undefined}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-colors ${currentView === 'prayer' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <HandsIcon className="w-5 h-5" />
                  <span className="font-medium">Prayer Wall</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { setCurrentView('favorites'); setIsSidebarOpen(false); }} 
                  aria-current={currentView === 'favorites' ? 'page' : undefined}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-colors ${currentView === 'favorites' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <BookmarkIcon className="w-5 h-5" />
                  <span className="font-medium">Favorites</span>
                </button>
              </li>
            </ul>
          </div>

          {recentChats.length > 0 && (
            <div className="space-y-1">
              <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2" id="recent-chats-label">Recent Chats</p>
              <ul className="max-h-64 overflow-y-auto space-y-1 scrollbar-hide" aria-labelledby="recent-chats-label">
                {recentChats.map(chat => (
                  <li key={chat.id}>
                    <button 
                      onClick={() => selectChat(chat.id)} 
                      aria-current={activeChatId === chat.id ? 'true' : undefined}
                      className={`w-full group flex items-center justify-between px-4 py-2.5 rounded-xl transition-all ${activeChatId === chat.id ? 'bg-brand-100 text-brand-800' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <MessageCircleIcon className="w-4 h-4 shrink-0 text-brand-300" />
                        <div className="flex flex-col text-left overflow-hidden">
                          <span className="text-sm font-medium truncate">{chat.title || 'Conversation'}</span>
                          <span className="text-[10px] text-slate-400 flex items-center"><ClockIcon className="w-2.5 h-2.5 mr-1" />{new Date(chat.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div 
                        onClick={(e) => deleteChat(e, chat.id)} 
                        role="button"
                        aria-label={`Delete conversation ${chat.title || 'Conversation'}`}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded-md transition-opacity"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1">
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2" id="topics-nav-label">Trending Topics</p>
            <ul className="space-y-1" aria-labelledby="topics-nav-label">
              {TOPICS.map((topic) => (
                <li key={topic.id}>
                  <button onClick={() => handleTopicClick(topic.prompt)} className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-brand-50 hover:text-brand-700 transition-all group">
                    <div className="text-slate-400 group-hover:text-brand-500 transition-colors">{topic.icon}</div>
                    <span className="font-medium text-sm">{topic.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-1">
           <button 
             onClick={() => { setCurrentView('accessibility'); setIsSidebarOpen(false); }} 
             aria-current={currentView === 'accessibility' ? 'page' : undefined}
             className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${currentView === 'accessibility' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
           >
             <AccessibilityIcon className="w-5 h-5" />
             <span className="font-medium">Accessibility</span>
           </button>
           <button 
             onClick={() => { setCurrentView('settings'); setIsSidebarOpen(false); }} 
             aria-current={currentView === 'settings' ? 'page' : undefined}
             className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${currentView === 'settings' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
           >
             <SettingsIcon className="w-5 h-5" />
             <span className="font-medium">Settings</span>
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full relative w-full" role="region" aria-label="Main content">
        <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-brand-100">
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="p-2 text-slate-600 rounded-lg hover:bg-slate-50"
            aria-label="Open sidebar menu"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
          <span className="font-display font-semibold text-lg text-slate-800">Bible Chat</span>
          <button 
            onClick={() => setCurrentView('search')}
            className="p-2 text-slate-600 rounded-lg hover:bg-slate-50"
            aria-label="Open search"
          >
            <SearchIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 overflow-hidden relative bg-slate-50">
          <div className="relative z-10 h-full flex flex-col max-w-5xl mx-auto w-full">
             <div className="flex-1 h-full overflow-hidden">
               {currentView === 'journey' && <Journey userId={effectiveUser.uid} onNavigateToChat={handleTopicClick} />}
               {currentView === 'chat' && <Chat userId={effectiveUser.uid} chatId={activeChatId} onChatCreated={setActiveChatId} initialPrompt={startPrompt} onClearInitialPrompt={() => setStartPrompt(undefined)} />}
               {currentView === 'illustrator' && <BibleIllustrator />}
               {currentView === 'prayer' && <PrayerWall userId={effectiveUser.uid} onPrayWithAI={handleTopicClick} />}
               {currentView === 'favorites' && <Favorites userId={effectiveUser.uid} />}
               {currentView === 'zodiac' && <ZodiacDaily userId={effectiveUser.uid} />}
               {currentView === 'about' && <About />}
               {currentView === 'accessibility' && <AccessibilitySettings userId={effectiveUser.uid} />}
               {currentView === 'settings' && <ProfileSettings userId={effectiveUser.uid} userEmail={effectiveUser.email} onLogout={handleLogout} />}
               {currentView === 'search' && (
                 <GlobalSearch 
                    userId={effectiveUser.uid} 
                    initialQuery={searchQuery} 
                    onSelectChat={selectChat}
                    onNavigateToPrayer={() => setCurrentView('prayer')}
                    onNavigateToFavorites={() => setCurrentView('favorites')}
                    onAskLumen={handleTopicClick}
                 />
               )}
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;