import React, { useState, useEffect } from 'react';
import { Shield, LayoutDashboard, Baby, Settings as SettingsIcon, Bell, AlertTriangle, CheckCircle, Lock, Clock, Volume2, UserX, Camera, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import ChildMode from './components/ChildMode';
import Settings from './components/Settings';
import CameraGuard from './components/CameraGuard';
import { Settings as SettingsType } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'child' | 'settings' | 'videos'>('settings');
  const [settings, setSettings] = useState<SettingsType>({ 
    sensitivity: 'Medium', 
    alert_email: '',
    age_limit: 12,
    allowed_categories: ['Education', 'Entertainment', 'Games'],
    screen_time_limit_minutes: 60,
    blocked_websites: ['unsafe-site.com', 'bad-content.net'],
    face_detection_enabled: true,
    voice_alerts_enabled: true,
    password_enabled: true
  });
  const [notifications, setNotifications] = useState<{id: number, message: string, type: 'alert' | 'success'}[]>([]);
  const [screenTime, setScreenTime] = useState(0); // in seconds
  const [isLocked, setIsLocked] = useState(false);
  const [showBreakReminder, setShowBreakReminder] = useState(false);
  const [isChildModeForced, setIsChildModeForced] = useState(false);
  const [faceDetected, setFaceDetected] = useState(true);
  const [isRegisteringFace, setIsRegisteringFace] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true); // Start active for initial check
  const [intendedTab, setIntendedTab] = useState<string | null>(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [showVerificationSelection, setShowVerificationSelection] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isParentVerified, setIsParentVerified] = useState(false);

  useEffect(() => {
    // Automatically start camera for initial verification if enabled
    if (settings.face_detection_enabled && !isParentVerified) {
      setIsCameraActive(true);
    }
  }, [settings.face_detection_enabled, isParentVerified]);

  useEffect(() => {
    // Reset parent verification when entering child mode
    // This ensures that leaving child mode ALWAYS requires verification
    if (activeTab === 'child' || activeTab === 'videos') {
      setIsParentVerified(false);
    }
  }, [activeTab]);

  useEffect(() => {
    // Screen time timer
    const timer = setInterval(() => {
      if (activeTab === 'child' && !isLocked) {
        setScreenTime(prev => {
          const next = prev + 1;
          // 30 minutes break reminder (1800 seconds)
          if (next === 1800) {
            setShowBreakReminder(true);
            addNotification("Time for a short break! You've been browsing for 30 minutes.", 'success');
          }
          // 1 hour lock (3600 seconds)
          if (next >= settings.screen_time_limit_minutes * 60) {
            setIsLocked(true);
            addNotification("Screen time limit reached. Browsing is now locked.", 'alert');
          }
          // Tick the server every minute
          if (next % 60 === 0) {
            fetch('/api/screen-time/tick', { method: 'POST' });
          }
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTab, isLocked, settings.screen_time_limit_minutes]);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && Object.keys(data).length > 0) {
          setSettings(prev => ({ ...prev, ...data }));
        }
      });
  }, []);

  const playVoiceAlert = (message: string) => {
    if (!settings.voice_alerts_enabled) return;
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const addNotification = (message: string, type: 'alert' | 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setNotifications(prev => [...prev, { id: id as any, message, type }]);
    
    if (type === 'alert') {
      playVoiceAlert("This content is blocked for safety");
    }

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const handleFaceAnalysis = (data: { faceDetected: boolean, estimatedAge?: number, isParent?: boolean }) => {
    if (!settings.face_detection_enabled) return;

    if (data.faceDetected !== undefined) {
      setFaceDetected(data.faceDetected);
    }

    if (data.isParent) {
      // Parent detected
      setIsParentVerified(true);
      setIsLocked(false);
      if (activeTab === 'child' || activeTab === 'videos' || isChildModeForced) {
        setActiveTab((intendedTab as any) || 'dashboard');
        setIntendedTab(null);
      }
      setVerificationMessage("Face verified – Parent Mode unlocked");
      addNotification("Camera turned off for privacy", "success");
      setTimeout(() => setVerificationMessage(null), 5000);
      setIsChildModeForced(false);
      setIsCameraActive(false); // Turn off camera after verification
    } else if (data.estimatedAge !== undefined) {
      // If a child is detected (< 13)
      if (data.estimatedAge < 13) {
        // Don't auto-switch tab anymore, but engage the safety lock
        setIsParentVerified(false);
        setVerificationMessage("Child detected – Safety Lock engaged");
        addNotification("Camera turned off for safety", "success");
        addNotification("Safety Lock activated", "success");
        setTimeout(() => setVerificationMessage(null), 5000);
        setIsChildModeForced(true);
        setIsCameraActive(false); // Turn off camera after detection
      } else if (data.estimatedAge >= 18 && (activeTab === 'child' || activeTab === 'videos') && !data.isParent && settings.parent_face_data) {
        // Adult detected but not the registered parent
        setIsParentVerified(false);
        setIsChildModeForced(true);
        setVerificationMessage("Face not authorized – Access restricted");
        setTimeout(() => setVerificationMessage(null), 5000);
        setIsCameraActive(false); // Turn off camera after detection
      } else {
        // Default case for other ages if not parent
        setIsCameraActive(false);
      }
    } else if (data.faceDetected === false) {
      // No face detected at all
      // We don't necessarily turn off camera here if we want to keep looking, 
      // but the user said "After face detection is completed (child or parent detected): Automatically turn OFF"
      // If no face is detected, we might want to keep it on for a bit or turn it off if it times out.
      // For now, let's keep it on until a face is actually found or user cancels.
    }
  };

  const handleRegisterFace = (base64: string) => {
    const newSettings = { ...settings, parent_face_data: base64 };
    setSettings(newSettings);
    setIsRegisteringFace(false);
    setIsCameraActive(false); // Turn off camera after registration
    addNotification("Parent face registered successfully!", "success");
    
    // Save to backend
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    });
  };

  const handlePasswordSubmit = () => {
    if (settings.parent_password && passwordInput === settings.parent_password) {
      setIsParentVerified(true);
      setIsLocked(false);
      setActiveTab((intendedTab as any) || 'dashboard');
      setIntendedTab(null);
      setIsChildModeForced(false);
      setIsCameraActive(false);
      setShowPasswordPrompt(false);
      setPasswordInput('');
      addNotification("Parent Mode unlocked via password", "success");
    } else {
      addNotification("Incorrect password", "alert");
      setPasswordInput('');
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'child', label: 'Child Mode', icon: Baby },
    { id: 'videos', label: 'Video Search', icon: Video },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-800 font-sans">
      {/* Verification Message Overlay */}
      <AnimatePresence>
        {verificationMessage && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-indigo-600 text-white px-8 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3"
          >
            <Shield className="w-6 h-6" />
            {verificationMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Shield className="text-white w-6 h-6" />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-indigo-900 font-display">SafeGuard</h1>
          </div>
          {isParentVerified && (
            <button 
              onClick={() => setIsParentVerified(false)}
              className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
              title="Lock Parent Mode"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                // Only allow switching away from child mode if parent is verified
                const isCurrentlyInChildMode = activeTab === 'child' || activeTab === 'videos' || isChildModeForced;
                const isTryingToLeaveChildMode = item.id !== 'child' && item.id !== 'videos';
                const isFaceAuthEnabled = settings.face_detection_enabled && !!settings.parent_face_data;
                const isPasswordAuthEnabled = settings.password_enabled && !!settings.parent_password;
                const hasParentCredentials = isFaceAuthEnabled || isPasswordAuthEnabled;

                if (isCurrentlyInChildMode && isTryingToLeaveChildMode && hasParentCredentials && !isParentVerified) {
                  addNotification("Parent verification required to leave Child Mode.", "alert");
                  setIntendedTab(item.id);
                  setShowVerificationSelection(true);
                  return;
                }
                
                // If no credentials or already verified, allow leaving and reset forced mode
                if (isCurrentlyInChildMode && isTryingToLeaveChildMode) {
                  setIsChildModeForced(false);
                }
                
                setActiveTab(item.id as any);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id 
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-bold text-sm tracking-tight">{item.label}</span>
              {item.id === 'child' && isChildModeForced && (
                <div className="ml-auto">
                  <Lock className="w-3 h-3 text-rose-500" />
                </div>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className={`p-4 rounded-2xl transition-all duration-300 ${activeTab === 'child' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${activeTab === 'child' ? 'text-indigo-100' : 'text-slate-400'}`}>Current Mode</p>
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${activeTab === 'child' ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-indigo-500'}`} />
              <span className={`text-sm font-bold ${activeTab === 'child' ? 'text-white' : 'text-slate-700'}`}>
                {activeTab === 'child' ? 'Child Mode Active' : 'Parental Dashboard'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800 capitalize font-display">{activeTab.replace('-', ' ')}</h2>
            {activeTab === 'child' && (
              <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">Active Protection</span>
            )}
            {settings.face_detection_enabled && (
              <div className="flex items-center gap-4 ml-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
                  <div className={`w-1.5 h-1.5 rounded-full ${isCameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {isCameraActive ? 'AI Guard Active' : 'AI Guard Standby'}
                  </span>
                </div>
                {!isCameraActive && (
                  <button
                    onClick={() => setIsCameraActive(true)}
                    className={`flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold rounded-full transition-all shadow-sm uppercase tracking-wider ${
                      isChildModeForced 
                        ? 'bg-rose-600 text-white hover:bg-rose-700 animate-bounce' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    <Camera className="w-3 h-3" />
                    Verify Face
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                <Bell className="w-6 h-6" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full" />
                )}
              </button>
            </div>
            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border-2 border-white shadow-sm">
              P
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {isLocked ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto"
            >
              <div className="bg-rose-100 p-8 rounded-[3rem] text-rose-600 mb-8 shadow-xl shadow-rose-100">
                <Lock className="w-20 h-20" />
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-4">Screen Time Limit Reached</h2>
              <p className="text-slate-500 mb-8 leading-relaxed">
                You've reached your daily limit of {settings.screen_time_limit_minutes} minutes. 
                It's time to take a long break and do something else!
              </p>
              <button 
                onClick={() => {
                  setShowVerificationSelection(true);
                  setIntendedTab(activeTab); // Stay on current tab after unlock
                }}
                className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
              >
                <Shield className="w-5 h-5" />
                Parent Verification
              </button>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-6xl mx-auto h-full"
              >
                {activeTab === 'dashboard' && <Dashboard />}
                {activeTab === 'videos' && (
                  <ChildMode 
                    settings={settings} 
                    onAlert={(msg) => addNotification(msg, 'alert')} 
                    onActivate={() => setIsChildModeForced(true)}
                    faceDetected={faceDetected}
                    isParentMode={!isChildModeForced && (verificationMessage?.includes("Parent") || activeTab === 'dashboard' || activeTab === 'videos')}
                    isForced={isChildModeForced}
                  />
                )}
                {activeTab === 'child' && (
                  <div className="space-y-8">
                    {showBreakReminder && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-amber-600" />
                          <p className="text-sm font-medium text-amber-800">Time for a 5-minute stretch! You've been online for 30 minutes.</p>
                        </div>
                        <button onClick={() => setShowBreakReminder(false)} className="text-amber-600 hover:text-amber-800 font-bold text-xs uppercase">Dismiss</button>
                      </motion.div>
                    )}
                    <ChildMode 
                      settings={settings} 
                      onAlert={(msg) => addNotification(msg, 'alert')} 
                      onActivate={() => setIsChildModeForced(true)}
                      faceDetected={faceDetected}
                      isParentMode={false}
                      isForced={isChildModeForced}
                    />
                  </div>
                )}
                {activeTab === 'settings' && (
                  <Settings 
                    settings={settings} 
                    onUpdate={setSettings} 
                    onRegisterFace={() => setIsRegisteringFace(true)}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Camera Guard Overlay (Hidden but active) */}
        <CameraGuard 
          enabled={settings.face_detection_enabled && isCameraActive} 
          onAnalysis={handleFaceAnalysis} 
          onRegister={handleRegisterFace}
          registerMode={isRegisteringFace}
          parentFaceData={settings.parent_face_data}
        />

        {/* Face Not Detected Overlay */}
        <AnimatePresence>
          {!faceDetected && (activeTab === 'child' || activeTab === 'videos') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-slate-900/90 backdrop-blur-xl flex flex-col items-center justify-center text-center p-8"
            >
              <div className="bg-rose-500 p-8 rounded-[3rem] text-white mb-8 shadow-2xl shadow-rose-500/20">
                <UserX className="w-20 h-20" />
              </div>
              <h2 className="text-4xl font-bold text-white mb-4">Face not detected</h2>
              <p className="text-slate-300 max-w-md mx-auto text-lg leading-relaxed">
                Please look at the screen to continue browsing safely.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verification Selection Modal */}
        <AnimatePresence>
          {showVerificationSelection && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[130] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl"
              >
                <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2 text-center">Verify Identity</h3>
                <p className="text-slate-500 mb-8 text-center">Choose a method to unlock Parent Mode.</p>
                
                <div className="space-y-4">
                  {(settings.face_detection_enabled && !!settings.parent_face_data) && (
                    <button
                      onClick={() => {
                        setIsCameraActive(true);
                        setShowVerificationSelection(false);
                      }}
                      className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-3"
                    >
                      <Camera className="w-5 h-5" />
                      Use Face ID
                    </button>
                  )}
                  
                  {(settings.password_enabled && !!settings.parent_password) && (
                    <button
                      onClick={() => {
                        setShowPasswordPrompt(true);
                        setShowVerificationSelection(false);
                      }}
                      className="w-full py-4 bg-white border-2 border-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
                    >
                      <Lock className="w-5 h-5" />
                      Use Password
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowVerificationSelection(false);
                      setIntendedTab(null);
                    }}
                    className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Password Prompt Modal */}
        <AnimatePresence>
          {showPasswordPrompt && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl"
              >
                <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2 text-center">Parent Password</h3>
                <p className="text-slate-500 mb-8 text-center">Enter your password to unlock Parent Mode.</p>
                
                <div className="space-y-4">
                  <input
                    type="password"
                    autoFocus
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                    placeholder="Enter password"
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 transition-all outline-none text-center text-lg font-bold tracking-widest"
                  />
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowPasswordPrompt(false);
                        setPasswordInput('');
                      }}
                      className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePasswordSubmit}
                      className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                      Unlock
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notifications Toast */}
        <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3">
          <AnimatePresence>
            {notifications.map((n) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.9 }}
                className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl border ${
                  n.type === 'alert' 
                    ? 'bg-rose-50 border-rose-100 text-rose-800' 
                    : 'bg-emerald-50 border-emerald-100 text-emerald-800'
                }`}
              >
                {n.type === 'alert' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                <p className="font-medium">{n.message}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
