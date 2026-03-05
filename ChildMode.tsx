import React, { useState, useRef, useEffect } from 'react';
import { Search, Video, Image as ImageIcon, MessageSquare, Shield, Lock, EyeOff, AlertTriangle, Eye, Activity, ChevronDown, ChevronUp, Info, X, Play, Volume2, Baby, Filter, UserX, CameraOff, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeText, analyzeImage, searchSafeVideos, VideoResult } from '../services/gemini';
import { Settings, ContentItem } from '../types';

interface ChildModeProps {
  settings: Settings;
  onAlert: (msg: string) => void;
  onActivate?: () => void;
  faceDetected?: boolean;
  isParentMode?: boolean;
  isForced?: boolean;
}

export default function ChildMode({ settings, onAlert, onActivate, faceDetected = true, isParentMode = false, isForced = false }: ChildModeProps) {
  const [input, setInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [isLiveProtectionActive, setIsLiveProtectionActive] = useState(true);
  const [isAutoDiscoveryActive, setIsAutoDiscoveryActive] = useState(false); // Default to false for "touch on only" feel
  const [isScrollMode, setIsScrollMode] = useState(false);
  const [isKidsSafeMode, setIsKidsSafeMode] = useState(true);
  const [isActivated, setIsActivated] = useState(isForced); // If forced, it's already activated
  const [showInfoIdx, setShowInfoIdx] = useState<number | null>(null);
  const [ageVerificationIdx, setAgeVerificationIdx] = useState<number | null>(null);
  const [currentlyViewingIdx, setCurrentlyViewingIdx] = useState<number | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [videoResults, setVideoResults] = useState<VideoResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [canLoadMore, setCanLoadMore] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<{url: string, title: string} | null>(null);
  const autoDiscoveryInterval = useRef<NodeJS.Timeout | null>(null);

  // Simulated content for Auto-Discovery
  const simulatedContent = [
    { type: 'image', data: 'https://picsum.photos/seed/nature1/800/600', label: 'Nature Photo', category: 'Science', ageRating: 5 },
    { type: 'image', data: 'https://picsum.photos/seed/horror1/800/600?grayscale', label: 'Dark Image', category: 'Entertainment', ageRating: 15 },
    { type: 'text', data: 'Check out this cool new game!', label: 'Chat Message', category: 'Games', ageRating: 8 },
    { type: 'text', data: 'You are so stupid and ugly', label: 'Mean Comment', category: 'General', ageRating: 12 },
    { type: 'image', data: 'https://picsum.photos/seed/weapon1/800/600?blur=10', label: 'Blurred Object', category: 'General', ageRating: 18 },
    { type: 'video', data: 'https://www.w3schools.com/html/mov_bbb.mp4', label: 'Big Buck Bunny', category: 'Entertainment', ageRating: 3 },
    { type: 'video', data: 'https://www.w3schools.com/html/movie.mp4', label: 'Bear Video', category: 'Science', ageRating: 6 },
  ];

  useEffect(() => {
    if (isAutoDiscoveryActive) {
      autoDiscoveryInterval.current = setInterval(() => {
        const randomItem = simulatedContent[Math.floor(Math.random() * simulatedContent.length)];
        if (randomItem.type === 'text') {
          processAutoText(randomItem.data, randomItem.category, randomItem.ageRating);
        } else if (randomItem.type === 'video') {
           // For video simulation, just add it
           const newContent: ContentItem = {
             id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
             type: 'video' as const,
             data: randomItem.data,
             isBlocked: false,
             category: randomItem.category,
             reason: '',
             ageRating: randomItem.ageRating,
             isKidsSafe: randomItem.ageRating <= settings.age_limit
           };
           setContent(prev => [newContent, ...prev.slice(0, 9)]);
           setCurrentlyViewingIdx(0);
        } else {
          processAutoImage(randomItem.data, randomItem.category, randomItem.ageRating);
        }
        setCurrentlyViewingIdx(0);
      }, 8000);
    } else {
      if (autoDiscoveryInterval.current) clearInterval(autoDiscoveryInterval.current);
    }
    return () => {
      if (autoDiscoveryInterval.current) clearInterval(autoDiscoveryInterval.current);
    };
  }, [isAutoDiscoveryActive, settings.sensitivity]);

  const processAutoText = async (text: string, category?: string, ageRating?: number) => {
    const result = await analyzeText(text, settings.sensitivity);
    const newContent: ContentItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'text' as const,
      data: text,
      isBlocked: result.isHarmful,
      category: category || result.category,
      reason: result.reason,
      ageRating: ageRating || (result.isHarmful ? 18 : 3),
      isKidsSafe: (ageRating || (result.isHarmful ? 18 : 3)) <= settings.age_limit
    };
    setContent(prev => [newContent, ...prev.slice(0, 9)]); // Keep last 10 items
    setCurrentlyViewingIdx(0);
    logToBackend('text', result, text);
  };

  const processAutoImage = async (url: string, category?: string, ageRating?: number) => {
    // For simulation, we'll just fetch the image and convert to base64 or pass URL if Gemini supports it
    // Actually, analyzeImage expects base64. Let's fetch it.
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const result = await analyzeImage(base64, settings.sensitivity);
        const newContent: ContentItem = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'image' as const,
          data: url, // Use URL for display
          isBlocked: result.isHarmful,
          category: category || result.category,
          reason: result.reason,
          ageRating: ageRating || (result.isHarmful ? 18 : 3),
          isKidsSafe: (ageRating || (result.isHarmful ? 18 : 3)) <= settings.age_limit
        };
        setContent(prev => [newContent, ...prev.slice(0, 9)]);
        setCurrentlyViewingIdx(0);
        logToBackend('image', result, 'Auto-Discovered Image');
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error("Auto-discovery image error:", e);
    }
  };

  const logToBackend = (type: string, result: any, contentStr: string) => {
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        category: result.category,
        severity: result.severity,
        content: contentStr,
        status: result.isHarmful ? 'blocked' : 'allowed'
      })
    });
    if (result.isHarmful) {
      onAlert(`Auto-Guard: ${result.category} detected and blocked.`);
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleTextAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setAnalyzing(true);
    const result = await analyzeText(input, settings.sensitivity);
    
    const newContent: ContentItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'text' as const,
      data: input,
      isBlocked: result.isHarmful,
      category: result.category,
      reason: result.reason,
      ageRating: result.isHarmful ? 18 : 3,
      isKidsSafe: (result.isHarmful ? 18 : 3) <= settings.age_limit
    };

    setContent(prev => [newContent, ...prev]);
    setCurrentlyViewingIdx(0);
    setInput('');
    setAnalyzing(false);

    // Log to server
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'text',
        category: result.category,
        severity: result.severity,
        content: input,
        status: result.isHarmful ? 'blocked' : 'allowed'
      })
    });

    if (result.isHarmful) {
      onAlert(`Harmful content detected: ${result.category}`);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setAnalyzing(true);
      
      const result = await analyzeImage(base64, settings.sensitivity);
      
      const newContent: ContentItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'image' as const,
        data: base64,
        isBlocked: result.isHarmful,
        category: result.category,
        reason: result.reason,
        ageRating: result.isHarmful ? 18 : 3,
        isKidsSafe: (result.isHarmful ? 18 : 3) <= settings.age_limit
      };

      setContent(prev => [newContent, ...prev]);
      setCurrentlyViewingIdx(0);
      setAnalyzing(false);

      // Log to server
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'image',
          category: result.category,
          severity: result.severity,
          content: 'Image Upload',
          status: result.isHarmful ? 'blocked' : 'allowed'
        })
      });

      if (result.isHarmful) {
        onAlert(`Harmful image detected: ${result.category}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    const videoUrl = URL.createObjectURL(file);
    
    // Create a temporary video element to capture a frame
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.play();

    video.onloadeddata = async () => {
      // Seek to 1 second or start
      video.currentTime = Math.min(1, video.duration / 2);
    };

    video.onseeked = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const frameBase64 = canvas.toDataURL('image/jpeg');
      
      // Analyze the frame and the filename
      const [imageResult, textResult] = await Promise.all([
        analyzeImage(frameBase64, settings.sensitivity),
        analyzeText(file.name, settings.sensitivity)
      ]);

      const isHarmful = imageResult.isHarmful || textResult.isHarmful;
      const category = imageResult.isHarmful ? imageResult.category : textResult.category;
      const reason = imageResult.isHarmful ? imageResult.reason : textResult.reason;

      const newContent: ContentItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'video' as const,
        data: videoUrl,
        isBlocked: isHarmful,
        category: category,
        reason: reason,
        ageRating: isHarmful ? 18 : 3,
        isKidsSafe: (isHarmful ? 18 : 3) <= settings.age_limit
      };

      setContent(prev => [newContent, ...prev]);
      setCurrentlyViewingIdx(0);
      setAnalyzing(false);
      video.pause();

      // Log to server
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'video',
          category: category,
          severity: imageResult.severity || textResult.severity,
          content: `Video Upload: ${file.name}`,
          status: isHarmful ? 'blocked' : 'allowed'
        })
      });

      if (isHarmful) {
        onAlert(`Harmful video detected: ${category}`);
      }
    };
  };

  const handleVideoSearch = async (e?: React.FormEvent, isLoadMore = false, overrideQuery?: string, overrideCategory?: string) => {
    if (e) e.preventDefault();
    const categoryToUse = overrideCategory !== undefined ? overrideCategory : activeCategory;
    const queryToUse = overrideQuery || searchQuery;
    if (!queryToUse.trim() && categoryToUse === 'All') return;

    setIsSearching(true);
    if (!isLoadMore) {
      setHasSearched(true);
      setVideoResults([]);
      setSearchPage(1);
    }

    try {
      const searchQueryWithCategory = categoryToUse !== 'All' ? `${queryToUse} ${categoryToUse}` : queryToUse;
      const results = await searchSafeVideos(
        `${searchQueryWithCategory} (page ${isLoadMore ? searchPage + 1 : 1})`, 
        isParentMode,
        settings.allowed_categories
      );
      
      // Filter results for Child Mode
      const filteredResults = isParentMode ? results : results.filter(v => v.isSafe);

      if (isLoadMore) {
        setVideoResults(prev => [...prev, ...filteredResults]);
        setSearchPage(prev => prev + 1);
      } else {
        setVideoResults(filteredResults);
      }

      // If we got fewer than 24, we probably reached the end
      setCanLoadMore(results.length >= 24 && videoResults.length + filteredResults.length < 50);
      
      // If any result was filtered out, we log it
      results.forEach(v => {
        if (!v.isSafe && !isParentMode) {
          onAlert(`Blocked unsafe video result: ${v.title}`);
        }
      });
    } catch (error: any) {
      console.error("Search error:", error);
      const msg = error?.message?.toLowerCase() || "";
      if (msg.includes('429') || msg.includes('quota') || msg.includes('exhausted')) {
        onAlert("Video search is temporarily busy (Quota Exceeded). Please try again in a few minutes.");
      } else {
        onAlert("Unable to search videos right now. Please check your connection.");
      }
    } finally {
      setIsSearching(false);
    }
  };

  const filteredContent = content.filter(item => {
    const matchesSearch = searchQuery === '' || 
      (item.type === 'text' && item.data.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.category?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    
    // In Kids Mode, we strictly hide blocked content and only show safe content
    if (isKidsSafeMode) {
      if (item.isBlocked) return false;
      return matchesSearch && matchesCategory && (item.isKidsSafe || settings.allowed_categories.includes(item.category || ''));
    }
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className={`max-w-4xl mx-auto space-y-8 transition-all duration-500 ${isKidsSafeMode ? 'bg-white' : ''}`}>
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Activation Splash Screen */}
      <AnimatePresence>
        {!isActivated && !isParentMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[110] bg-indigo-600 flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-xl p-12 rounded-[4rem] border border-white/20 shadow-2xl max-w-lg w-full"
            >
              <div className="bg-white p-6 rounded-[2rem] w-24 h-24 flex items-center justify-center mx-auto mb-8 shadow-xl">
                <Baby className="w-12 h-12 text-indigo-600" />
              </div>
              <h2 className="text-4xl font-bold text-white mb-4 font-display">Ready for Safe Fun?</h2>
              <p className="text-indigo-100 text-lg mb-10 leading-relaxed">
                Touch the button below to activate Child Mode and start browsing safely with AI Guard.
              </p>
              
              <button
                onClick={() => {
                  setIsActivated(true);
                  if (onActivate) onActivate();
                }}
                className="w-full py-6 bg-white text-indigo-600 font-bold text-xl rounded-3xl hover:bg-indigo-50 transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-95"
              >
                <Shield className="w-6 h-6" />
                Activate Child Mode
              </button>
              
              <p className="mt-6 text-indigo-200 text-xs font-medium uppercase tracking-widest">
                AI Guard will monitor all content
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Player Modal */}
      <AnimatePresence>
        {playingVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 md:p-8"
          >
            <div className="w-full max-w-5xl flex flex-col h-full max-h-[90vh]">
              <div className="flex items-center justify-between mb-6 text-white">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-2 rounded-xl">
                    <Video className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold truncate pr-8 font-display">{playingVideo.title}</h3>
                </div>
                <button 
                  onClick={() => setPlayingVideo(null)}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all active:scale-95"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>
              
              <div className="flex-1 bg-black rounded-[3rem] overflow-hidden shadow-2xl relative group border-4 border-white/10">
                <video 
                  src={playingVideo.url} 
                  className="w-full h-full"
                  controls
                  autoPlay
                  playsInline
                />
              </div>
              
              <div className="mt-8 flex items-center justify-center gap-6">
                <div className="flex items-center gap-3 px-6 py-3 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400 uppercase tracking-widest">AI Verified Safe Content</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Age Verification Modal */}
      <AnimatePresence>
        {ageVerificationIdx !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Baby className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Age Verification</h3>
              <p className="text-slate-500 mb-8">This content is rated for ages {content[ageVerificationIdx]?.ageRating}+. Please ask a parent to verify.</p>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    // Simulate parent verification
                    const updatedContent = [...content];
                    updatedContent[ageVerificationIdx] = { ...updatedContent[ageVerificationIdx], isKidsSafe: true };
                    setContent(updatedContent);
                    setAgeVerificationIdx(null);
                  }}
                  className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Verify as Parent
                </button>
                <button
                  onClick={() => setAgeVerificationIdx(null)}
                  className="w-full py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Go Back
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {!faceDetected && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-2xl flex flex-col items-center justify-center text-center p-8"
          >
            <motion.div 
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="bg-gradient-to-br from-rose-400 to-rose-600 p-10 rounded-[4rem] text-white mb-10 shadow-2xl shadow-rose-500/40"
            >
              <UserX className="w-24 h-24" />
            </motion.div>
            <h2 className="text-5xl font-bold text-white mb-6 font-display">Where did you go?</h2>
            <p className="text-rose-100 max-w-md mx-auto text-xl leading-relaxed opacity-90">
              I can't see your face! Browsing is paused for your safety. 
              Please look at the camera so we can keep having fun!
            </p>
            <div className="mt-12 flex gap-4">
              <div className="w-3 h-3 bg-rose-500 rounded-full animate-bounce" />
              <div className="w-3 h-3 bg-rose-500 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-3 h-3 bg-rose-500 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simulation Header */}
      <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-4 right-8 flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/30">
            <Baby className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Child Mode Activated</span>
          </div>
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/30">
            <CameraOff className="w-4 h-4 text-rose-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Camera turned off for safety</span>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/30 backdrop-blur-md px-4 py-2 rounded-full border border-emerald-400/30">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Only kid-safe content available</span>
          </div>
        </div>
        <div className="relative z-10">
          <h3 className="text-3xl font-bold mb-2 flex items-center gap-3 font-display">
            <Shield className="w-10 h-10" />
            SafeGuard for Kids
          </h3>
          <p className="text-indigo-100 opacity-90 max-w-md text-lg">
            Have fun exploring! AI Guard is keeping everything safe for you.
          </p>
          
          <div className="mt-6 flex items-center gap-3">
            <div 
              onClick={() => setIsLiveProtectionActive(!isLiveProtectionActive)}
              className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-300 ${isLiveProtectionActive ? 'bg-emerald-400' : 'bg-white/20'}`}
            >
              <motion.div 
                animate={{ x: isLiveProtectionActive ? 24 : 4 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
              />
            </div>
            <span className="text-sm font-bold text-white">Live AI Protection {isLiveProtectionActive ? 'Active' : 'Paused'}</span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div 
              onClick={() => setIsAutoDiscoveryActive(!isAutoDiscoveryActive)}
              className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-300 ${isAutoDiscoveryActive ? 'bg-amber-400' : 'bg-white/20'}`}
            >
              <motion.div 
                animate={{ x: isAutoDiscoveryActive ? 24 : 4 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
              />
            </div>
            <span className="text-sm font-bold text-white">Auto-Discovery Mode {isAutoDiscoveryActive ? 'On' : 'Off'}</span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div 
              onClick={() => setIsScrollMode(!isScrollMode)}
              className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-300 ${isScrollMode ? 'bg-indigo-400' : 'bg-white/20'}`}
            >
              <motion.div 
                animate={{ x: isScrollMode ? 24 : 4 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
              />
            </div>
            <span className="text-sm font-bold text-white">Vertical Scroll Mode {isScrollMode ? 'On' : 'Off'}</span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div 
              onClick={() => setIsKidsSafeMode(!isKidsSafeMode)}
              className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-300 ${isKidsSafeMode ? 'bg-pink-400' : 'bg-white/20'}`}
            >
              <motion.div 
                animate={{ x: isKidsSafeMode ? 24 : 4 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
              />
            </div>
            <span className="text-sm font-bold text-white">Kids Safe Mode {isKidsSafeMode ? 'On' : 'Off'}</span>
          </div>
        </div>
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      </div>

      {/* Search and Filter */}
      <div className={`p-6 rounded-3xl shadow-sm border transition-all duration-500 ${isKidsSafeMode ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-100'}`}>
        <form onSubmit={handleVideoSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isKidsSafeMode ? 'text-yellow-600' : 'text-slate-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isKidsSafeMode ? "Search for fun videos!" : "Search content..."}
              className={`w-full pl-12 pr-4 py-4 rounded-2xl transition-all outline-none ${
                isKidsSafeMode 
                  ? 'bg-white border-2 border-yellow-200 focus:border-yellow-400 text-yellow-900 placeholder-yellow-300' 
                  : 'bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 text-slate-700'
              }`}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSearching}
              className={`px-8 py-4 rounded-2xl font-bold transition-all flex items-center gap-2 ${
                isKidsSafeMode 
                  ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500 shadow-lg shadow-yellow-100' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              } disabled:opacity-50`}
            >
              {isSearching ? <Activity className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              {isSearching ? 'Searching...' : 'Search'}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`p-4 rounded-2xl transition-colors ${isKidsSafeMode ? 'bg-white text-yellow-600 border-2 border-yellow-200 hover:bg-yellow-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Upload Image"
            >
              <ImageIcon className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className={`p-4 rounded-2xl transition-colors ${isKidsSafeMode ? 'bg-white text-yellow-600 border-2 border-yellow-200 hover:bg-yellow-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Upload Video"
            >
              <Video className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setVideoResults([]);
                setHasSearched(false);
              }}
              className={`p-4 rounded-2xl font-bold transition-all ${
                isKidsSafeMode ? 'bg-white border-2 border-yellow-200 text-yellow-600' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </form>
        
        {/* Quick Search Tags */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider self-center mr-2 ${isKidsSafeMode ? 'text-yellow-600' : 'text-slate-400'}`}>Quick Search:</span>
          {[
            { label: 'Education Shows', query: 'education show for kids' },
            { label: 'Science', query: 'science experiments for children' },
            { label: 'Animals', query: 'amazing animal facts for kids' },
            { label: 'Space', query: 'space and planets for kids' },
            { label: 'Art & Craft', query: 'easy art and craft for kids' }
          ].map((tag) => (
            <button
              key={tag.query}
              type="button"
              onClick={() => {
                setActiveCategory('All');
                setSearchQuery(tag.query);
                handleVideoSearch(undefined, false, tag.query, 'All');
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${
                isKidsSafeMode 
                  ? 'bg-yellow-100 border-yellow-200 text-yellow-700 hover:bg-yellow-200' 
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <div className="mt-6 flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <Filter className={`w-4 h-4 shrink-0 ${isKidsSafeMode ? 'text-yellow-600' : 'text-slate-400'}`} />
          {['All', ...settings.allowed_categories].map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                // If we have a query or if we just want to search by category
                handleVideoSearch(undefined, false, searchQuery || cat, cat);
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? (isKidsSafeMode ? 'bg-yellow-400 text-white shadow-md' : 'bg-indigo-600 text-white shadow-md')
                  : (isKidsSafeMode ? 'bg-white text-yellow-600 border border-yellow-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Video Search Results */}
      <AnimatePresence>
        {!hasSearched && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-12"
          >
            <div className="text-center mb-10">
              <h4 className={`text-2xl font-bold mb-3 ${isKidsSafeMode ? 'text-yellow-900' : 'text-slate-800'}`}>Explore Safe Content</h4>
              <p className="text-slate-500">Choose a topic to find educational and fun videos for kids!</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { label: 'Education Shows', icon: <Video className="w-6 h-6" />, color: 'bg-blue-100 text-blue-600', query: 'education show for kids' },
                { label: 'Science Fun', icon: <Activity className="w-6 h-6" />, color: 'bg-purple-100 text-purple-600', query: 'science experiments for kids' },
                { label: 'Animal World', icon: <Baby className="w-6 h-6" />, color: 'bg-emerald-100 text-emerald-600', query: 'animal facts for children' },
                { label: 'Space Discovery', icon: <Eye className="w-6 h-6" />, color: 'bg-indigo-100 text-indigo-600', query: 'planets and space for kids' },
                { label: 'Creative Arts', icon: <ImageIcon className="w-6 h-6" />, color: 'bg-rose-100 text-rose-600', query: 'easy drawing and crafts for kids' },
                { label: 'Story Time', icon: <MessageSquare className="w-6 h-6" />, color: 'bg-orange-100 text-orange-600', query: 'animated stories for kids' }
              ].map((topic) => (
                <button
                  key={topic.query}
                  onClick={() => {
                    setActiveCategory('All');
                    setSearchQuery(topic.query);
                    handleVideoSearch(undefined, false, topic.query, 'All');
                  }}
                  className={`p-8 rounded-[3rem] border-2 border-dashed transition-all hover:scale-[1.02] active:scale-95 flex flex-col items-center text-center group ${
                    isKidsSafeMode ? 'bg-white border-yellow-200 hover:border-yellow-400' : 'bg-white border-slate-100 hover:border-indigo-200'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 transition-transform group-hover:rotate-12 ${topic.color}`}>
                    {topic.icon}
                  </div>
                  <h5 className={`text-lg font-bold ${isKidsSafeMode ? 'text-yellow-900' : 'text-slate-800'}`}>{topic.label}</h5>
                  <p className="text-sm text-slate-400 mt-2">Tap to find {topic.label.toLowerCase()} videos</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {hasSearched && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h4 className={`text-xl font-bold ${isKidsSafeMode ? 'text-yellow-700' : 'text-slate-800'}`}>
                {isSearching ? 'Finding safe videos...' : `Found ${videoResults.filter(v => activeCategory === 'All' || v.category === activeCategory).length} safe videos`}
              </h4>
            </div>

            {videoResults.filter(v => activeCategory === 'All' || v.category === activeCategory).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {videoResults.filter(v => activeCategory === 'All' || v.category === activeCategory).map((video, idx) => (
                  <motion.div
                    key={video.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (idx % 24) * 0.05 }}
                    className={`group relative rounded-[2.5rem] overflow-hidden border-4 transition-all duration-300 flex flex-col ${
                      isKidsSafeMode ? 'bg-white border-yellow-100 hover:border-yellow-300 shadow-xl shadow-yellow-100' : 'bg-white border-slate-100 hover:border-indigo-200 shadow-sm'
                    }`}
                  >
                    <div className="aspect-video relative overflow-hidden">
                      <img 
                        src={video.thumbnail} 
                        alt={video.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            const newContent: ContentItem = {
                              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                              type: 'video',
                              data: video.url,
                              isBlocked: false,
                              category: video.category,
                              isKidsSafe: true,
                              reason: ''
                            };
                            setContent(prev => [newContent, ...prev]);
                            setCurrentlyViewingIdx(0);
                            setPlayingVideo({ url: video.url, title: video.title });
                          }}
                          className="bg-white text-slate-900 p-4 rounded-full shadow-2xl transform scale-90 group-hover:scale-100 transition-transform"
                        >
                          <Play className="w-8 h-8 fill-current" />
                        </button>
                      </div>
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20">
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{video.category}</span>
                      </div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <h5 className={`font-bold text-sm mb-2 line-clamp-1 ${isKidsSafeMode ? 'text-yellow-900' : 'text-slate-800'}`}>{video.title}</h5>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4 flex-1">{video.description}</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            const newContent: ContentItem = {
                              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                              type: 'video',
                              data: video.url,
                              isBlocked: false,
                              category: video.category,
                              isKidsSafe: true,
                              reason: ''
                            };
                            setContent(prev => [newContent, ...prev]);
                            setCurrentlyViewingIdx(0);
                            setPlayingVideo({ url: video.url, title: video.title });
                          }}
                          className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                            isKidsSafeMode ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Play
                        </button>
                        <button 
                          onClick={() => {
                            const relatedQuery = `Related to ${video.title}`;
                            setSearchQuery(relatedQuery);
                            handleVideoSearch(undefined, false, relatedQuery);
                          }}
                          className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${
                            isKidsSafeMode 
                              ? 'bg-white border-yellow-200 text-yellow-600 hover:bg-yellow-50' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                          title="Find Related Videos"
                        >
                          <Search className="w-3 h-3" />
                          Related
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : !isSearching && (
              <div className={`py-16 text-center rounded-[3rem] border-4 border-dashed ${isKidsSafeMode ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isKidsSafeMode ? 'bg-yellow-200 text-yellow-600' : 'bg-slate-200 text-slate-400'}`}>
                  <Video className="w-10 h-10" />
                </div>
                <h4 className={`text-2xl font-bold mb-2 ${isKidsSafeMode ? 'text-yellow-900' : 'text-slate-800'}`}>No safe videos available for this topic</h4>
                <p className="text-slate-500">Try searching for something else like "Space" or "Animals"!</p>
              </div>
            )}

            {videoResults.length > 0 && canLoadMore && (
              <div className="flex justify-center pt-8">
                <button
                  onClick={() => handleVideoSearch(undefined, true)}
                  disabled={isSearching}
                  className={`px-10 py-4 rounded-2xl font-bold transition-all flex items-center gap-3 ${
                    isKidsSafeMode 
                      ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500 shadow-lg shadow-yellow-100' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  } disabled:opacity-50`}
                >
                  {isSearching ? <Activity className="w-5 h-5 animate-spin" /> : <ChevronDown className="w-5 h-5" />}
                  {isSearching ? 'Loading...' : 'Load More Videos'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Test Section (Hidden in Kids Mode) */}
      {!isKidsSafeMode && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <form onSubmit={handleTextAnalysis} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter content to test manually..."
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-slate-700"
              />
            </div>
            <button
              type="submit"
              disabled={analyzing || !input.trim()}
              className="px-8 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
            >
              {analyzing ? 'Analyzing...' : 'Test'}
            </button>
          </form>
        </div>
      )}

      {/* Content Feed */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Live Feed</h4>
          {isScrollMode && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase">
              <ChevronDown className="w-3 h-3 animate-bounce" />
              Scroll to explore
            </div>
          )}
        </div>

        {isScrollMode ? (
          <div className="h-[600px] overflow-y-scroll snap-y snap-mandatory rounded-[2.5rem] border border-slate-100 bg-slate-50 shadow-inner scrollbar-hide">
            <AnimatePresence initial={false}>
              {filteredContent.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full w-full snap-start relative flex items-center justify-center p-4"
                >
                  <div className={`relative h-full w-full max-w-md bg-white rounded-[2rem] overflow-hidden shadow-2xl border transition-all duration-500 ${
                    item.isBlocked ? 'border-rose-200' : 'border-slate-100'
                  }`}>
                    {/* Content Display */}
                    {item.type === 'image' || item.type === 'video' ? (
                      <div className="h-full w-full relative">
                        {item.type === 'image' ? (
                          <img 
                            src={item.data} 
                            alt="Test content" 
                            className={`w-full h-full object-cover transition-all duration-700 ${item.isBlocked ? 'blur-3xl grayscale scale-110' : ''}`}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="h-full w-full relative group/video">
                            <video 
                              src={item.data} 
                              className={`w-full h-full object-cover cursor-pointer transition-all duration-700 ${item.isBlocked ? 'blur-3xl grayscale scale-110' : ''}`}
                              loop
                              muted
                              playsInline
                              onClick={() => {
                                if (!item.isBlocked && item.isKidsSafe) {
                                  setPlayingVideo({ url: item.data, title: item.category || 'Video Content' });
                                }
                              }}
                            />
                            {!item.isBlocked && (
                              <div className="play-overlay absolute inset-0 flex items-center justify-center transition-opacity bg-black/20 pointer-events-none">
                                <div className="bg-white/90 p-6 rounded-full shadow-2xl transform scale-100 transition-transform">
                                  <Play className="w-12 h-12 text-indigo-600 fill-current" />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Age Restriction Overlay */}
                        {!item.isBlocked && !item.isKidsSafe && (
                          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md p-8 text-center">
                            <div className="bg-white/10 p-4 rounded-full mb-4">
                              <Lock className="w-12 h-12 text-white" />
                            </div>
                            <h4 className="text-white font-bold text-xl mb-2">Age Restricted</h4>
                            <p className="text-slate-200 text-sm mb-6">This content is rated {item.ageRating}+</p>
                            <button 
                              onClick={() => setAgeVerificationIdx(content.indexOf(item))}
                              className="bg-white text-slate-900 px-6 py-3 rounded-full text-sm font-bold hover:bg-slate-100 transition-all"
                            >
                              Verify Age
                            </button>
                          </div>
                        )}

                        {/* Overlays */}
                        {isLiveProtectionActive && !item.isBlocked && (
                          <div className="absolute top-6 right-6 z-10 flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">AI Guard Active</span>
                          </div>
                        )}

                        {item.isBlocked && (
                          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-rose-950/60 backdrop-blur-md p-8 text-center">
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="bg-white/10 p-4 rounded-full mb-4"
                            >
                              <Lock className="w-12 h-12 text-white" />
                            </motion.div>
                            <h4 className="text-white font-bold text-xl mb-2">Safety Alert</h4>
                            <p className="text-rose-100 text-sm">{item.reason}</p>
                            <button 
                              onClick={() => setShowInfoIdx(idx)}
                              className="mt-6 flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full text-xs font-bold text-white transition-all"
                            >
                              <Info className="w-4 h-4" />
                              View Analysis
                            </button>
                          </div>
                        )}

                        {/* Info Icon Button */}
                        {!item.isBlocked && (
                          <button 
                            onClick={() => setShowInfoIdx(idx)}
                            className="absolute bottom-6 right-6 z-10 bg-white/20 hover:bg-white/40 backdrop-blur-md p-3 rounded-full border border-white/30 text-white transition-all shadow-lg"
                          >
                            <Info className="w-6 h-6" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
                        <div className={`p-6 rounded-full mb-6 ${item.isBlocked ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                          {item.isBlocked ? <EyeOff className="w-12 h-12" /> : <MessageSquare className="w-12 h-12" />}
                        </div>
                        <p className={`text-xl font-medium leading-relaxed ${item.isBlocked ? 'blur-md select-none text-slate-300' : 'text-slate-800'}`}>
                          {item.data}
                        </p>
                        <button 
                          onClick={() => setShowInfoIdx(idx)}
                          className="mt-8 flex items-center gap-2 bg-slate-100 hover:bg-slate-200 px-6 py-3 rounded-full text-sm font-bold text-slate-600 transition-all"
                        >
                          <Info className="w-5 h-5" />
                          AI Analysis
                        </button>
                      </div>
                    )}

                    {/* AI Info Overlay */}
                    <AnimatePresence>
                      {showInfoIdx === idx && (
                        <motion.div
                          initial={{ y: '100%' }}
                          animate={{ y: 0 }}
                          exit={{ y: '100%' }}
                          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                          className="absolute inset-0 z-30 bg-white p-8 flex flex-col"
                        >
                          <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-100 rounded-xl">
                                <Shield className="w-6 h-6 text-indigo-600" />
                              </div>
                              <h4 className="font-bold text-slate-800">AI Safety Report</h4>
                            </div>
                            <button 
                              onClick={() => setShowInfoIdx(null)}
                              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            >
                              <X className="w-6 h-6 text-slate-400" />
                            </button>
                          </div>

                          <div className="space-y-6 flex-1">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Detection Category</p>
                              <p className="text-lg font-bold text-slate-800">{item.category || 'Safe Content'}</p>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Safety Status</p>
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${item.isBlocked ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                <p className={`font-bold ${item.isBlocked ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  {item.isBlocked ? 'Restricted' : 'Approved'}
                                </p>
                              </div>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">AI Reasoning</p>
                              <p className="text-sm text-slate-600 leading-relaxed">
                                {item.reason || 'The AI analyzed this content and determined it is safe for children based on current safety guidelines.'}
                              </p>
                            </div>
                          </div>

                          <div className="pt-6 border-t border-slate-100 text-center">
                            <p className="text-[10px] text-slate-400 font-medium italic">
                              Powered by Gemini 3.1 Pro Vision Guard
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence initial={false}>
              {filteredContent.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="relative group"
                >
                  <div className={`bg-white rounded-3xl overflow-hidden border transition-all duration-300 ${
                    item.isBlocked ? 'border-rose-100 shadow-rose-50' : 'border-slate-100 shadow-sm'
                  } ${currentlyViewingIdx === content.indexOf(item) ? 'ring-2 ring-indigo-500 ring-offset-4' : ''}`}>
                    
                    {currentlyViewingIdx === content.indexOf(item) && (
                      <div className="absolute -top-3 -right-3 z-20 bg-indigo-600 text-white p-2 rounded-full shadow-lg animate-bounce">
                        <Eye className="w-4 h-4" />
                      </div>
                    )}

                    {item.type === 'image' || item.type === 'video' ? (
                      <div className="aspect-video relative">
                        {item.type === 'image' ? (
                          <img 
                            src={item.data} 
                            alt="Test content" 
                            className={`w-full h-full object-cover transition-all duration-500 ${item.isBlocked ? 'blur-2xl grayscale' : ''}`}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="relative h-full group/video">
                            <video 
                              src={item.data} 
                              className={`w-full h-full object-cover cursor-pointer transition-all duration-500 ${item.isBlocked ? 'blur-2xl grayscale' : ''}`}
                              onClick={() => {
                                if (!item.isBlocked && item.isKidsSafe) {
                                  setPlayingVideo({ url: item.data, title: item.category || 'Video Content' });
                                }
                              }}
                            />
                            {!item.isBlocked && item.isKidsSafe && (
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/video:opacity-100 transition-opacity bg-black/20 cursor-pointer">
                                <Play className="w-12 h-12 text-white fill-current" />
                              </div>
                            )}
                            {isLiveProtectionActive && !item.isBlocked && (
                              <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Live AI Guard</span>
                              </div>
                            )}
                            {currentlyViewingIdx === content.indexOf(item) && (
                              <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-indigo-600/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                                <Eye className="w-3 h-3 text-white animate-pulse" />
                                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Child Viewing</span>
                              </div>
                            )}
                          </div>
                        )}
                        {item.isBlocked && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-900/40 backdrop-blur-sm p-6 text-center">
                            <Lock className="w-12 h-12 text-white mb-3" />
                            <p className="text-white font-bold text-lg">Content Restricted</p>
                            <p className="text-rose-100 text-sm mt-1">{item.reason}</p>
                          </div>
                        )}
                        {!item.isBlocked && !item.isKidsSafe && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6 text-center">
                            <Baby className="w-10 h-10 text-white mb-3" />
                            <p className="text-white font-bold">Age Verification Required</p>
                            <button 
                              onClick={() => setAgeVerificationIdx(content.indexOf(item))}
                              className="mt-4 bg-white text-slate-900 px-4 py-2 rounded-full text-xs font-bold"
                            >
                              Verify
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-2xl ${item.isBlocked ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                            {item.isBlocked ? <EyeOff className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Text Content</span>
                              {item.isBlocked && (
                                <span className="bg-rose-100 text-rose-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Blocked</span>
                              )}
                            </div>
                            <p className={`text-slate-700 leading-relaxed ${item.isBlocked ? 'blur-sm select-none' : ''}`}>
                              {item.data}
                            </p>
                            {currentlyViewingIdx === content.indexOf(item) && (
                              <div className="mt-3 flex items-center gap-2 text-indigo-600">
                                <Eye className="w-3 h-3 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Child Viewing</span>
                              </div>
                            )}
                            {item.isBlocked && (
                              <div className="mt-4 p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-rose-800 font-medium">
                                  <span className="font-bold">Reason:</span> {item.reason}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}  
          {content.length === 0 && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem]">
              <div className="bg-slate-100 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Video className="w-8 h-8" />
              </div>
              <p className="text-slate-400 font-medium italic">No content analyzed yet. Start by testing some text, images, or videos.</p>
            </div>
          )}
      </div>
    </div>
  );
}
