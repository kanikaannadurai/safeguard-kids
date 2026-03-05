import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Clock, Eye, Activity, Globe, Lock, Trash2, Plus, Smartphone, LayoutDashboard, Baby, Settings as SettingsIcon, Bell, BarChart3, ShieldAlert, ShieldCheck, TrendingUp, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Log, Stats } from '../types';

export default function Dashboard() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState<Stats>({ totalBlocked: 0, categoryBreakdown: [], screenTimeUsedMinutes: 0 });
  const [blockedWebsites, setBlockedWebsites] = useState<string[]>(['unsafe-site.com', 'bad-content.net']);
  const [newWebsite, setNewWebsite] = useState('');
  const [screenTimeLimit, setScreenTimeLimit] = useState(60);
  const [loading, setLoading] = useState(true);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [logsRes, statsRes, settingsRes] = await Promise.all([
          fetch('/api/logs'),
          fetch('/api/stats'),
          fetch('/api/settings')
        ]);
        const logsData = await logsRes.json();
        const statsData = await statsRes.json();
        const settingsData = await settingsRes.json();
        
        setLogs(logsData);
        setStats(statsData);
        if (settingsData.blocked_websites) setBlockedWebsites(settingsData.blocked_websites);
        if (settingsData.screen_time_limit_minutes) setScreenTimeLimit(settingsData.screen_time_limit_minutes);
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const handleAddWebsite = async () => {
    if (!newWebsite.trim()) return;
    const updated = [...blockedWebsites, newWebsite.trim()];
    setBlockedWebsites(updated);
    setNewWebsite('');
    // Save to backend
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked_websites: updated })
    });
  };

  const handleRemoveWebsite = (site: string) => {
    const updated = blockedWebsites.filter(s => s !== site);
    setBlockedWebsites(updated);
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked_websites: updated })
    });
  };

  const handleUpdateScreenTime = (val: number) => {
    setScreenTimeLimit(val);
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screen_time_limit_minutes: val })
    });
  };

  const handleSavePassword = async () => {
    if (!newPassword.trim()) return;
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_password: newPassword, password_enabled: true })
      });
      setIsEditingPassword(false);
      setNewPassword('');
      // In a real app, we might want to trigger a global settings refresh
    } catch (error) {
      console.error("Save password error:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-rose-100 p-3 rounded-2xl text-rose-600">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Blocked</p>
              <h4 className="text-2xl font-bold text-slate-800">{stats.totalBlocked}</h4>
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '65%' }}
              className="h-full bg-rose-500" 
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Screen Time</p>
              <h4 className="text-2xl font-bold text-slate-800">{stats.screenTimeUsedMinutes} / {screenTimeLimit}m</h4>
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(stats.screenTimeUsedMinutes / screenTimeLimit) * 100}%` }}
              className="h-full bg-indigo-500" 
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Accuracy</p>
              <h4 className="text-2xl font-bold text-slate-800">99.4%</h4>
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '99%' }}
              className="h-full bg-emerald-500" 
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-amber-100 p-3 rounded-2xl text-amber-600">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Devices</p>
              <h4 className="text-2xl font-bold text-slate-800">2</h4>
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '40%' }}
              className="h-full bg-amber-500" 
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activity Logs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-slate-800 font-display">Recent Activity</h3>
              <button className="text-indigo-600 font-bold text-xs uppercase tracking-widest hover:text-indigo-700">View All</button>
            </div>
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className={`p-3 rounded-xl ${log.status === 'blocked' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {log.status === 'blocked' ? <AlertCircle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-bold text-slate-800">{log.category}</p>
                      <span className="text-[10px] font-bold text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{log.content}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    log.severity === 'High' ? 'bg-rose-100 text-rose-600' : 
                    log.severity === 'Medium' ? 'bg-amber-100 text-amber-600' : 
                    'bg-indigo-100 text-indigo-600'
                  }`}>
                    {log.severity}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Controls Sidebar */}
        <div className="space-y-8">
          {/* Website Blocking */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="w-6 h-6 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-800">Blocked Websites</h3>
            </div>
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={newWebsite}
                onChange={(e) => setNewWebsite(e.target.value)}
                placeholder="example.com"
                className="flex-1 px-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button 
                onClick={handleAddWebsite}
                className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
              {blockedWebsites.map((site) => (
                <div key={site} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs font-medium text-slate-600">{site}</span>
                  <button onClick={() => handleRemoveWebsite(site)} className="text-slate-400 hover:text-rose-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Screen Time Control */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-6 h-6 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-800">Screen Time Limit</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span>Daily Limit</span>
                <span>{screenTimeLimit} minutes</span>
              </div>
              <input 
                type="range" 
                min="15" 
                max="240" 
                step="15"
                value={screenTimeLimit}
                onChange={(e) => handleUpdateScreenTime(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="p-4 bg-indigo-50 rounded-2xl flex items-start gap-3">
                <Lock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-indigo-800 font-medium leading-relaxed">
                  Browsing will automatically lock once the daily limit is reached.
                </p>
              </div>
            </div>
          </div>

          {/* Parental Security Widget */}
          <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100 text-white overflow-hidden relative">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-6 h-6 text-white" />
                <h3 className="text-lg font-bold font-display">Parental Security</h3>
              </div>
              <div className="space-y-4">
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                  <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mb-2">Parent Password</p>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-mono tracking-widest">
                        {newPassword ? '••••••' : '••••••'}
                      </span>
                      <button 
                        onClick={() => setIsEditingPassword(!isEditingPassword)}
                        className="text-[10px] font-bold uppercase tracking-widest bg-white text-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        {isEditingPassword ? 'Cancel' : 'Change'}
                      </button>
                    </div>
                    
                    {isEditingPassword && (
                      <div className="flex gap-2">
                        <input 
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password"
                          className="flex-1 bg-white/20 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/50 outline-none focus:ring-1 focus:ring-white/50"
                        />
                        <button 
                          onClick={handleSavePassword}
                          className="bg-white text-indigo-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-indigo-100 leading-relaxed opacity-80">
                  This password is required to exit Child Mode. Keep it safe!
                </p>
              </div>
            </div>
            <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
