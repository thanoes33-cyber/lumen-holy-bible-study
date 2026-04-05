import React, { useState, useEffect, useMemo, useRef } from 'react';
// Added StopIcon and FireIcon to the imports from Icons
import { AccessibilityIcon, SunIcon, CheckIcon, XIcon, EyeIcon, PlayIcon, SpeakerIcon, StopIcon, FireIcon } from './Icons';
import { db } from '../services/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { generateTTS, GeminiVoiceName } from '../services/geminiService';

interface AccessibilitySettingsProps {
  userId: string;
}

interface Personality {
  id: GeminiVoiceName;
  name: string;
  description: string;
  gender: 'male' | 'female';
}

const PERSONALITIES: Personality[] = [
  { id: 'Zephyr', name: 'Zephyr', description: 'Warm & Encouraging', gender: 'female' },
  { id: 'Kore', name: 'Kore', description: 'Wise & Gentle', gender: 'female' },
  { id: 'Puck', name: 'Puck', description: 'Firm & Steady', gender: 'male' },
  { id: 'Charon', name: 'Charon', description: 'Deep & Reflective', gender: 'male' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Strong & Resonant', gender: 'male' },
];

export const AccessibilitySettings: React.FC<AccessibilitySettingsProps> = ({ userId }) => {
  const [settings, setSettings] = useState({
    textSize: 16,
    highContrast: false,
    reducedMotion: false,
    voiceURI: 'Zephyr' as GeminiVoiceName,
    useLiteModel: false,
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState<GeminiVoiceName | null>(null);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.textSize}px`;
    if (settings.highContrast) document.body.classList.add('high-contrast');
    else document.body.classList.remove('high-contrast');
    if (settings.reducedMotion) document.body.classList.add('reduced-motion');
    else document.body.classList.remove('reduced-motion');
  }, [settings]);

  useEffect(() => {
    if (!userId) return;
    const fetchSettings = async () => {
      try {
        let data: any = null;
        if (userId === 'guest-dev-user') {
          const saved = localStorage.getItem('lumen_user_profile');
          if (saved) data = JSON.parse(saved);
        } else if (db) {
          const docRef = doc(db, 'users', userId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) data = docSnap.data();
        }
        if (data) {
          setSettings(prev => ({
            textSize: data.textSize || 16,
            highContrast: data.highContrast || false,
            reducedMotion: data.reducedMotion || false,
            voiceURI: (data.voiceURI as GeminiVoiceName) || 'Zephyr',
            useLiteModel: data.useLiteModel || false,
          }));
        }
      } catch (e) { console.error(e); }
    };
    fetchSettings();
  }, [userId]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      if (userId === 'guest-dev-user') {
        const local = localStorage.getItem('lumen_user_profile');
        const profile = local ? JSON.parse(local) : {};
        localStorage.setItem('lumen_user_profile', JSON.stringify({ ...profile, ...settings }));
        setMessage({ type: 'success', text: 'Settings updated locally.' });
      } else {
        await setDoc(doc(db, 'users', userId), settings, { merge: true });
        setMessage({ type: 'success', text: 'Accessibility settings saved.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save settings.' });
    } finally { setIsSaving(false); }
  };

  const handlePreviewVoice = async (voice: GeminiVoiceName) => {
    if (isPreviewing) {
        if (sourceNodeRef.current) sourceNodeRef.current.stop();
        setIsPreviewing(null);
        return;
    }

    setIsPreviewing(voice);
    try {
        const buffer = await generateTTS("Hello! I am your spiritual companion, Lumen.", voice);
        if (buffer) {
            if (!audioContextRef.current) audioContextRef.current = new AudioContext();
            const source = audioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => setIsPreviewing(null);
            source.start();
            sourceNodeRef.current = source;
        } else {
            setIsPreviewing(null);
        }
    } catch (e) {
        console.error(e);
        setIsPreviewing(null);
    }
  };

  useEffect(() => {
    return () => {
        if (sourceNodeRef.current) sourceNodeRef.current.stop();
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-y-auto">
      <div className="shrink-0 px-6 py-4 bg-white/80 backdrop-blur-md border-b border-brand-100 flex items-center justify-between z-10 sticky top-0">
        <span className="text-brand-800 font-display font-semibold tracking-wide text-lg">Accessibility & Performance</span>
      </div>

      <div className="max-w-2xl mx-auto w-full px-6 py-8 pb-20">
        {message && (
          <div role="alert" className={`mb-6 p-4 rounded-xl border text-sm font-medium flex items-center ${message.type === 'success' ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
            {message.type === 'success' ? <CheckIcon className="w-5 h-5 mr-2" /> : <XIcon className="w-5 h-5 mr-2" />}
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-brand-100 space-y-8">
          
          {/* Performance Section */}
          <div className="border-b border-slate-50 pb-6">
            <div className="flex items-center text-slate-800 font-display font-semibold border-b border-slate-50 pb-2 mb-4">
              <FireIcon className="w-5 h-5 mr-2 text-gold-500" />
              Performance Mode
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3 pr-4">
                <div className="p-2 bg-gold-50 rounded-lg text-gold-600"><FireIcon className="w-5 h-5" /></div>
                <div>
                  <h4 className="font-semibold text-slate-800">Lightning Responses</h4>
                  <p className="text-xs text-slate-500">Enable Gemini 2.5 Flash Lite for near-instant AI feedback. Best for quick questions.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input type="checkbox" className="sr-only peer" checked={settings.useLiteModel} onChange={(e) => setSettings(s => ({...s, useLiteModel: e.target.checked}))} />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer-checked:bg-gold-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
          </div>

          <div className="flex items-center text-slate-800 font-display font-semibold border-b border-slate-50 pb-2 mb-4">
            <AccessibilityIcon className="w-5 h-5 mr-2 text-brand-500" />
            Display Settings
          </div>
          
          <div>
            <label htmlFor="textSize" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Text Size</label>
            <input 
              id="textSize" type="range" min="14" max="24" step="1"
              value={settings.textSize}
              onChange={(e) => setSettings(s => ({...s, textSize: parseInt(e.target.value)}))}
              className="w-full accent-brand-600 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
              <span>Small (14px)</span>
              <span>Default (16px)</span>
              <span>Large (24px)</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><EyeIcon className="w-5 h-5" /></div>
              <div>
                <h4 className="font-semibold text-slate-800">High Contrast Mode</h4>
                <p className="text-xs text-slate-500">Increase contrast for better legibility.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={settings.highContrast} onChange={(e) => setSettings(s => ({...s, highContrast: e.target.checked}))} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          <div className="border-t border-slate-100 pt-8">
            <div className="flex items-center text-slate-800 font-display font-semibold border-b border-slate-50 pb-2 mb-4">
              <SpeakerIcon className="w-5 h-5 mr-2 text-brand-500" />
              Gemini AI Voices
            </div>
            
            <div className="space-y-3">
              {PERSONALITIES.map(person => {
                const isActive = settings.voiceURI === person.id;
                
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => setSettings(s => ({...s, voiceURI: person.id}))}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${isActive ? 'bg-brand-50 border-brand-300 ring-2 ring-brand-100' : 'bg-white border-slate-100 hover:border-brand-200'}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {person.gender === 'male' ? (
                          <span className="font-bold text-lg">M</span>
                        ) : (
                          <span className="font-bold text-lg">F</span>
                        )}
                      </div>
                      <div className="text-left">
                        <h4 className={`font-bold ${isActive ? 'text-brand-800' : 'text-slate-700'}`}>{person.name}</h4>
                        <p className="text-xs text-slate-500">{person.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handlePreviewVoice(person.id); }}
                            disabled={isPreviewing !== null && isPreviewing !== person.id}
                            className={`p-2 rounded-lg transition-colors ${isPreviewing === person.id ? 'bg-red-500 text-white animate-pulse' : 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50'}`}
                        >
                            {isPreviewing === person.id ? <StopIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                        </button>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-4 text-center">These studio-quality voices are powered by Gemini AI.</p>
          </div>

          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3.5 rounded-xl font-semibold shadow-md transition-all bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-70 mt-6"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};