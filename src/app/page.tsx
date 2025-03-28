// src/app/page.tsx
"use client";

import React, { useState } from "react";
import { Header } from "./_components/header";
import { MessageList } from "./_components/message-list";
import { ChatInput } from "./_components/chat-input";
import { Message } from "./_components/message-item"; // Interface updated (no audioDuration)
import { useLocalStorage } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const REPORT_START_MARKER = "--- REPORT START ---";
const REPORT_END_MARKER = "--- REPORT END ---";

export default function ChatPage() {
  // Correct useLocalStorage call with key and initial value
  const [messages, setMessages] = useLocalStorage<Message[]>(
    "my-docta-chat-session", // Key
    []                        // Initial Value
  );

  const [isLoading, setIsLoading] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [isReportVisible, setIsReportVisible] = useState(false);

  // Handler for image selection - Calls sendMultimodalMessage
  const handleImageSelect = (file: File) => {
    console.log(`>>> handleImageSelect triggered at ${Date.now()} for file: ${file.name}`);
    if (isLoading) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const imageDataUrl = event.target?.result as string;
      if (!imageDataUrl) { alert("Failed to read image data."); return; }
      sendMultimodalMessage({ imageDataUrl }); // Send just image data
    };
    reader.onerror = (error) => { console.error("Error reading file:", error); alert("Error reading image file."); };
  };

  // Handler for audio data (no duration) - Calls sendMultimodalMessage
  const handleSendAudio = (audioDataUrl: string, mimeType: string) => {
    console.log(`>>> handleSendAudio triggered at ${Date.now()} with type: ${mimeType}`);
    if (isLoading) return;
    sendMultimodalMessage({
      audioDataUrl: audioDataUrl
      // No placeholder text needed now as MessageItem handles audio display
    });
  };


  // Consolidated function to send message (text, image, OR audio)
  const sendMultimodalMessage = async (
    // No audioDuration in payload type
    payload: { text?: string; imageDataUrl?: string; audioDataUrl?: string }
  ) => {
    // No audioDuration to destructure
    const { text, imageDataUrl, audioDataUrl } = payload;
    console.log(`>>> sendMultimodalMessage triggered with image: ${!!imageDataUrl}, audio: ${!!audioDataUrl}`);

    // Basic validation
    if (!text?.trim() && !imageDataUrl && !audioDataUrl || isLoading) return;
    setIsLoading(true);

    // Create user message object (no audioDuration)
    const messageId = crypto.randomUUID();
    const newUserMessage: Message = {
      id: messageId,
      text: text || "", // Default to empty string if only media sent
      imageUrl: imageDataUrl,
      audioDataUrl: audioDataUrl, // Store audio data URL
      // audioDuration: undefined, // REMOVED
      sender: 'user', timestamp: new Date(), status: 'sent'
    };

    // Create thinking message object
    const thinkingMessageId = crypto.randomUUID();
    const thinkingMessage: Message = {
      id: thinkingMessageId,
      text: imageDataUrl ? "Processing image..." : (audioDataUrl ? "Processing audio..." : "Thinking..."),
      sender: "ai", timestamp: new Date(), status: 'loading'
    };

    // Chain state updates using functional form
    setMessages(prev => [...prev, newUserMessage]);
    setMessages(prev => [...prev, thinkingMessage]);

    // Prepare history based on the state *before* initiating the updates
    const historyToSend = messages
      .filter(msg => msg.text && (msg.status === undefined || ['sent', 'received'].includes(msg.status)))
      .map(({ id, text, sender }) => ({ id, text, sender }));

    try {
      // API Call (no audioDuration sent)
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: newUserMessage.text, // Send text (might be empty)
          imageDataUrl: imageDataUrl,
          audioDataUrl: audioDataUrl, // Send audio data
          history: historyToSend
        }),
      });

      // Process Response
      setMessages(prev => prev.filter((msg) => msg.id !== thinkingMessageId)); // Remove thinking

      if (!response.ok) {
        let errorMsg = `API request failed: ${response.statusText} (${response.status})`;
        try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (parseError) { }
        throw new Error(errorMsg);
      }

      const result = await response.json();
      const aiResponseText = result.response;

      if (aiResponseText) {
        // Handle report or regular message
        const reportStartIndex = aiResponseText.indexOf(REPORT_START_MARKER);
        const reportEndIndex = aiResponseText.indexOf(REPORT_END_MARKER);

        if (reportStartIndex !== -1 && reportEndIndex !== -1 && reportEndIndex > reportStartIndex) {
          // Extract and display report parts
          const regularResponse = aiResponseText.substring(0, reportStartIndex).trim();
          const extractedReport = aiResponseText.substring(reportStartIndex + REPORT_START_MARKER.length, reportEndIndex).trim();
          const postReportText = aiResponseText.substring(reportEndIndex + REPORT_END_MARKER.length).trim();
          setReportContent(extractedReport);
          setIsReportVisible(false);
          if (regularResponse) { const preMsg: Message = { id: crypto.randomUUID(), text: regularResponse, sender: "ai", timestamp: new Date(), status: 'received' }; setMessages(prev => [...prev, preMsg]); }
          if (postReportText) { const postMsg: Message = { id: crypto.randomUUID(), text: postReportText, sender: "ai", timestamp: new Date(), status: 'received' }; setMessages(prev => [...prev, postMsg]); }
        } else {
          // Add regular AI message
          setReportContent(null);
          const aiResponseMessage: Message = { id: crypto.randomUUID(), text: aiResponseText, sender: "ai", timestamp: new Date(), status: 'received' };
          setMessages(prev => [...prev, aiResponseMessage]);
        }
      } else {
        // Handle case where API gives 200 OK but no response text
        throw new Error("Received an empty response from the AI.");
      }

    } catch (error) {
      // Handle errors
      console.error("Error sending/getting AI response:", error);
      setMessages(prev => prev.filter((msg) => msg.id !== thinkingMessageId)); // Remove thinking
      const errorMessage: Message = { id: crypto.randomUUID(), text: `Sorry, error: ${error instanceof Error ? error.message : "Unknown error"}`, sender: "ai", timestamp: new Date(), status: 'error' };
      setMessages(prev => [...prev, errorMessage]); // Add error message
    } finally {
      setIsLoading(false);
    }
  };

  // handleSendMessage now just sends text via the consolidated function
  const handleSendMessage = (text: string) => {
    sendMultimodalMessage({ text });
  };

  // New Session Handler
  const handleNewSession = () => {
    if (confirm("Are you sure you want to start a new session? This will clear the current chat and report.")) {
      setMessages([]); // Clears state and localStorage via the hook
      setReportContent(null);
      setIsReportVisible(false);
    }
  };

  // Component Render
  return (
    <div className="flex flex-col h-screen bg-background">
      <Header onNewSession={handleNewSession} />

      {/* Ensure MessageList receives the up-to-date messages */}
      <MessageList messages={messages} />

      {/* Report Display Area */}
      {reportContent && (
        <div className="container max-w-6xl p-4 border-t">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">Consultation Summary</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsReportVisible(!isReportVisible)}> {isReportVisible ? "Hide" : "Show"} Report </Button>
          </div>
          {isReportVisible && (
            <div className="p-4 bg-muted/50 rounded-md border">
              <pre className="text-sm whitespace-pre-wrap font-sans">
                {reportContent}
              </pre>
            </div>
          )}
          <Separator className="my-4" />
        </div>
      )}

      {/* Chat Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        // onAudioInteraction={handleAudio} // Removed if unused
        onImageSelect={handleImageSelect}
        onSendAudio={handleSendAudio} // Pass updated audio handler
        isLoading={isLoading} // Pass loading state to disable input
      />
    </div>
  );
}