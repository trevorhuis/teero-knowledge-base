"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat, fetchServerSentEvents } from "@tanstack/ai-react";

// ─── Simple inline markdown formatter ───
function InlineText({ text, light }: { text: string; light?: boolean }) {
  // Split by code ticks first so we don't bold inside code
  const segments = text.split(/(`[^`]+`)/g);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.startsWith("`") && seg.endsWith("`")) {
          return (
            <code
              key={i}
              className={`px-1.5 py-0.5 rounded-md text-[13px] font-mono border ${
                light
                  ? "bg-white/10 text-zinc-200 border-white/10"
                  : "bg-zinc-100 text-zinc-800 border-zinc-200"
              }`}
            >
              {seg.slice(1, -1)}
            </code>
          );
        }
        // Process bold/italic via regex replacements rendered as HTML
        // Safe here because source is trusted AI output, not raw user input
        const html = seg
          .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>");
        return (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </>
  );
}

// Parse simple block-level markdown (lists, headings, paragraphs)
function RichText({ content, light }: { content: string; light?: boolean }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      blocks.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={i} className={`text-base font-semibold mt-4 mb-1.5 ${light ? "text-white" : "text-zinc-900"}`}>
          {line.slice(4)}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={i} className={`text-lg font-semibold mt-5 mb-2 ${light ? "text-white" : "text-zinc-900"}`}>
          {line.slice(3)}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={i} className={`text-xl font-bold mt-6 mb-3 ${light ? "text-white" : "text-zinc-900"}`}>
          {line.slice(2)}
        </h1>
      );
      i++;
      continue;
    }

    // Bullet list
    if (/^\s*[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 space-y-1 my-2">
          {items.map((item, idx) => (
            <li key={idx} className={`leading-relaxed ${light ? "text-zinc-200" : "text-zinc-800"}`}>
              <InlineText text={item} light={light} />
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s/, ""));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal pl-5 space-y-1 my-2">
          {items.map((item, idx) => (
            <li key={idx} className={`leading-relaxed ${light ? "text-zinc-200" : "text-zinc-800"}`}>
              <InlineText text={item} light={light} />
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular paragraph
    blocks.push(
      <p key={i} className={`leading-relaxed mb-1 last:mb-0 ${light ? "text-zinc-200" : "text-zinc-800"}`}>
        <InlineText text={line} light={light} />
      </p>
    );
    i++;
  }

  return <>{blocks}</>;
}

// ─── Suggested prompts ───
const SUGGESTED_PROMPTS = [
  "What was Teero's most recent product?",
  "How does Teero's W-2 model compare to 1099 gig platforms?",
  "What is revenue cycle management in dentistry?",
  "How much do dental hygienists make in California?",
  "What are the main causes of the dental hygienist shortage?",
];

export function Chat() {
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const { messages, sendMessage, isLoading, error: chatError, reload } = useChat({
    connection: fetchServerSentEvents("/api/chat"),
  });

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Smart auto-scroll: only scroll if user is already near bottom
  useEffect(() => {
    if (!shouldAutoScroll) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, shouldAutoScroll]);

  // Detect user scroll to disable auto-scroll when reading history
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShouldAutoScroll(nearBottom);
  }, []);

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if (input.trim() && !isLoading) {
      setSendError(null);
      const text = input.trim();
      setInput("");
      setShouldAutoScroll(true);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      try {
        await sendMessage(text);
      } catch (err) {
        setSendError(err instanceof Error ? err.message : "Failed to send message");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestionClick = async (prompt: string) => {
    setSendError(null);
    setShouldAutoScroll(true);
    try {
      await sendMessage(prompt);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send message");
    }
  };

  // Filter out assistant messages that have no visible content
  const visibleMessages = messages.filter((message) => {
    if (message.role === "user") return true;
    const hasContent = message.parts.some(
      (p) =>
        (p.type === "text" && p.content && p.content.trim().length > 0) ||
        p.type === "thinking"
    );
    return hasContent;
  });

  const isLoadingNewAssistant =
    isLoading &&
    (visibleMessages.length === 0 ||
      visibleMessages[visibleMessages.length - 1]?.role !== "assistant");

  return (
    <div className="flex flex-col h-screen bg-[#eef1f8]">
      {/* Header */}
      <header className="shrink-0 border-b border-zinc-200/60 bg-white/60 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div className="flex w-8 h-8 rounded-lg bg-zinc-900 items-center justify-center shrink-0">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-zinc-900 leading-tight">
                Teero Knowledge Base
              </h1>
              <p className="text-xs text-zinc-500 leading-tight">
                Ask anything about your documents
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scroll-smooth"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          {visibleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center mb-6 shadow-lg shadow-zinc-900/10">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-zinc-900 mb-2">
                What can I help you with?
              </h2>
              <p className="text-zinc-500 max-w-sm mb-10">
                Ask about Teero products, dental staffing, billing & RCM, or anything from the knowledge base.
              </p>

              {/* Suggested prompts */}
              <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-2.5 max-w-xl">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSuggestionClick(prompt)}
                    className="px-4 py-2.5 rounded-xl bg-white border border-zinc-200/80 text-sm text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 hover:shadow-md transition-all shadow-sm text-left sm:text-center"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {visibleMessages.map((message) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-3.5 ${
                        isUser
                          ? "bg-zinc-900 text-white rounded-br-md shadow-md"
                          : "bg-white/90 border border-zinc-200/60 text-zinc-900 rounded-bl-md shadow-sm backdrop-blur-sm"
                      }`}
                    >
                      {/* Thinking blocks */}
                      {message.parts.map((part, idx) => {
                        if (part.type === "thinking") {
                          return (
                            <div
                              key={idx}
                              className={`text-sm italic rounded-lg px-3 py-2 mb-2 ${
                                isUser
                                  ? "bg-zinc-800/60 text-zinc-300"
                                  : "bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                <svg
                                  className="w-3.5 h-3.5 shrink-0"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                  />
                                </svg>
                                {part.content}
                              </span>
                            </div>
                          );
                        }
                        if (part.type === "text") {
                          return (
                            <div
                              key={idx}
                              className="text-[15px] leading-relaxed"
                            >
                              <RichText content={part.content} light={isUser} />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Loading indicator */}
              {isLoadingNewAssistant && (
                <div className="flex justify-start">
                  <div className="bg-white/90 border border-zinc-200/60 rounded-2xl rounded-bl-md px-4 py-3.5 shadow-sm flex items-center gap-3 backdrop-blur-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" />
                    </div>
                    <span className="text-sm text-zinc-500">
                      Assistant is thinking…
                    </span>
                  </div>
                </div>
              )}

              {/* Error banner */}
              {(chatError || sendError) && (
                <div className="flex justify-center">
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-red-700 max-w-[88%]">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="flex-1">{chatError?.message ?? sendError}</span>
                    <button
                      onClick={() => { setSendError(null); reload(); }}
                      className="text-xs font-medium underline hover:no-underline shrink-0"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-200/60 bg-white/60 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask something…"
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-2xl border border-zinc-200/80 bg-white px-4 py-3.5 pr-14 text-[15px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-3 bottom-3 w-9 h-9 flex items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-900 disabled:cursor-not-allowed transition-colors shadow-sm"
              aria-label="Send message"
            >
              <svg
                className="w-4 h-4 translate-x-px"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12h14M12 5l7 7-7 7"
                />
              </svg>
            </button>
          </form>
          <p className="text-[11px] text-zinc-400 text-center mt-2 tracking-wide uppercase font-medium">
            Press Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
