import { useContext } from "react";
import {
  ConversationsContext,
  type ConversationsContextType,
} from "./ConversationsContext";

export function useConversationsContext(): ConversationsContextType {
  const ctx = useContext(ConversationsContext);
  if (!ctx) {
    throw new Error(
      "useConversationsContext must be used within ConversationsProvider"
    );
  }
  return ctx;
}
