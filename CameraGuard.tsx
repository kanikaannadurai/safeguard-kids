import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, UserCheck, UserX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeFace } from '../services/gemini';

interface CameraGuardProps {
  enabled: boolean;
  onAnalysis: (data: { faceDetected: boolean, estimatedAge?: number, isParent?: boolean }) => void;
  onRegister?: (base64: string) => void;
  registerMode?: boolean;
  parentFaceData?: string;
}

export default function CameraGuard({ enabled, onAnalysis, onRegister, registerMode, parentFaceData }: CameraGuardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastFaceDetected, setLastFaceDetected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisInterval, setAnalysisInterval] = useState(30000); // Start with 30 seconds

  useEffect(() => {
    if (enabled || registerMode) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [enabled, registerMode]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 320, height: 240 } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Camera access denied. Face detection unavailable.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (enabled && stream && !registerMode) {
      // Small delay to ensure video is rendering
      const timer = setTimeout(() => {
        analyzeFrame();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [enabled, stream, registerMode]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (enabled && stream && !registerMode) {
      interval = setInterval(analyzeFrame, analysisInterval);
    }
    return () => clearInterval(interval);
  }, [enabled, stream, analysisInterval, registerMode]);

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg').split(',')[1];
  };

  useEffect(() => {
    if (registerMode && stream && onRegister) {
      const timer = setTimeout(() => {
        const frame = captureFrame();
        if (frame) onRegister(frame);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [registerMode, stream]);

  const analyzeFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    setIsAnalyzing(true);
    const base64Image = captureFrame();
    if (!base64Image) {
      setIsAnalyzing(false);
      return;
    }

    try {
      const result = await analyzeFace(base64Image, parentFaceData);
      setLastFaceDetected(result.faceDetected);
      onAnalysis(result);
      setError(null);
      setAnalysisInterval(30000); // Reset to 30s on success
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || "";
      const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('exhausted');
      
      if (!isQuota) {
        console.error("AI Analysis error:", err);
      }

      if (isQuota) {
        setError("AI Safety Guard is temporarily busy (Quota Exceeded). Using local safety filters.");
        setAnalysisInterval(prev => Math.min(prev * 2, 600000)); // Backoff up to 10 minutes
      } else {
        setError("AI Analysis error. Retrying...");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-[60]">
      <div className="relative group">
        <div className={`p-1 rounded-2xl bg-white shadow-2xl border-2 transition-all duration-500 overflow-hidden ${
          lastFaceDetected === false ? 'border-rose-500' : 'border-indigo-500'
        }`}>
          <div className="relative w-32 h-24 bg-slate-900 rounded-xl overflow-hidden">
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline 
              className={`w-full h-full object-cover transition-opacity duration-500 ${stream ? 'opacity-100' : 'opacity-0'}`}
            />
            <canvas ref={canvasRef} width={320} height={240} className="hidden" />
            
            {!stream && (
              <div className="absolute inset-0 flex items-center justify-center">
                <CameraOff className="w-8 h-8 text-slate-700" />
              </div>
            )}

            {isAnalyzing && (
              <div className="absolute inset-0 bg-indigo-900/40 backdrop-blur-[1px] flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {lastFaceDetected !== null && (
              <div className={`absolute top-2 right-2 p-1 rounded-full ${lastFaceDetected ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                {lastFaceDetected ? <UserCheck className="w-3 h-3 text-white" /> : <UserX className="w-3 h-3 text-white" />}
              </div>
            )}
          </div>
        </div>

        {/* Status Tooltip */}
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
            {error ? error : (stream ? 'AI Camera Guard Active' : 'AI Guard Standby (Camera Off)')}
          </div>
        </div>
      </div>
    </div>
  );
}
