"use client";

import { useState, useRef, useEffect } from "react";
import GlassButton from "@/components/ui/GlassButton";
import MessageBubble from "@/components/chat/MessageBubble";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: Array<{ source: string; category: string; similarity: number }>;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void | Promise<void>;
  loading?: boolean;
  placeholder?: string;
  title?: string;
  emptyMessage?: string;
  className?: string;
}

export default function ChatPanel({
  messages,
  onSend,
  loading = false,
  placeholder = "Type your message...",
  title = "Chat",
  emptyMessage = "Start a conversation",
  className = "",
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const msg = input;
    setInput("");
    await onSend(msg);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`glass-panel flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span className="text-xs text-white/30">
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-white/30 py-12">
            <svg
              className="w-12 h-12 mx-auto text-white/15 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-sm">{emptyMessage}</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="glass-panel-sm p-4 rounded-2xl">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" />
                <div
                  className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-white/5">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 transition-colors disabled:opacity-50"
          />
          <GlassButton
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
