"use client";

import type { ChatMessage } from "@/components/chat/ChatPanel";
import SourceCitation from "@/components/chat/SourceCitation";

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] group`}>
        {/* Avatar + bubble */}
        <div className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
          {/* Avatar */}
          <div
            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              isUser
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
            }`}
          >
            {isUser ? "U" : "AI"}
          </div>

          {/* Bubble */}
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              isUser
                ? "bg-blue-500/20 text-white/90 border border-blue-500/20 rounded-br-md"
                : "glass-panel-sm text-white/80 rounded-bl-md"
            }`}
          >
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>
          </div>
        </div>

        {/* Source Citations */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="ml-9 mt-1">
            <SourceCitation sources={message.sources} />
          </div>
        )}

        {/* Timestamp */}
        <div
          className={`mt-1 text-[10px] text-white/20 opacity-0 group-hover:opacity-100 transition-opacity ${
            isUser ? "text-right mr-9" : "ml-9"
          }`}
        >
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
