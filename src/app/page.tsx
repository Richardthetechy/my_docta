// src/app/page.tsx
"use client";

import React, { useState } from "react";
import { Header } from "./_components/header";
import { MessageList } from "./_components/message-list";
import { ChatInput } from "./_components/chat-input";
import { Message } from "./_components/message-item";
import { useLocalStorage } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const REPORT_START_MARKER = "--- REPORT START ---";
const REPORT_END_MARKER = "--- REPORT END ---";

export default function ChatPage() {
  const [messages, setMessages] = useLocalStorage<Message[]>(
    "my-docta-chat-session",
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [isReportVisible, setIsReportVisible] = useState(false);

  // Handler for image selection
  const handleImageSelect = (file: File) => {
    console.log(`>>> handleImageSelect triggered at ${Date.now()} for file: ${file.name}`);
    if (isLoading) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const imageDataUrl = event.target?.result as string;
      if (!imageDataUrl) { alert("Failed to read image data."); return; }
      sendMultimodalMessage({ imageDataUrl });
    };
    reader.onerror = (error) => { console.error("Error reading file:", error); alert("Error reading image file."); };
  };

  // Handler for audio data
  const handleSendAudio = (audioDataUrl: string, mimeType: string) => {
    console.log(`>>> handleSendAudio triggered at ${Date.now()} with type: ${mimeType}`);
    if (isLoading) return;
    sendMultimodalMessage({ audioDataUrl: audioDataUrl });
  };

  // Consolidated function to send message
  const sendMultimodalMessage = async (
    payload: { text?: string; imageDataUrl?: string; audioDataUrl?: string }
  ) => {
    const { text, imageDataUrl, audioDataUrl } = payload;
    console.log(`>>> sendMultimodalMessage triggered with image: ${!!imageDataUrl}, audio: ${!!audioDataUrl}`);

    if (!text?.trim() && !imageDataUrl && !audioDataUrl || isLoading) return;
    setIsLoading(true);

    const messageId = crypto.randomUUID();
    const newUserMessage: Message = {
      id: messageId, text: text || "", imageUrl: imageDataUrl, audioDataUrl: audioDataUrl,
      sender: 'user', timestamp: new Date(), status: 'sent'
    };
    const thinkingMessageId = crypto.randomUUID();
    const thinkingMessage: Message = {
      id: thinkingMessageId, text: imageDataUrl ? "Processing image..." : (audioDataUrl ? "Processing audio..." : "Thinking..."),
      sender: "ai", timestamp: new Date(), status: 'loading'
    };

    setMessages(prev => [...prev, newUserMessage]);
    setMessages(prev => [...prev, thinkingMessage]);

    const historyToSend = messages
      .filter(msg => msg.text && (msg.status === undefined || ['sent', 'received'].includes(msg.status)))
      .map(({ id, text, sender }) => ({ id, text, sender }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: newUserMessage.text, imageDataUrl, audioDataUrl, history: historyToSend }),
      });

      setMessages(prev => prev.filter((msg) => msg.id !== thinkingMessageId));

      if (!response.ok) {
        let errorMsg = `API request failed: ${response.statusText} (${response.status})`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
          // --- Removed unused parseError variable ---
        } catch {
          console.warn("Could not parse error JSON response body");
        }
        // --- End Change ---
        throw new Error(errorMsg);
      }

      const result = await response.json();
      const aiResponseText = result.response;

      if (aiResponseText) {
        const reportStartIndex = aiResponseText.indexOf(REPORT_START_MARKER);
        const reportEndIndex = aiResponseText.indexOf(REPORT_END_MARKER);
        if (reportStartIndex !== -1 && reportEndIndex !== -1 && reportEndIndex > reportStartIndex) {
          const regularResponse = aiResponseText.substring(0, reportStartIndex).trim();
          const extractedReport = aiResponseText.substring(reportStartIndex + REPORT_START_MARKER.length, reportEndIndex).trim();
          const postReportText = aiResponseText.substring(reportEndIndex + REPORT_END_MARKER.length).trim();
          setReportContent(extractedReport);
          setIsReportVisible(false);
          if (regularResponse) { const preMsg: Message = { id: crypto.randomUUID(), text: regularResponse, sender: "ai", timestamp: new Date(), status: 'received' }; setMessages(prev => [...prev, preMsg]); }
          if (postReportText) { const postMsg: Message = { id: crypto.randomUUID(), text: postReportText, sender: "ai", timestamp: new Date(), status: 'received' }; setMessages(prev => [...prev, postMsg]); }
        } else {
          setReportContent(null);
          const aiResponseMessage: Message = { id: crypto.randomUUID(), text: aiResponseText, sender: "ai", timestamp: new Date(), status: 'received' };
          setMessages(prev => [...prev, aiResponseMessage]);
        }
      } else { throw new Error("Received an empty response from the AI."); }

    } catch (error) {
      console.error("Error sending/getting AI response:", error);
      setMessages(prev => prev.filter((msg) => msg.id !== thinkingMessageId));
      const errorMessage: Message = { id: crypto.randomUUID(), text: `Sorry, error: ${error instanceof Error ? error.message : "Unknown error"}`, sender: "ai", timestamp: new Date(), status: 'error' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = (text: string) => { sendMultimodalMessage({ text }); };
  const handleNewSession = () => { if (confirm("Are you sure? This clears chat and report.")) { setMessages([]); setReportContent(null); setIsReportVisible(false); } };

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header onNewSession={handleNewSession} />
      <MessageList messages={messages} />
      {reportContent && (
        <div className="container max-w-6xl p-4 border-t">
          <div className="flex justify-between items-center mb-2"> <h3 className="text-lg font-semibold">Consultation Summary</h3> <Button variant="ghost" size="sm" onClick={() => setIsReportVisible(!isReportVisible)}> {isReportVisible ? "Hide" : "Show"} Report </Button> </div>
          {isReportVisible && (<div className="p-4 bg-muted/50 rounded-md border"> <pre className="text-sm whitespace-pre-wrap font-sans"> {reportContent} </pre> </div>)}
          <Separator className="my-4" />
        </div>
      )}
      <ChatInput onSendMessage={handleSendMessage} onImageSelect={handleImageSelect} onSendAudio={handleSendAudio} isLoading={isLoading} />
    </div>
  );
}