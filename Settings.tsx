import React, { useState } from 'react';
import { Save, Mail, Shield, Sliders, Bell, Info, Baby, LayoutDashboard, Camera, Volume2, CheckCircle, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { Settings as SettingsType } from '../types';

interface SettingsProps {
  settings: SettingsType;
  onUpdate: (settings: SettingsType) => void;
  onRegisterFace: () => void;
}

export default function Settings({ settings, onUpdate, onRegisterFace }: SettingsProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);

  const toggleSetting = (key: keyof SettingsType) => {
    setLocalSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localSettings)
      });
      onUpdate(localSettings);
      // Show success toast would be nice
    } catch (error) {
      console.error("Save settings error:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Parent Face Registration */}
      <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100 text-white overflow-hidden relative">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-white/20 p-3 rounded-2xl">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold font-display">Parent Face ID</h3>
              <p className="text-indigo-100 text-sm">Register your face to unlock Parent Mode automatically.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={onRegisterFace}
              className="px-8 py-4 bg-white text-indigo-600 font-bold rounded-2xl hover:bg-indigo-50 transition-all shadow-lg"
            >
              {settings.parent_face_data ? 'Update Registered Face' : 'Register My Face'}
            </button>
            {settings.parent_face_data && (
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <CheckCircle className="w-4 h-4" />
                Face ID Active
              </div>
            )}
          </div>
        </div>
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-600">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800 font-display">Protection Controls</h3>
            <p className="text-sm text-slate-500">Customize how the AI filters content for your child.</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Sensitivity Level */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-500" />
              AI Sensitivity Level
            </label>
            <div className="grid grid-cols-3 gap-4">
              {['Low', 'Medium', 'High'].map((level) => (
                <button
                  key={level}
                  onClick={() => setLocalSettings({ ...localSettings, sensitivity: level as any })}
                  className={`px-6 py-4 rounded-2xl font-bold transition-all duration-200 border-2 ${
                    localSettings.sensitivity === level
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100'
                      : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl flex gap-3 items-start">
              <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 leading-relaxed">
                {localSettings.sensitivity === 'Low' && 'Filters only the most explicit content. Recommended for older children (13-15).'}
                {localSettings.sensitivity === 'Medium' && 'Balanced filtering for general safety. Recommended for children aged 8-12.'}
                {localSettings.sensitivity === 'High' && 'Strict filtering for maximum safety. Recommended for younger children (5-7).'}
              </p>
            </div>
          </div>

          {/* Age Limit */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Baby className="w-4 h-4 text-indigo-500" />
              Age Restriction
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="3"
                max="18"
                value={localSettings.age_limit}
                onChange={(e) => setLocalSettings({ ...localSettings, age_limit: parseInt(e.target.value) })}
                className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <span className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl font-bold min-w-[80px] text-center">
                {localSettings.age_limit} yrs
              </span>
            </div>
            <p className="text-xs text-slate-500">Content rated above this age will require verification.</p>
          </div>

          {/* Allowed Categories */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-indigo-500" />
              Allowed Content Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {['Education', 'Entertainment', 'Games', 'Science', 'Music', 'Sports', 'News'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    const newCats = localSettings.allowed_categories.includes(cat)
                      ? localSettings.allowed_categories.filter(c => c !== cat)
                      : [...localSettings.allowed_categories, cat];
                    setLocalSettings({ ...localSettings, allowed_categories: newCats });
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all border-2 ${
                    localSettings.allowed_categories.includes(cat)
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Parent Password */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-500" />
                Parental Password
              </label>
              <div 
                onClick={() => setLocalSettings({ ...localSettings, password_enabled: !localSettings.password_enabled })}
                className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors duration-300 ${
                  localSettings.password_enabled ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <motion.div 
                  animate={{ x: localSettings.password_enabled ? 22 : 2 }}
                  className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" 
                />
              </div>
            </div>
            {localSettings.password_enabled && (
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="password"
                  value={localSettings.parent_password || ''}
                  onChange={(e) => setLocalSettings({ ...localSettings, parent_password: e.target.value })}
                  placeholder="Set a password to leave Child Mode"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-slate-700"
                />
              </div>
            )}
            <p className="text-xs text-slate-500">
              {localSettings.password_enabled 
                ? "This password will be required to exit Child Mode." 
                : "Password protection is currently disabled."}
            </p>
          </div>

          {/* Alert Email */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-500" />
              Parental Notification Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="email"
                value={localSettings.alert_email}
                onChange={(e) => setLocalSettings({ ...localSettings, alert_email: e.target.value })}
                placeholder="parent@example.com"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-slate-700"
              />
            </div>
          </div>

          {/* Notification Toggles */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-500" />
              Advanced Safety Features
            </label>
            <div className="space-y-3">
              {[
                { 
                  label: 'Real-time Face Detection', 
                  desc: 'Pause content when no face is detected.',
                  key: 'face_detection_enabled',
                  icon: Camera
                },
                { 
                  label: 'Voice Safety Alerts', 
                  desc: 'Play audio warnings when content is blocked.',
                  key: 'voice_alerts_enabled',
                  icon: Volume2
                },
                { 
                  label: 'Immediate Email Alerts', 
                  desc: 'Get notified as soon as a threat is blocked.',
                  key: null,
                  icon: Mail
                }
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm">
                      {item.icon && <item.icon className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{item.label}</p>
                      <p className="text-[10px] text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                  <div 
                    onClick={() => item.key && toggleSetting(item.key as any)}
                    className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-300 ${
                      item.key ? (localSettings[item.key as keyof SettingsType] ? 'bg-indigo-600' : 'bg-slate-200') : 'bg-indigo-600'
                    }`}
                  >
                    <motion.div 
                      animate={{ x: item.key ? (localSettings[item.key as keyof SettingsType] ? 24 : 4) : 24 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
