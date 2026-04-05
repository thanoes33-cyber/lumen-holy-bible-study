import React, { useState, useRef, useEffect } from 'react';
import { generateBibleImage, editBibleImage } from '../services/geminiService';
import { ImageIcon, SparklesIcon, XIcon, ArrowDownIcon, UploadIcon, WandIcon, EditIcon, PlusIcon, SettingsIcon, InfoIcon, ClockIcon } from './Icons';

type Mode = 'create' | 'edit';
type ImageSize = '1K' | '2K' | '4K';

const MAX_DAILY_IMAGES = 10;

export const BibleIllustrator: React.FC = () => {
  const [mode, setMode] = useState<Mode>('create');
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [dailyCount, setDailyCount] = useState<number>(0);
  
  // Edit Mode State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Daily Limit Logic
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem('lumen_daily_image_limit');
    if (stored) {
      const { date, count } = JSON.parse(stored);
      if (date === today) {
        setDailyCount(count);
      } else {
        localStorage.setItem('lumen_daily_image_limit', JSON.stringify({ date: today, count: 0 }));
        setDailyCount(0);
      }
    } else {
      localStorage.setItem('lumen_daily_image_limit', JSON.stringify({ date: today, count: 0 }));
    }
  }, []);

  const incrementLimit = () => {
    const today = new Date().toISOString().split('T')[0];
    const newCount = dailyCount + 1;
    setDailyCount(newCount);
    localStorage.setItem('lumen_daily_image_limit', JSON.stringify({ date: today, count: newCount }));
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    if (dailyCount >= MAX_DAILY_IMAGES) {
      setError(`You've reached your limit of ${MAX_DAILY_IMAGES} images for today. Come back tomorrow!`);
      return;
    }

    // Validation for Edit mode
    if (mode === 'edit' && !selectedImage) {
        setError("Please upload an image to edit first.");
        return;
    }

    // API Key Selection for Paid Model (Gemini Pro Image) - Only if 2K/4K
    if (imageSize !== '1K') {
      try {
          if ((window as any).aistudio) {
              const hasKey = await (window as any).aistudio.hasSelectedApiKey();
              if (!hasKey) {
                  await (window as any).aistudio.openSelectKey();
              }
          }
      } catch (e) {
          console.warn("API Key check skipped or failed", e);
      }
    }

    setLoading(true);
    setError(null);
    setImageUrl(null);

    try {
      let result = null;
      
      if (mode === 'create') {
          result = await generateBibleImage(prompt, imageSize);
      } else {
          // Edit Mode
          if (selectedImage) {
             result = await editBibleImage(selectedImage, prompt, imageSize);
          }
      }

      if (result) {
        setImageUrl(result);
        incrementLimit();
      } else {
        setError("Could not generate image. Please try again.");
      }
    } catch (e) {
      console.error(e);
      setError("An error occurred while creating the image. Try a simpler prompt.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
          setError("Image size too large. Please use an image under 5MB.");
          return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
            setSelectedImage(event.target.result as string);
            setError(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditResult = () => {
    if (imageUrl) {
        setSelectedImage(imageUrl);
        setImageUrl(null);
        setPrompt('');
        setMode('edit');
    }
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 bg-white/80 backdrop-blur-md border-b border-brand-100 flex items-center justify-between z-10 sticky top-0">
        <span className="text-brand-800 font-display font-semibold tracking-wide text-lg">Bible Illustrator</span>
        <div className="flex items-center space-x-2 bg-brand-50 px-3 py-1 rounded-full border border-brand-100">
           <ImageIcon className="w-3.5 h-3.5 text-brand-500" />
           <span className="text-xs font-bold text-brand-700">{MAX_DAILY_IMAGES - dailyCount} Remaining Today</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full px-6 py-8 pb-24">
        
        {/* Daily Limit Warning */}
        {dailyCount >= MAX_DAILY_IMAGES && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start space-x-3 text-orange-800 animate-in fade-in slide-in-from-top-2">
             <InfoIcon className="w-5 h-5 shrink-0 mt-0.5" />
             <div className="text-sm">
                <p className="font-bold">Daily limit reached</p>
                <p className="opacity-80">You've created {MAX_DAILY_IMAGES} images today. Please come back tomorrow for more spiritual illustrations!</p>
             </div>
          </div>
        )}

        {/* Mode Switcher */}
        <div className="flex p-1 bg-white rounded-xl border border-brand-100 shadow-sm mb-6 max-w-sm mx-auto">
            <button 
                onClick={() => { setMode('create'); setError(null); }}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'create' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <SparklesIcon className="w-4 h-4" />
                <span>Create New</span>
            </button>
            <button 
                onClick={() => { setMode('edit'); setError(null); }}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'edit' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <WandIcon className="w-4 h-4" />
                <span>Edit Image</span>
            </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-brand-100 mb-8">
            <div className="flex flex-wrap items-start justify-between mb-4 gap-4">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        {mode === 'create' ? <ImageIcon className="w-6 h-6" /> : <WandIcon className="w-6 h-6" />}
                    </div>
                    <div>
                        <h2 className="text-xl font-display font-bold text-slate-800">
                            {mode === 'create' ? "Bring Scripture to Life" : "Nano AI Image Editor"}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {mode === 'create' 
                                ? "Describe a biblical scene or enter a verse." 
                                : "Powerful edits powered by Gemini 2.5 Flash Image."}
                        </p>
                    </div>
                </div>

                {/* Size Selector */}
                <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                   {['1K', '2K', '4K'].map((size) => (
                      <button
                        key={size}
                        onClick={() => setImageSize(size as ImageSize)}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${imageSize === size ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {size}
                      </button>
                   ))}
                </div>
            </div>
            
            {/* Edit Mode: Image Upload Area */}
            {mode === 'edit' && (
                <div className="mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    {!selectedImage ? (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-brand-200 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-brand-50/50 transition-colors group"
                        >
                            <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform text-brand-500">
                                <UploadIcon className="w-6 h-6" />
                            </div>
                            <p className="text-sm font-semibold text-brand-700">Click to upload an image</p>
                            <p className="text-xs text-slate-400 mt-1">Supports JPG, PNG (Max 5MB)</p>
                        </div>
                    ) : (
                        <div className="relative rounded-xl overflow-hidden bg-slate-100 border border-brand-100 group">
                            <img src={selectedImage} alt="Preview" className="w-full h-48 object-contain bg-slate-800/5" />
                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                               <span className="bg-white/90 px-3 py-1 rounded-full text-[10px] font-bold text-brand-700">Ready to Edit</span>
                            </div>
                            <button 
                                onClick={clearSelectedImage}
                                className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors pointer-events-auto"
                            >
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageUpload} 
                        accept="image/*" 
                        className="hidden" 
                    />
                </div>
            )}

            <div className="relative">
                <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={mode === 'create' 
                        ? "E.g., David facing Goliath in the valley, cinematic lighting..." 
                        : "Try: 'Add a retro filter', 'Make it look like a sketch', or 'Add a glowing cross'"}
                    rows={3}
                    className="w-full p-4 rounded-xl border border-brand-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none bg-slate-50 resize-none text-slate-800 placeholder-slate-400"
                />
                <button 
                    onClick={handleGenerate}
                    disabled={loading || !prompt.trim() || (mode === 'edit' && !selectedImage) || dailyCount >= MAX_DAILY_IMAGES}
                    className="absolute bottom-3 right-3 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-all shadow-md active:scale-95"
                >
                    {loading ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            <span>{mode === 'create' ? "Creating..." : "Editing..."}</span>
                        </>
                    ) : (
                        <>
                            {mode === 'create' ? <SparklesIcon className="w-4 h-4 text-yellow-300" /> : <WandIcon className="w-4 h-4 text-white" />}
                            <span>{mode === 'create' ? "Generate Art" : "Apply Edits"}</span>
                        </>
                    )}
                </button>
            </div>
            {error && <p className="mt-3 text-sm text-red-500 flex items-center"><XIcon className="w-4 h-4 mr-1" /> {error}</p>}
        </div>

        {/* Display Area */}
        {imageUrl ? (
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-brand-100 animate-in fade-in zoom-in duration-500">
                <div className="relative aspect-square md:aspect-video rounded-xl overflow-hidden bg-slate-100 border border-brand-50">
                    <img src={imageUrl} alt="Generated biblical illustration" className="w-full h-full object-cover" />
                </div>
                <div className="mt-4 flex flex-wrap justify-between items-center gap-3">
                    <div className="flex flex-col">
                        <p className="text-sm text-slate-500 italic truncate max-w-[200px] md:max-w-xs">"{prompt}"</p>
                        <span className="text-[10px] text-brand-400 font-bold uppercase tracking-widest">
                          {imageSize === '1K' ? 'Gemini 2.5 Flash Image' : `Gemini 3 Pro Image (${imageSize})`}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={handleEditResult}
                            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-sm font-medium transition-colors border border-brand-100"
                        >
                            <EditIcon className="w-4 h-4" />
                            <span>Edit This</span>
                        </button>
                        <a 
                            href={imageUrl} 
                            download={`lumen-illustration-${Date.now()}.png`}
                            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors border border-slate-200"
                        >
                            <ArrowDownIcon className="w-4 h-4" />
                            <span>Download</span>
                        </a>
                    </div>
                </div>
            </div>
        ) : (
            !loading && (
                <div className="text-center py-12 bg-white/40 border-2 border-dashed border-brand-100 rounded-3xl">
                    <ImageIcon className="w-16 h-16 mx-auto text-brand-200 mb-4" />
                    <p className="text-slate-500 font-medium">Your generated artwork will appear here.</p>
                    <p className="text-xs text-slate-400 mt-2 italic">Standard quality generations use Gemini 2.5 Flash Image.</p>
                </div>
            )
        )}
        
        {loading && !imageUrl && (
            <div className="text-center py-20 animate-in fade-in duration-300">
                <div className="inline-block relative w-20 h-20">
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-100 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                </div>
                <p className="mt-4 text-indigo-600 font-medium animate-pulse">
                  {mode === 'create' ? "Painting your vision..." : "Applying your edits with Nano AI..."}
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  {imageSize === '1K' ? 'Using Gemini 2.5 Flash Image' : `Using Gemini 3 Pro Image (${imageSize})`}
                </p>
            </div>
        )}
      </div>
    </div>
  );
};