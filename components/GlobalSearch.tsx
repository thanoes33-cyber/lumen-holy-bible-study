import React, { useState, useEffect, useMemo } from 'react';
import { ChatSession, Message, PrayerRequest, FavoriteVerse, Role } from '../types';
import { SearchIcon, MessageCircleIcon, HandsIcon, BookmarkIcon, XIcon, ArrowUpIcon, SparklesIcon, ChevronDownIcon } from './Icons';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';

interface GlobalSearchProps {
  userId: string;
  initialQuery: string;
  onSelectChat: (id: string) => void;
  onNavigateToPrayer: () => void;
  onNavigateToFavorites: () => void;
  onAskLumen: (prompt: string) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ 
  userId, 
  initialQuery, 
  onSelectChat, 
  onNavigateToPrayer, 
  onNavigateToFavorites,
  onAskLumen
}) => {
  const [queryText, setQueryText] = useState(initialQuery);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [favorites, setFavorites] = useState<FavoriteVerse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setQueryText(initialQuery);
  }, [initialQuery]);

  // Load All Data for Searching
  useEffect(() => {
    if (!userId) return;

    if (userId === 'guest-dev-user') {
      const savedChats = localStorage.getItem('lumen_chats');
      const savedPrayers = localStorage.getItem('lumen_prayers');
      const savedFavs = localStorage.getItem('lumen_favorites');
      
      if (savedChats) setChats(JSON.parse(savedChats));
      if (savedPrayers) setPrayers(JSON.parse(savedPrayers));
      if (savedFavs) setFavorites(JSON.parse(savedFavs));
      setIsLoading(false);
      return;
    }

    if (!db) {
      setIsLoading(false);
      return;
    }

    const unsubChats = onSnapshot(collection(db, 'users', userId, 'chats'), (snap) => {
        setChats(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatSession)));
    });
    const unsubPrayers = onSnapshot(collection(db, 'users', userId, 'prayers'), (snap) => {
        setPrayers(snap.docs.map(d => ({ id: d.id, ...d.data() } as PrayerRequest)));
    });
    const unsubFavs = onSnapshot(collection(db, 'users', userId, 'favorites'), (snap) => {
        setFavorites(snap.docs.map(d => ({ id: d.id, ...d.data() } as FavoriteVerse)));
    });

    setIsLoading(false);
    return () => { unsubChats(); unsubPrayers(); unsubFavs(); };
  }, [userId]);

  const filteredResults = useMemo(() => {
    const s = queryText.toLowerCase().trim();
    if (!s) return { chats: [], prayers: [], favorites: [] };

    return {
      chats: chats.filter(c => 
        c.title?.toLowerCase().includes(s) || 
        c.messages.some(m => m.text.toLowerCase().includes(s))
      ),
      prayers: prayers.filter(p => 
        p.title.toLowerCase().includes(s) || 
        p.content.toLowerCase().includes(s) || 
        p.description?.toLowerCase().includes(s)
      ),
      favorites: favorites.filter(f => 
        f.text.toLowerCase().includes(s) || 
        f.reference.toLowerCase().includes(s)
      )
    };
  }, [queryText, chats, prayers, favorites]);

  const totalResults = filteredResults.chats.length + filteredResults.prayers.length + filteredResults.favorites.length;

  return (
    <div className="flex flex-col h-full bg-slate-50" role="main" aria-label="Global Search">
      <div className="shrink-0 p-6 bg-white border-b border-brand-100 shadow-sm">
        <div className="max-w-2xl mx-auto">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-brand-400 group-focus-within:text-brand-600 transition-colors">
              <SearchIcon className="h-5 w-5" />
            </div>
            <label htmlFor="global-search-input" className="sr-only">Search all app content</label>
            <input
              id="global-search-input"
              autoFocus
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search conversations, prayers, or verses..."
              className="block w-full pl-12 pr-12 py-4 bg-slate-50 border-none rounded-2xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-brand-200 transition-all text-lg font-medium"
            />
            {queryText && (
              <button 
                onClick={() => setQueryText('')} 
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <XIcon className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between px-1" aria-live="polite">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
               {queryText ? `${totalResults} Results Found` : 'Search History'}
             </span>
             {queryText && (
               <button 
                onClick={() => onAskLumen(queryText)}
                className="text-xs font-bold text-brand-600 flex items-center hover:text-brand-800 transition-colors"
               >
                 <SparklesIcon className="w-3.5 h-3.5 mr-1" />
                 Ask Lumen about "{queryText}"
               </button>
             )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-8">
          
          {!queryText && !isLoading && (
            <div className="text-center py-20 animate-in fade-in duration-500">
               <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
                 <SearchIcon className="w-10 h-10 text-brand-200" />
               </div>
               <h2 className="text-xl font-display font-semibold text-slate-800 mb-2">Search your spiritual library</h2>
               <p className="text-slate-500 max-w-sm mx-auto">Find verses you've saved, prayers you've written, or answers Lumen has provided in the past.</p>
            </div>
          )}

          {/* Chat Results */}
          {filteredResults.chats.length > 0 && (
            <section aria-labelledby="chats-search-header">
              <h3 id="chats-search-header" className="text-xs font-black text-brand-400 uppercase tracking-[0.2em] mb-4 flex items-center">
                <MessageCircleIcon className="w-4 h-4 mr-2" />
                Study Conversations
              </h3>
              <div className="space-y-3">
                {filteredResults.chats.map(chat => (
                  <button 
                    key={chat.id} 
                    onClick={() => onSelectChat(chat.id)}
                    className="w-full bg-white p-4 rounded-2xl border border-brand-50 shadow-sm hover:shadow-md hover:border-brand-100 transition-all text-left flex items-start group"
                  >
                    <div className="shrink-0 p-2.5 rounded-xl bg-brand-50 text-brand-500 mr-4 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                      <MessageCircleIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="font-bold text-slate-800 truncate mb-1">{chat.title}</div>
                      <p className="text-sm text-slate-500 truncate">{chat.lastMessage}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Prayer Results */}
          {filteredResults.prayers.length > 0 && (
            <section aria-labelledby="prayers-search-header">
              <h3 id="prayers-search-header" className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] mb-4 flex items-center">
                <HandsIcon className="w-4 h-4 mr-2" />
                Prayer Requests
              </h3>
              <div className="space-y-3">
                {filteredResults.prayers.map(prayer => (
                  <button 
                    key={prayer.id} 
                    onClick={onNavigateToPrayer}
                    className="w-full bg-white p-4 rounded-2xl border border-brand-50 shadow-sm hover:shadow-md hover:border-brand-100 transition-all text-left flex items-start group"
                  >
                    <div className="shrink-0 p-2.5 rounded-xl bg-orange-50 text-orange-500 mr-4 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                      <HandsIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="font-bold text-slate-800 truncate mb-1">{prayer.title}</div>
                      <p className="text-sm text-slate-500 line-clamp-2">{prayer.content}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Favorite Results */}
          {filteredResults.favorites.length > 0 && (
            <section aria-labelledby="favorites-search-header">
              <h3 id="favorites-search-header" className="text-xs font-black text-pink-400 uppercase tracking-[0.2em] mb-4 flex items-center">
                <BookmarkIcon className="w-4 h-4 mr-2" />
                Saved Verses
              </h3>
              <div className="space-y-3">
                {filteredResults.favorites.map(verse => (
                  <button 
                    key={verse.id} 
                    onClick={onNavigateToFavorites}
                    className="w-full bg-white p-4 rounded-2xl border border-brand-50 shadow-sm hover:shadow-md hover:border-brand-100 transition-all text-left flex items-start group"
                  >
                    <div className="shrink-0 p-2.5 rounded-xl bg-pink-50 text-pink-500 mr-4 group-hover:bg-pink-500 group-hover:text-white transition-colors">
                      <BookmarkIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="font-bold text-slate-800 truncate mb-1">{verse.reference}</div>
                      <p className="text-sm text-slate-500 italic line-clamp-2">"{verse.text}"</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {queryText && totalResults === 0 && !isLoading && (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-brand-100 p-8">
               <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                 <XIcon className="w-8 h-8 text-slate-300" />
               </div>
               <h3 className="text-lg font-semibold text-slate-700 mb-2">No results in your library</h3>
               <p className="text-sm text-slate-500 mb-8">We couldn't find anything matching your search locally. Would you like to ask Lumen about this instead?</p>
               <button 
                  onClick={() => onAskLumen(queryText)}
                  className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold flex items-center justify-center mx-auto shadow-lg hover:bg-brand-700 transition-all"
               >
                 <SparklesIcon className="w-5 h-5 mr-2 text-gold-300" />
                 Start AI Bible Study for "{queryText}"
               </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};