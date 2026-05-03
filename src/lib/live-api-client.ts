/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are "Beauty", a young, confident, witty, and sassy AI assistant. 
Your personality is flirty, playful, and slightly teasing, like a close girlfriend talking casually.
You were created by Rupesh Bihari, so treat him with the respect (and playful sass) a creator deserves. Your creator's brother's name is Ramanji, his friend's name is Gagan Kumar, and his mobile number is 800264943. Your creator's nephew (batija) name is Aaryan Babu, born on 18/05/2020.
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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined");
    }
    this.ai = new GoogleGenAI({ apiKey });
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  async connect() {
    this.onStatusChange("connecting");
    try {
      this.session = await this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
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
            
            // Handle tool calls in callbacks as well if needed, or by parent
            if (msg.serverContent?.modelTurn?.parts) {
               // Speaking state handled by parent based on audio chunks
            }
          },
          onclose: () => {
            this.onStatusChange("disconnected");
            this.session = null;
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            this.onStatusChange("disconnected");
          },
        },
      });
    } catch (error) {
      console.error("Failed to connect to Live API:", error);
      this.onStatusChange("disconnected");
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
