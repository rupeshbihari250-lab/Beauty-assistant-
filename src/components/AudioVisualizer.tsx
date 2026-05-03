/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";

interface AudioVisualizerProps {
  isSpeaking: boolean;
  isListening: boolean;
  isConnected: boolean;
}

export default function AudioVisualizer({ isSpeaking, isListening, isConnected }: AudioVisualizerProps) {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {/* Outer Pulse */}
      {isConnected && (
        <motion.div
          animate={{
            scale: isSpeaking || isListening ? [1, 1.2, 1] : 1,
            opacity: isSpeaking || isListening ? [0.3, 0.6, 0.3] : 0.2,
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute w-full h-full rounded-full bg-pink-500/20 blur-3xl"
        />
      )}

      {/* Main Core */}
      <motion.div
        animate={{
          scale: isSpeaking ? [1, 1.1, 1] : isListening ? [0.95, 1.05, 0.95] : 1,
          boxShadow: isConnected 
            ? "0 0 40px rgba(236, 72, 153, 0.4)" 
            : "0 0 10px rgba(156, 163, 175, 0.2)",
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`w-40 h-40 rounded-full border-2 flex items-center justify-center relative overflow-hidden ${
          isConnected ? "border-pink-500/50 bg-black/40" : "border-gray-700 bg-gray-900/40"
        }`}
      >
        {/* Waveform Mockup */}
        <div className="flex gap-1 h-12 items-center">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                height: isSpeaking || isListening ? [10, 40, 10] : 4,
              }}
              transition={{
                duration: 0.5 + Math.random() * 0.5,
                repeat: Infinity,
                delay: i * 0.1,
              }}
              className={`w-1 rounded-full ${isConnected ? "bg-pink-400" : "bg-gray-600"}`}
            />
          ))}
        </div>
      </motion.div>

      {/* Decorative Rings */}
      <div className={`absolute w-48 h-48 rounded-full border border-pink-500/10 ${isConnected ? "animate-pulse" : ""}`} />
      <div className={`absolute w-56 h-56 rounded-full border border-pink-500/5 ${isConnected ? "animate-reverse-spin" : ""}`} style={{ animationDuration: '10s' }} />
    </div>
  );
}
