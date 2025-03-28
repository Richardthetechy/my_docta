// src/app/_components/header.tsx
import React from 'react';
// Import the Plus icon
import { Plus } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { Button } from '@/components/ui/button'; // Import Button

// Define props for the Header, including the new session handler
interface HeaderProps {
    onNewSession: () => void; // Function to call when the new session button is clicked
}

// Update component to accept props
export function Header({ onNewSession }: HeaderProps) {
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"> {/* Optional: Added backdrop blur */}
            <div className="container flex h-14 items-center"> {/* Adjusted height slightly */}
                {/* Left Side: Title/Logo */}
                <div className="mr-4 flex">
                    <span className="font-bold text-lg">MyDocta</span> {/* Adjusted size slightly */}
                </div>

                {/* Right Side: Buttons */}
                <div className="flex flex-1 items-center justify-end space-x-2">
                    {/* New Session Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onNewSession} // Call the handler on click
                        aria-label="New Chat Session" // Accessibility label
                    >
                        <Plus className="h-5 w-5" /> {/* Use Plus icon */}
                        <span className="sr-only">New Chat Session</span>
                    </Button>

                    {/* Theme Toggle Button */}
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}