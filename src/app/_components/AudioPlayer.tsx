// src/app/_components/AudioPlayer.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PlayIcon, PauseIcon, Loader2 } from "lucide-react"; // Ensure Loader2 is imported
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
    audioSrc: string; // data: URL
    // No initialDuration needed anymore
}

// Helper to format time (MM:SS)
const formatTime = (time: number): string => {
    if (isNaN(time) || !isFinite(time) || time < 0) { return "00:00"; }
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export function AudioPlayer({ audioSrc }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0); // Initialize duration to 0
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(true); // Start in loading state
    const [isSeeking, setIsSeeking] = useState(false);

    // Metadata Handling - triggered by events
    const handleMetadataLoaded = useCallback(() => {
        // Using setTimeout allows the duration property to potentially stabilize
        setTimeout(() => {
            if (audioRef.current) {
                const audioDuration = audioRef.current.duration;
                console.log(`AudioPlayer: Metadata loaded event, duration read as: ${audioDuration}`);

                if (isFinite(audioDuration) && audioDuration > 0) {
                    setDuration(audioDuration);
                    setIsLoadingMetadata(false); // Stop loading
                } else {
                    // If still invalid after metadata event, log warning and stop loading with 0 duration
                    console.warn("AudioPlayer: Metadata duration is invalid after event, setting duration to 0.");
                    setDuration(0);
                    setIsLoadingMetadata(false);
                }
            }
        }, 50); // Short delay
    }, []); // No external dependencies needed now


    // Time Update Handling
    const handleTimeUpdate = useCallback(() => {
        if (audioRef.current && !isSeeking) {
            setCurrentTime(audioRef.current.currentTime);
        }
    }, [isSeeking]);

    // Audio Ended Handling
    const handleAudioEnded = useCallback(() => {
        console.log("AudioPlayer: Audio ended");
        setIsPlaying(false);
        setCurrentTime(0);
        if (audioRef.current) { audioRef.current.currentTime = 0; }
    }, []);

    // Play/Pause Toggle
    const togglePlayPause = useCallback(() => {
        const audio = audioRef.current;
        // Prevent action if metadata is loading or duration is invalid
        if (!audio || isLoadingMetadata || !duration || duration === Infinity) return;

        console.log(`AudioPlayer: Toggle play/pause requested. Current state: ${isPlaying ? 'Playing' : 'Paused'}`);
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().then(() => {
                console.log("AudioPlayer: Play command successful");
            }).catch(error => {
                console.error("AudioPlayer: Play command failed:", error);
                setIsPlaying(false); // Reset state on failure
                setCurrentTime(0);
                if (audio) audio.currentTime = 0;
            });
        }
    }, [isPlaying, duration, isLoadingMetadata]);

    // Seeking Handlers
    const handleSeek = useCallback((value: number[]) => {
        if (audioRef.current && duration) {
            const seekTime = value[0];
            const clampedTime = Math.max(0, Math.min(seekTime, duration));
            audioRef.current.currentTime = clampedTime;
            setCurrentTime(clampedTime);
        }
    }, [duration]);
    const handleSeekCommit = useCallback(() => { setIsSeeking(false); }, []);
    const handlePointerDown = useCallback(() => { setIsSeeking(true); }, []);


    // Effect for Setup & Cleanup
    useEffect(() => {
        const audio = audioRef.current;
        if (audio) {
            console.log("AudioPlayer: Effect setup for src:", audioSrc?.substring(0, 50));

            // Reset internal state when src changes
            setIsPlaying(false);
            setCurrentTime(0);
            setDuration(0); // Reset duration
            setIsLoadingMetadata(true); // Start loading for new src

            const onCanPlayThrough = () => {
                console.log("AudioPlayer: canplaythrough event");
                // Metadata *should* be available, trigger handler again just in case
                if (!duration || duration <= 0 || !isFinite(duration)) {
                    handleMetadataLoaded();
                }
            }
            const onError = (e: Event) => {
                console.error('AudioPlayer: HTML Audio Element Error:', e);
                setIsLoadingMetadata(false); // Stop loading on error
                setDuration(0); // Reset duration on error
            }

            // Add listeners
            audio.addEventListener('loadedmetadata', handleMetadataLoaded);
            audio.addEventListener('canplaythrough', onCanPlayThrough); // Listen for canplaythrough
            audio.addEventListener('timeupdate', handleTimeUpdate);
            audio.addEventListener('ended', handleAudioEnded);
            audio.addEventListener('play', () => setIsPlaying(true));
            audio.addEventListener('pause', () => setIsPlaying(false));
            audio.addEventListener('error', onError);

            // Explicitly call load() for data URLs to ensure parsing starts
            if (audioSrc?.startsWith('data:')) {
                console.log("AudioPlayer: Calling load() for data URL");
                audio.load();
            }

            // Cleanup function
            return () => {
                console.log("AudioPlayer: Effect cleanup");
                audio.removeEventListener('loadedmetadata', handleMetadataLoaded);
                audio.removeEventListener('canplaythrough', onCanPlayThrough);
                audio.removeEventListener('timeupdate', handleTimeUpdate);
                audio.removeEventListener('ended', handleAudioEnded);
                audio.removeEventListener('play', () => setIsPlaying(true));
                audio.removeEventListener('pause', () => setIsPlaying(false));
                audio.removeEventListener('error', onError);
                // Optional: Stop audio on unmount
                // if (!audio.paused) {
                //     audio.pause();
                // }
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioSrc]); // Rerun only if src changes


    // Determine if player should be disabled
    const isPlayerDisabled = isLoadingMetadata || !duration || duration === Infinity;

    return (
        <div className="flex items-center space-x-2 p-2 rounded bg-muted/30 w-full max-w-[280px] sm:max-w-[320px]">
            <audio ref={audioRef} src={audioSrc} preload="metadata" />

            {/* Play/Pause Button */}
            <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={togglePlayPause}
                disabled={isPlayerDisabled} // Disable based on loading/invalid duration
            >
                {isLoadingMetadata ? (
                    <Loader2 className="h-5 w-5 animate-spin" /> // Show loader
                ) : isPlaying ? (
                    <PauseIcon className="h-5 w-5" />
                ) : (
                    <PlayIcon className="h-5 w-5" />
                )}
                <span className="sr-only">{isLoadingMetadata ? "Loading" : isPlaying ? "Pause" : "Play"}</span>
            </Button>

            {/* Progress Slider & Time */}
            <div className="flex flex-col flex-grow justify-center min-w-0 pr-1">
                <Slider
                    value={[currentTime]}
                    max={duration || 1} // Ensure max is at least 1
                    step={0.1}
                    onValueChange={handleSeek}
                    onValueCommit={handleSeekCommit}
                    onPointerDown={handlePointerDown}
                    className="w-full h-2 cursor-pointer data-[disabled]:opacity-50"
                    disabled={isPlayerDisabled} // Disable slider based on state
                    aria-label="Audio progress"
                />
                <div className="flex justify-end text-xs text-muted-foreground pt-1">
                    <span>{formatTime(currentTime)}</span> / <span>{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    );
}