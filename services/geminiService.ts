
import { GoogleGenAI, Modality, Type } from "@google/genai";

export class GeminiService {
  /**
   * Generates audio for text using Gemini TTS.
   */
  async speak(text: string): Promise<string | undefined> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' },
            },
          },
        },
      });

      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (error) {
      console.error("Gemini TTS Error:", error);
      return undefined;
    }
  }

  /**
   * Generates a mascot image for a task.
   */
  async generateTaskImage(taskTitle: string): Promise<string | undefined> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `Create a fun, cute Pixar-style mascot related to: "${taskTitle}". Encouraging for ADHD. White background.`,
            },
          ],
        },
      });
      
      const parts = response.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
      return undefined;
    } catch (error) {
      console.error("Gemini Image Error:", error);
      return undefined;
    }
  }

  /**
   * Parses natural language task input into structured data.
   * Added timeSpecified flag to detect if the user provided a timeframe.
   */
  async parseTaskInput(input: string): Promise<{ title: string; minutesFromNow: number; timeSpecified: boolean }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract the task name and the time (in minutes from now) from: "${input}". 
                 If no time or date is specified (e.g. just "wash dishes"), set timeSpecified to false. 
                 Return JSON: {"title": "walk the dog", "minutesFromNow": 5, "timeSpecified": true}.`,
      config: {
        responseMimeType: "application/json"
      }
    });

    try {
      return JSON.parse(response.text || '{"title": "Untitled Task", "minutesFromNow": 0, "timeSpecified": false}');
    } catch {
      return { title: input, minutesFromNow: 0, timeSpecified: false };
    }
  }

  /**
   * Breaks down complex tasks.
   */
  async decomposeTask(taskTitle: string): Promise<string[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Break down: "${taskTitle}" into 3 actionable sub-tasks. Return JSON array of strings.`,
        config: {
          responseMimeType: "application/json"
        }
      });
      return JSON.parse(response.text || '[]');
    } catch (e) {
      return [];
    }
  }

  /**
   * Assigns category and priority.
   */
  async smartPrioritize(tasks: { id: string; title: string }[]): Promise<{ id: string; category: string; priority: number }[]> {
    if (tasks.length === 0) return [];
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Categorize and rank these tasks (1=Urgent, 3=Flexible): ${JSON.stringify(tasks)}. Return JSON array.`,
        config: {
          responseMimeType: "application/json"
        }
      });
      return JSON.parse(response.text || '[]');
    } catch (e) {
      return [];
    }
  }
}

export const geminiService = new GeminiService();
