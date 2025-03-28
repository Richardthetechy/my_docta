// src/app/_components/message-item.tsx
import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";
import Image from "next/image"; // Import next/image

export interface Message {
    id: string;
    text?: string;
    imageUrl?: string;
    audioDataUrl?: string;
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
            className={cn("flex items-end space-x-2", isUser ? "justify-end" : "justify-start")} >
            {/* AI Avatar */}
            {!isUser && (<Avatar className="h-8 w-8 flex-shrink-0 self-end"> <AvatarImage src="/bot.jpg" alt="AI Avatar" /> <AvatarFallback>AI</AvatarFallback> </Avatar>)}

            {/* Message Bubble */}
            <div
                className={cn(
                    "max-w-[85%] sm:max-w-[75%]", "rounded-lg text-sm",
                    hasAudio ? "bg-transparent p-0" : (isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"),
                    (hasText || hasImage) && !hasAudio ? "p-2 sm:p-3" : "",
                    isLoading && !hasAudio ? "opacity-70" : "",
                    isError ? "bg-destructive/20 border border-destructive text-destructive-foreground p-2 sm:p-3" : ""
                )} >
                {/* Conditional Rendering */}
                {hasAudio && (<AudioPlayer audioSrc={message.audioDataUrl!} />)}

                {/* Use next/image */}
                {hasImage && !hasAudio && (
                    <div className={cn("relative w-full overflow-hidden rounded", hasText && "mb-2")}>
                        <Image
                            src={message.imageUrl!}
                            alt="User upload"
                            width={300} // Example: Provide appropriate layout width
                            height={288} // Example: Provide appropriate layout height (based on max-h-72)
                            className="object-contain" // Maintain aspect ratio
                        // unoptimized={true} // Add this if optimization issues arise with data URLs
                        />
                    </div>
                )}

                {hasText && !hasAudio && (
                    <div className={cn("flex items-center space-x-2", isError && "text-destructive-foreground")}>
                        <span>{message.text}</span>
                        {isLoading && message.sender === 'ai' && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />}
                    </div>
                )}
                {!hasAudio && !hasImage && !hasText && isLoading && !isError && message.sender === 'ai' && (
                    <div className="flex justify-center items-center p-3"> <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> </div>
                )}
            </div>

            {/* User Avatar */}
            {isUser && (<Avatar className="h-8 w-8 flex-shrink-0 self-end"> <AvatarImage src="/user.jpeg" alt="User Avatar" /> <AvatarFallback>U</AvatarFallback> </Avatar>)}
        </div>
    );
}