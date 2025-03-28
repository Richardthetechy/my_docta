// src/app/_components/message-item.tsx
import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { AudioPlayer } from "./AudioPlayer"; // Ensure this path is correct

export interface Message {
    id: string;
    text?: string;
    imageUrl?: string;
    audioDataUrl?: string; // URL for audio playback
    // audioDuration?: number; // REMOVED
    sender: "user" | "ai";
    timestamp?: Date;
    status?: 'loading' | 'received' | 'error' | 'sent' | 'uploading' | 'uploaded' | 'failed';
}

interface MessageItemProps {
    message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
    const isUser = message.sender === "user";
    const isLoading = message.status === 'loading';
    const isError = message.status === 'error';
    const hasText = !!message.text;
    const hasImage = !!message.imageUrl;
    const hasAudio = !!message.audioDataUrl;

    return (
        <div
            className={cn(
                "flex items-end space-x-2", // Base flex layout
                isUser ? "justify-end" : "justify-start" // Align left/right
            )}
        >
            {/* AI Avatar */}
            {!isUser && (
                <Avatar className="h-8 w-8 flex-shrink-0 self-end">
                    <AvatarImage src="/bot.jpg" alt="AI Avatar" />
                    <AvatarFallback>AI</AvatarFallback>
                </Avatar>
            )}

            {/* Message Bubble */}
            <div
                className={cn(
                    "max-w-[85%] sm:max-w-[75%]", // Bubble width constraints
                    "rounded-lg text-sm",
                    // Styling based on content
                    hasAudio ? "bg-transparent p-0" : // No bubble style if just audio player
                        (isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"),
                    (hasText || hasImage) && !hasAudio ? "p-2 sm:p-3" : "", // Padding if text/image but not audio
                    isLoading && !hasAudio ? "opacity-70" : "", // Opacity for loading state (unless it's just audio player)
                    isError ? "bg-destructive/20 border border-destructive text-destructive-foreground p-2 sm:p-3" : "" // Error styling with padding
                )}
            >
                {/* --- Conditional Rendering based on Content --- */}

                {/* 1. If Audio exists, render Player (takes priority) */}
                {hasAudio && (
                    // Pass only src to AudioPlayer
                    <AudioPlayer audioSrc={message.audioDataUrl!} />
                )}

                {/* 2. If Image exists (and NOT audio), render Image */}
                {hasImage && !hasAudio && (
                    <img
                        src={message.imageUrl}
                        alt="User upload"
                        // Stack image above text if both exist
                        className={cn("w-full max-h-72 rounded object-contain", hasText && "mb-2")}
                    />
                )}

                {/* 3. If Text exists (and NOT audio) */}
                {hasText && !hasAudio && (
                    // Wrap text and spinner for alignment
                    <div className={cn("flex items-center space-x-2", isError && "text-destructive-foreground")}>
                        <span>{message.text}</span>
                        {/* Display loading spinner (typically for AI messages) */}
                        {isLoading && message.sender === 'ai' && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />}
                    </div>
                )}

                {/* 4. Loading state if NO other content (and not error, and is AI) */}
                {!hasAudio && !hasImage && !hasText && isLoading && !isError && message.sender === 'ai' && (
                    <div className="flex justify-center items-center p-3">
                        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                    </div>
                )}
                {/* --- End Conditional Rendering --- */}

            </div>

            {/* User Avatar */}
            {isUser && (
                <Avatar className="h-8 w-8 flex-shrink-0 self-end">
                    <AvatarImage src="/user.jpeg" alt="User Avatar" />
                    <AvatarFallback>U</AvatarFallback>
                </Avatar>
            )}
        </div>
    );
}