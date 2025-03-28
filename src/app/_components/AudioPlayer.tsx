// src/app/_components/AudioPlayer.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PlayIcon, PauseIcon, Loader2 } from "lucide-react";
// Removed unused 'cn' import

interface AudioPlayerProps {
    audioSrc: string; // data: URL
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
    const [duration, setDuration] = useState(0);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
    const [isSeeking, setIsSeeking] = useState(false);

    // Metadata Handling
    const handleMetadataLoaded = useCallback(() => {
        setTimeout(() => {
            if (audioRef.current) {
                const audioDuration = audioRef.current.duration;
                console.log(`AudioPlayer: Metadata loaded event, duration read as: ${audioDuration}`);
                if (isFinite(audioDuration) && audioDuration > 0) {
                    setDuration(audioDuration);
                    setIsLoadingMetadata(false);
                } else {
                    console.warn("AudioPlayer: Metadata duration is invalid after event, setting duration to 0.");
                    setDuration(0);
                    setIsLoadingMetadata(false);
                }
            }
        }, 50);
    }, []);

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
        if (!audio || isLoadingMetadata || !duration || duration === Infinity) return;
        console.log(`AudioPlayer: Toggle play/pause requested. Current state: ${isPlaying ? 'Playing' : 'Paused'}`);
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().then(() => { console.log("AudioPlayer: Play command successful"); })
                .catch(error => {
                    console.error("AudioPlayer: Play command failed:", error);
                    setIsPlaying(false); setCurrentTime(0); if (audio) audio.currentTime = 0;
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
            setIsPlaying(false); setCurrentTime(0); setDuration(0); setIsLoadingMetadata(true);

            const onCanPlayThrough = () => {
                console.log("AudioPlayer: canplaythrough event");
                if (!duration || duration <= 0 || !isFinite(duration)) { handleMetadataLoaded(); }
            }
            const onError = (e: Event) => {
                console.error('AudioPlayer: HTML Audio Element Error:', e);
                setIsLoadingMetadata(false); setDuration(0);
            }

            audio.addEventListener('loadedmetadata', handleMetadataLoaded);
            audio.addEventListener('canplaythrough', onCanPlayThrough);
            audio.addEventListener('timeupdate', handleTimeUpdate);
            audio.addEventListener('ended', handleAudioEnded);
            audio.addEventListener('play', () => setIsPlaying(true));
            audio.addEventListener('pause', () => setIsPlaying(false));
            audio.addEventListener('error', onError);

            if (audioSrc?.startsWith('data:')) { console.log("AudioPlayer: Calling load() for data URL"); audio.load(); }

            return () => {
                console.log("AudioPlayer: Effect cleanup");
                audio.removeEventListener('loadedmetadata', handleMetadataLoaded);
                audio.removeEventListener('canplaythrough', onCanPlayThrough);
                audio.removeEventListener('timeupdate', handleTimeUpdate);
                audio.removeEventListener('ended', handleAudioEnded);
                audio.removeEventListener('play', () => setIsPlaying(true));
                audio.removeEventListener('pause', () => setIsPlaying(false));
                audio.removeEventListener('error', onError);
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioSrc]); // Rerun only if src changes

    const isPlayerDisabled = isLoadingMetadata || !duration || duration === Infinity;

    return (
        <div className="flex items-center space-x-2 p-2 rounded bg-muted/30 w-full max-w-[280px] sm:max-w-[320px]">
            <audio ref={audioRef} src={audioSrc} preload="metadata" />
            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={togglePlayPause} disabled={isPlayerDisabled} >
                {isLoadingMetadata ? (<Loader2 className="h-5 w-5 animate-spin" />) : isPlaying ? (<PauseIcon className="h-5 w-5" />) : (<PlayIcon className="h-5 w-5" />)}
                <span className="sr-only">{isLoadingMetadata ? "Loading" : isPlaying ? "Pause" : "Play"}</span>
            </Button>
            <div className="flex flex-col flex-grow justify-center min-w-0 pr-1">
                <Slider value={[currentTime]} max={duration || 1} step={0.1} onValueChange={handleSeek} onValueCommit={handleSeekCommit} onPointerDown={handlePointerDown} className="w-full h-2 cursor-pointer data-[disabled]:opacity-50" disabled={isPlayerDisabled} aria-label="Audio progress" />
                <div className="flex justify-end text-xs text-muted-foreground pt-1">
                    <span>{formatTime(currentTime)}</span> / <span>{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    );
}