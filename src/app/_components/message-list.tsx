// src/app/_components/message-list.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { Message, MessageItem } from "./message-item";
import { cn } from "@/lib/utils";

interface MessageListProps {
    messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom effect
    useEffect(() => {
        if (scrollAreaRef.current && messages.length > 0) {
            const timer = setTimeout(() => {
                if (scrollAreaRef.current) {
                    scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [messages]);

    return (
        // Container handles max-width, flex-1 allows vertical growth, overflow handles scrolling
        <div
            ref={scrollAreaRef}
            className={cn(
                "container max-w-6xl flex-1 overflow-y-auto p-4",
                // Center placeholder when empty
                messages.length === 0 && "flex flex-col items-center justify-center"
            )}
        >
            {messages.length === 0 ? (
                // Placeholder text
                <p className="text-center text-muted-foreground text-xl font-semibold">
                    How are you feeling today?
                </p>
            ) : (
                // Render messages with spacing
                <div className="space-y-4">
                    {messages.map((msg) => <MessageItem key={msg.id} message={msg} />)}
                </div>
            )}
        </div>
    );
}