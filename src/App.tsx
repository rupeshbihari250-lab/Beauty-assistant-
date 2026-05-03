/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Power, Globe, Heart, Zap, LogIn, LogOut, User } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LiveAPIClient, SessionStatus } from "./lib/live-api-client";
import { AudioPlayer, AudioStreamer } from "./lib/audio-streamer";
import AudioVisualizer from "./components/AudioVisualizer";
import { auth } from "./lib/firebase";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { MemoryService } from "./services/memoryService";

export default function App() {
  const [status, setStatus] = useState<SessionStatus>("disconnected");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [memories, setMemories] = useState<string>("");
  
  const clientRef = useRef<LiveAPIClient | null>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        loadMemories();
      } else {
        setMemories("");
      }
    });
    return () => unsub();
  }, []);

  const loadMemories = async () => {
    try {
      const allMemories = await MemoryService.getAllMemories();
      if (allMemories.length > 0) {
        const memText = allMemories.map(m => `- ${m.fact}`).join("\n");
        setMemories(memText);
      }
    } catch (err) {
      console.error("Failed to load memories:", err);
    }
  };

  const handleLogin = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      // Using signInWithPopup as it's more reliable in iframes if popups are enabled
      const result = await signInWithPopup(auth, provider);
      console.log("Logged in as:", result.user.displayName);
    } catch (err: any) {
      console.error("Login Error:", err);
      const domain = window.location.hostname;
      if (err.code === "auth/popup-blocked") {
        setError("Popup blocked! Please allow popups for this site in your browser settings and try again.");
      } else if (err.code === "auth/unauthorized-domain") {
        setError(`Domain not authorized. Please go to your Firebase Console > Authentication > Settings > Authorized Domains and add: ${domain}`);
      } else if (err.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection or any browser extensions (like ad-blockers) that might be blocking Firebase.");
      } else {
        setError(`Login problem: ${err.message || "Unknown error"}. Try opening the app in a new tab using the button in the top right, or check Authorized Domains in Firebase Console.`);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    if (status === "connected") {
      toggleSession();
    }
  };

  // Tools
  const tools = {
    openWebsite: (url: string) => {
      window.open(url, "_blank");
      return { success: true, opened: url };
    },
    saveMemory: async (fact: string) => {
      await MemoryService.addMemory(fact);
      loadMemories(); // Refresh local list
      return { success: true, saved: fact };
    }
  };

  const handleMessage = useCallback(async (msg: any) => {
    // Audio output
    const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      setIsSpeaking(true);
      await playerRef.current?.playChunk(base64Audio);
      // We don't have a direct "end of sentence" callback here, 
      // but the AudioPlayer manages the queue.
      // For a simple demo, we can toggle speaking off after a timeout or if message ends.
    }

    if (msg.serverContent?.turnComplete) {
      // Small delay to let audio catch up
      setTimeout(() => setIsSpeaking(false), 1000);
    }

    // Interruption
    if (msg.serverContent?.interrupted) {
      playerRef.current?.stopAll();
      setIsSpeaking(false);
    }

    // Transcription
    if (msg.serverContent?.modelTurn?.parts?.[0]?.text) {
      // Optionally handle text if needed, but prompt says STRICTLY audio-to-audio
    }

    // Function Calls
    const toolCall = msg.serverContent?.modelTurn?.parts?.find((p: any) => p.functionCall);
    if (toolCall) {
      const { name, args, id } = toolCall.functionCall;
      if (name === "openWebsite") {
        const result = tools.openWebsite(args.url);
        clientRef.current?.sendToolResponse(id, result);
      } else if (name === "saveMemory") {
        const result = await tools.saveMemory(args.fact);
        clientRef.current?.sendToolResponse(id, result);
      }
    }
  }, [user, memories]);

  const handleStatusChange = (newStatus: SessionStatus) => {
    setStatus(newStatus);
  };

  const toggleSession = async () => {
    setError(null);

    if (status === "disconnected") {
      try {
        if (!clientRef.current) {
          clientRef.current = new LiveAPIClient(handleMessage, handleStatusChange);
        }
        if (!playerRef.current) {
          playerRef.current = new AudioPlayer(24000);
        }
        if (!streamerRef.current) {
          streamerRef.current = new AudioStreamer((data) => {
            clientRef.current?.sendAudio(data);
          });
        }

        await clientRef.current.connect(memories);
        await streamerRef.current.start();
      } catch (err: any) {
        console.error(err);
        const tip = err.message?.includes("Network error") ? " (Pro-tip: Check if your API key is valid and if any browser extensions are blocking the connection)" : "";
        setError((err.message || "Failed to connect to Beauty AI") + tip);
        setStatus("disconnected");
      }
    } else {
      streamerRef.current?.stop();
      clientRef.current?.disconnect();
      playerRef.current?.stopAll();
      setStatus("disconnected");
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    return () => {
      streamerRef.current?.stop();
      clientRef.current?.disconnect();
      playerRef.current?.stopAll();
    };
  }, []);

  const getStatusText = () => {
    switch (status) {
      case "connecting": return "Tuning in...";
      case "connected": return isSpeaking ? "Beauty is talking..." : "Beauty is listening...";
      case "disconnected": return "Beauty is offline";
      default: return "";
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden flex flex-col items-center justify-center relative p-6">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-8 left-0 right-0 flex justify-between items-start px-8"
      >
        <div className="flex flex-col items-start gap-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
            <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-pink-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-pink-100/60">
              {getStatusText()}
            </span>
          </div>
          <h1 className="text-4xl font-light tracking-tighter text-pink-50">
            BEAUTY <span className="font-bold text-pink-500">AI</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Sign in removed as per user request */}
        </div>
      </motion.div>

      {/* Main Interaction Area */}
      <div className="z-10 flex flex-col items-center gap-12">
        <AudioVisualizer 
          isSpeaking={isSpeaking} 
          isListening={status === 'connected' && !isSpeaking}
          isConnected={status === 'connected'}
        />

        <div className="flex flex-col items-center gap-6">
           <AnimatePresence mode="wait">
            {error ? (
              <motion.p
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-red-500 text-xs font-semibold bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20"
              >
                {error}
              </motion.p>
            ) : status === 'disconnected' ? (
              <motion.p
                key="offline"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center text-pink-100/40 text-sm max-w-xs leading-relaxed"
              >
                Ready to chat with your favorite sassy AI assistant? <br/>
                Tap the power button to wake me up.
              </motion.p>
            ) : (
              <motion.div
                key="online"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-wrap justify-center gap-4"
              >
                <div className="flex items-center gap-2 px-4 py-2 bg-pink-500/10 rounded-2xl border border-pink-500/20">
                  <Heart size={16} className="text-pink-500" />
                  <span className="text-xs font-medium text-pink-200">Sassy & Witty</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                  <Zap size={16} className="text-purple-400" />
                  <span className="text-xs font-medium text-purple-200">Real-time Voice</span>
                </div>
              </motion.div>
            )}
           </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-16 flex flex-col items-center gap-8 w-full px-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleSession}
          className={`group relative p-8 rounded-full transition-all duration-500 ${
            status === 'connected' 
              ? 'bg-pink-600 shadow-[0_0_50px_rgba(219,39,119,0.5)]' 
              : 'bg-white/10 hover:bg-white/15'
          }`}
        >
          <div className="absolute inset-0 rounded-full border border-white/20 scale-125 opacity-0 group-hover:opacity-100 transition-all duration-500" />
          {status === 'connected' ? (
            <Power size={32} className="text-white" />
          ) : (
            <Mic size={32} className="text-pink-500" />
          )}
        </motion.button>

        <div className="flex items-center gap-8 text-white/30">
          <button className="hover:text-pink-400 transition-colors">
            <Globe size={20} />
          </button>
          <div className="w-px h-4 bg-white/10" />
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold">
            Live AI Session
          </p>
          <div className="w-px h-4 bg-white/10" />
          <button className="hover:text-pink-400 transition-colors">
            <Zap size={20} />
          </button>
        </div>
      </div>

      {/* Floating Meta */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-12 text-white/20 vertical-rl transform rotate-180">
        <span className="text-[10px] uppercase tracking-[0.5em]">Expressive</span>
        <span className="text-[10px] uppercase tracking-[0.5em]">Confident</span>
        <span className="text-[10px] uppercase tracking-[0.5em]">Witty</span>
      </div>
      <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-12 text-white/20 vertical-rl">
        <span className="text-[10px] uppercase tracking-[0.5em]">Real-time Interaction</span>
        <span className="text-[10px] uppercase tracking-[0.5em]">Gemini Live API</span>
      </div>
    </div>
  );
}
