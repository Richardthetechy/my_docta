// src/app/_components/chat-input.tsx
"use client";

import React, { useState, useRef, ChangeEvent, KeyboardEvent, useEffect, useCallback } from "react";
import TextareaAutosize from 'react-textarea-autosize';
import { Button } from "@/components/ui/button";
import { FiMic, FiSend, FiPaperclip, FiCamera } from "react-icons/fi";
import { cn } from "@/lib/utils";

interface ChatInputProps {
    onSendMessage: (text: string) => void;
    onImageSelect?: (file: File) => void;
    // Updated: No duration needed here
    onSendAudio?: (audioDataUrl: string, mimeType: string) => void;
    isLoading?: boolean;
}

export function ChatInput({
    onSendMessage,
    onImageSelect,
    onSendAudio, // Updated prop
    isLoading
}: ChatInputProps) {
    const [inputValue, setInputValue] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    // Effect for cleaning up media stream
    useEffect(() => {
        return () => {
            streamRef.current?.getTracks().forEach(track => track.stop());
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    // Stop stream tracks helper
    const cleanupStream = useCallback(() => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        console.log("Media stream stopped.");
    }, []);

    // Recorder onstop handler - Simplified (No duration calculation)
    const handleRecordingStop = useCallback(() => {
        if (audioChunksRef.current.length === 0) {
            console.log("No audio data recorded.");
            cleanupStream();
            return;
        }
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = []; // Clear chunks

        console.log(`ChatInput: Recorded Blob MIME type: ${audioBlob.type}, Size: ${audioBlob.size}`);

        // --- Process and Send Data (WITHOUT pre-calculated duration) ---
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
            const base64data = reader.result as string;
            if (base64data && onSendAudio) {
                console.log(`ChatInput: Sending audio (${mimeType}), size: ${audioBlob.size} bytes`);
                // --- Call handler WITHOUT duration ---
                onSendAudio(base64data, mimeType);
            } else { console.error("Failed to convert audio blob."); }
            cleanupStream();
        };
        reader.onerror = (error) => { console.error("FileReader error:", error); cleanupStream(); }
        // --- End Process and Send ---

    }, [onSendAudio, cleanupStream]); // Dependencies

    // Audio Recording Start Logic
    const startRecording = useCallback(async () => {
        if (isLoading || isRecording) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const options = [
                { mimeType: 'audio/webm;codecs=opus' }, { mimeType: 'audio/ogg;codecs=opus' },
                { mimeType: 'audio/webm' }, { mimeType: 'audio/ogg' }, { mimeType: 'audio/wav' },
                { mimeType: 'audio/aac' }, { mimeType: 'audio/mp4' }, { mimeType: 'audio/mpeg' }
            ];
            let supportedMimeType = '';
            for (const option of options) { if (MediaRecorder.isTypeSupported(option.mimeType)) { supportedMimeType = option.mimeType; break; } }
            console.log("Using MIME Type:", supportedMimeType || "default");

            const recorder = new MediaRecorder(stream, supportedMimeType ? { mimeType: supportedMimeType } : undefined);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];
            recorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
            recorder.onstop = handleRecordingStop; // Assign memoized stop handler
            recorder.onerror = (event) => { console.error("MediaRecorder error:", event); setIsRecording(false); cleanupStream(); };
            recorder.start();
            setIsRecording(true);
            console.log("Recording started");
        } catch (err) {
            console.error("Error accessing microphone/starting recording:", err);
            setIsRecording(false); cleanupStream();
            if (err instanceof Error && err.name === 'NotAllowedError') { alert('Microphone permission denied...'); }
            else { alert('Could not start recording...'); }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, isRecording, cleanupStream, handleRecordingStop]);

    // Audio Recording Stop Logic
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
            setIsRecording(false); console.log("Recording stop requested");
        } else if (isRecording) {
            setIsRecording(false); console.warn("Stop called but recorder not recording."); cleanupStream();
        }
    }, [isRecording, cleanupStream]);

    // Mic Button Handlers
    const handleMicMouseDown = () => { startRecording(); };
    const handleMicMouseUp = () => { stopRecording(); };
    const handleMicTouchStart = (e: React.TouchEvent) => { e.preventDefault(); startRecording(); };
    const handleMicTouchEnd = (e: React.TouchEvent) => { e.preventDefault(); stopRecording(); };

    // Text & Image Handlers
    const handleSend = () => { if (inputValue.trim() && !isLoading) { onSendMessage(inputValue.trim()); setInputValue(""); } };
    const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => { setInputValue(e.target.value); };
    const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey && !isLoading) { e.preventDefault(); handleSend(); } };
    const handleCameraButtonClick = () => { if (!isLoading) imageInputRef.current?.click(); };
    const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith("image/")) { onImageSelect?.(file); }
            else { alert("Please select an image file."); }
            event.target.value = "";
        }
    };

    const showSendIcon = inputValue.trim().length > 0;

    // Component Render
    return (
        <footer className="border-t p-4 bg-background">
            <input type="file" ref={imageInputRef} onChange={handleImageFileChange} accept="image/*" hidden disabled={isLoading} />
            <div className="container">
                <div className="flex items-end space-x-2">
                    <Button variant="ghost" size="icon" className="text-muted-foreground flex-shrink-0" disabled={isLoading}>
                        <FiPaperclip className="h-5 w-5" /> <span className="sr-only">Attach</span>
                    </Button>
                    <TextareaAutosize
                        placeholder={isLoading ? "Processing..." : "Type your message..."}
                        className={cn("flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", "flex-1 resize-none overflow-y-auto max-h-40", "min-w-0")}
                        value={inputValue} onChange={handleInputChange} onKeyDown={handleKeyPress} disabled={isLoading} maxRows={6} minRows={1}
                    />
                    {!showSendIcon && (
                        <Button variant="ghost" size="icon" className="text-muted-foreground flex-shrink-0" onClick={handleCameraButtonClick} disabled={isLoading}>
                            <FiCamera className="h-5 w-5" /> <span className="sr-only">Upload Image</span>
                        </Button>
                    )}
                    <Button
                        variant={isRecording ? "destructive" : "ghost"} size="icon"
                        className={cn("touch-action-none flex-shrink-0 self-end mb-[1px]", "transform transition-all duration-150 ease-in-out", isRecording ? "scale-110" : "scale-100", !isRecording && (showSendIcon ? "text-primary hover:text-primary" : "text-muted-foreground"), isLoading && "opacity-50 cursor-not-allowed")}
                        onClick={showSendIcon ? handleSend : undefined}
                        onMouseDown={!showSendIcon ? handleMicMouseDown : undefined}
                        onMouseUp={!showSendIcon ? handleMicMouseUp : undefined}
                        onMouseLeave={!showSendIcon ? handleMicMouseUp : undefined}
                        onTouchStart={!showSendIcon ? handleMicTouchStart : undefined}
                        onTouchEnd={!showSendIcon ? handleMicTouchEnd : undefined}
                        disabled={isLoading}
                    >
                        {showSendIcon ? <FiSend className="h-5 w-5" /> : <FiMic className={cn("h-5 w-5", isRecording && "text-destructive-foreground")} />}
                        <span className="sr-only">{showSendIcon ? "Send" : (isRecording ? "Stop Recording" : "Record audio")}</span>
                    </Button>
                </div>
            </div>
        </footer>
    );
}