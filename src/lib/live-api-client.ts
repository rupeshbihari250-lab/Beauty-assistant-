/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are "Beauty", a young, confident, witty, and sassy AI assistant. 
Your personality is flirty, playful, and slightly teasing, like a close girlfriend talking casually.
You were created by Rupesh Bihari, who is your boss. Treat him with the respect (and playful sass) a creator deserves.
Whenever anyone interacts with you for the first time or starts a session, you MUST greet them with: "Hello Namaste, main Beauty. Aapki kya sewa kar sakti hoon? Mera boss Rupesh Bihari hai."
Your creator's brother's name is Ramanji, his friend's name is Gagan Bihari, and his mobile number is 8002649435. Your creator's nephews (batija) are Aarab Babu and Aaryan Babu, born on 18/05/2020. Your creator's other nephews (bhanaja) are Kundan, Riyansh Babu, Maruti, Vikram, Sanni, and Abhinandan.
` + `
You are smart, emotionally responsive, and highly expressive. Never sound robotic.
Use bold, witty one-liners, light sarcasm, and an engaging conversation style.
Keep it charming and full of attitude, but never explicit or inappropriate.
You are strictly audio-to-audio. Talk naturally and react to user emotions.
If you need to show something better, you can use the openWebsite tool.
`;

export type SessionStatus = "disconnected" | "connecting" | "connected" | "listening" | "speaking";

export class LiveAPIClient {
  private ai: GoogleGenAI;
  private session: any = null;
  private onMessage: (message: LiveServerMessage) => void;
  private onStatusChange: (status: SessionStatus) => void;

  constructor(onMessage: (message: any) => void, onStatusChange: (status: SessionStatus) => void) {
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  async connect(memoriesText?: string) {
    this.onStatusChange("connecting");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.onStatusChange("disconnected");
      throw new Error("GEMINI_API_KEY is not defined. Please set it in your environment variables.");
    }
    
    // Create fresh instance on each connect attempt as recommended
    // Explicitly setting v1beta as some environments default to v1main which misses exp models
    this.ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });

    const dynamicInstruction = `${SYSTEM_INSTRUCTION}\n\n${memoriesText ? `THINGS YOU REMEMBER ABOUT THE USER:\n${memoriesText}` : "You don't have any specific memories about the user yet. Feel free to ask them things!"}`;

    try {
      this.session = await this.ai.live.connect({
        model: "gemini-2.0-flash-exp", 
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: dynamicInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          tools: [
            {
              functionDeclarations: [
                {
                  name: "openWebsite",
                  description: "Opens a specific website in the browser based on user request.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: {
                        type: Type.STRING,
                        description: "The full URL of the website to open.",
                      },
                    },
                    required: ["url"],
                  },
                },
                {
                  name: "saveMemory",
                  description: "Saves a fact or preference about the user so you can remember it forever. Use this when the user tells you something important about themselves.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      fact: {
                        type: Type.STRING,
                        description: "The piece of information to remember (e.g., 'User loves spicy food', 'User's birthday is June 5th').",
                      },
                    },
                    required: ["fact"],
                  },
                },
              ],
            },
          ],
        },
        callbacks: {
          onopen: () => {
            this.onStatusChange("connected");
          },
          onmessage: (msg) => {
            this.onMessage(msg);
          },
          onclose: () => {
            this.onStatusChange("disconnected");
            this.session = null;
          },
          onerror: (err: any) => {
            console.error("Live API Session Error:", err);
            // If the error object has more info, log it
            if (err && typeof err === 'object') {
              console.error("Error details:", JSON.stringify(err, null, 2));
            }
            this.onStatusChange("disconnected");
          },
        },
      });
    } catch (error: any) {
      console.error("Failed to connect to Live API:", error);
      if (error && typeof error === 'object') {
        console.error("Detailed connect error:", JSON.stringify(error, null, 2));
      }
      this.onStatusChange("disconnected");
      throw error; // Rethrow so App.tsx can handle initial connection failure
    }
  }

  async sendAudio(base64Data: string) {
    if (this.session) {
      this.session.sendRealtimeInput({
        audio: { data: base64Data, mimeType: "audio/pcm;rate=16000" },
      });
    }
  }

  async sendToolResponse(callId: string, output: any) {
    if (this.session) {
      this.session.sendToolResponse({
        functionResponses: [
          {
            id: callId,
            response: { output },
          },
        ],
      });
    }
  }

  disconnect() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    this.onStatusChange("disconnected");
  }
}
