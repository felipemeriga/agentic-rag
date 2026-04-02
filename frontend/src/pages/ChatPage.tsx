import { useState, useRef } from "react";
import ChatArea from "../components/ChatArea";
import type { Message, ChatFilters, StageEvent } from "../lib/api";
import { streamChat } from "../lib/api";
import { useConversations } from "../hooks/useConversations";

export default function ChatPage() {
  const { selectedId, messages, setMessages, loadConversations } =
    useConversations();

  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStage, setCurrentStage] = useState<StageEvent | null>(null);
  const streamingRef = useRef("");

  const handleSend = async (content: string, filters?: ChatFilters) => {
    if (!selectedId || isStreaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent("");
    setCurrentStage(null);
    streamingRef.current = "";

    try {
      await streamChat(
        selectedId,
        content,
        (token) => {
          setCurrentStage(null);
          streamingRef.current += token;
          setStreamingContent(streamingRef.current);
        },
        () => {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: streamingRef.current,
            created_at: new Date().toISOString(),
          };
          setMessages((msgs) => [...msgs, assistantMsg]);
          setStreamingContent("");
          streamingRef.current = "";
          setIsStreaming(false);
          setCurrentStage(null);
          loadConversations();
        },
        filters,
        (stage) => setCurrentStage(stage),
      );
    } catch {
      setIsStreaming(false);
      setStreamingContent("");
      setCurrentStage(null);
      streamingRef.current = "";
    }
  };

  return (
    <ChatArea
      messages={messages}
      streamingContent={streamingContent}
      isStreaming={isStreaming}
      currentStage={currentStage}
      onSend={handleSend}
    />
  );
}
