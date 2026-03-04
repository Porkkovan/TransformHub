"use client";

import { useState, useEffect, useRef } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import SourceCitation from "@/components/chat/SourceCitation";
import { useOrganization } from "@/contexts/OrganizationContext";

interface MessageSource {
  source: string;
  category: string;
  similarity: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: MessageSource[];
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
}

export default function ChatPage() {
  const { currentOrg } = useOrganization();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/chat/conversations${currentOrg ? `?organizationId=${currentOrg.id}` : ""}`)
      .then((r) => r.json())
      .then((json) => setConversations(Array.isArray(json) ? json : (json.data ?? [])))
      .catch(() => {});
  }, [currentOrg]);

  useEffect(() => {
    if (activeConv) {
      fetch(`/api/chat/conversations/${activeConv}/messages`)
        .then((r) => r.json())
        .then((json) => setMessages(Array.isArray(json) ? json : (json.data ?? json.messages ?? [])))
        .catch(() => {});
    }
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createConversation = async () => {
    const res = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: currentOrg?.id }),
    });
    const data = await res.json();
    setActiveConv(data.id);
    setConversations((prev) => [{ id: data.id, title: "New Conversation", createdAt: new Date().toISOString() }, ...prev]);
    setMessages([]);
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeConv || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          organizationId: currentOrg?.id,
          conversationId: activeConv,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "-reply",
          role: "assistant",
          content: data.response,
          createdAt: new Date().toISOString(),
          sources: data.sources,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "-error",
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Conversation Sidebar */}
      <div className="w-64 flex-shrink-0">
        <GlassCard title="Conversations">
          <GlassButton onClick={createConversation} className="w-full mb-4">
            New Chat
          </GlassButton>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConv(conv.id)}
                className={`w-full text-left p-3 rounded-xl text-sm transition-all ${
                  activeConv === conv.id
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "text-white/60 hover:bg-white/5"
                }`}
              >
                <p className="truncate">{conv.title}</p>
                <p className="text-xs text-white/30 mt-1">
                  {new Date(conv.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <GlassCard title="AI Chat" className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
            {messages.length === 0 && (
              <div className="text-center text-white/30 py-12">
                <p className="text-lg">Start a conversation with Blueprint Creator AI</p>
                <p className="text-sm mt-2">Ask about your transformation analysis, codebase, or get recommendations.</p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[70%]">
                  <div
                    className={`p-4 rounded-2xl text-sm ${
                      msg.role === "user"
                        ? "bg-blue-500/20 text-white/90 border border-blue-500/20"
                        : "glass-panel-sm text-white/80"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                  {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                    <SourceCitation sources={msg.sources} />
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="glass-panel-sm p-4 rounded-2xl">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0.2s" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={activeConv ? "Type your message..." : "Create a conversation first"}
              disabled={!activeConv || loading}
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50"
            />
            <GlassButton onClick={sendMessage} disabled={!activeConv || loading || !input.trim()}>
              Send
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
