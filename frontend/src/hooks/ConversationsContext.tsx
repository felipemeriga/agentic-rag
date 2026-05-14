import { createContext } from "react";
import { useConversations } from "./useConversations";

export type ConversationsContextType = ReturnType<typeof useConversations>;

export const ConversationsContext =
  createContext<ConversationsContextType | null>(null);
