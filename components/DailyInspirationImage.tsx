import React, { useState, useEffect } from 'react';
import { generateDailyInspirationImage } from '../services/geminiService';
import { SparklesIcon, ImageIcon } from './Icons';

export const DailyInspirationImage: React.FC = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDailyImage = async () => {
      const today = new Date().toISOString().split('T')[0];
      const stored = localStorage.getItem('lumen_daily_inspiration_image');
      
      if (stored) {
        try {
          const { date, data } = JSON.parse(stored);
          if (date === today && data) {
            setImageUrl(data);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error("Error parsing stored daily image", e);
        }
      }

      // Generate new if missing or date mismatch
      setLoading(true);
      const newImage = await generateDailyInspirationImage();
      if (newImage) {
        setImageUrl(newImage);
        localStorage.setItem('lumen_daily_inspiration_image', JSON.stringify({ date: today, data: newImage }));
      }
      setLoading(false);
    };

    loadDailyImage();
  }, []);

  if (loading) {
    return (
      <div className="w-full aspect-video rounded-3xl bg-slate-200 animate-pulse flex items-center justify-center overflow-hidden border border-brand-100">
        <div className="flex flex-col items-center space-y-2">
            <ImageIcon className="w-10 h-10 text-slate-300" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Generating Inspiration...</span>
        </div>
      </div>
    );
  }

  if (!imageUrl) return null;

  return (
    <div className="relative w-full aspect-video rounded-3xl overflow-hidden shadow-2xl shadow-brand-200/50 group border border-brand-100 animate-in fade-in duration-1000">
      <img 
        src={imageUrl} 
        alt="Daily Spiritual Inspiration" 
        className="w-full h-full object-cover transform transition-transform duration-[10s] ease-linear group-hover:scale-110" 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-6 md:p-8">
        <div className="flex items-center space-x-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-brand-500/80 backdrop-blur-md flex items-center justify-center text-white shadow-lg">
                <SparklesIcon className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-black text-white/90 uppercase tracking-[0.2em] drop-shadow-md">Daily Focus</span>
        </div>
        <h2 className="text-xl md:text-2xl font-display font-bold text-white drop-shadow-lg leading-tight">
            Rise with purpose. Walk with faith.
        </h2>
      </div>
      <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/30">
          <span className="text-[9px] font-bold text-white uppercase tracking-wider">AI Generated Art</span>
      </div>
    </div>
  );
};