import React, { createContext, useContext, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface TerminalContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  runCommand: (command: string, args: string[]) => Promise<void>;
  lastCommand: string | null;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const runCommand = useCallback(async (command: string, args: string[]) => {
    setLastCommand(`${command} ${args.join(' ')}`);
    setIsOpen(true);
    try {
      await invoke('run_terminal_command', { command, args });
    } catch (err) {
      console.error('Failed to trigger terminal command:', err);
    }
  }, []);

  return (
    <TerminalContext.Provider value={{ isOpen, setIsOpen, runCommand, lastCommand }}>
      {children}
    </TerminalContext.Provider>
  );
};

export const useTerminal = () => {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
};
