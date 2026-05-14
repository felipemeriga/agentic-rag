import { ConversationsContext } from "../hooks/ConversationsContext";
import { useConversations } from "../hooks/useConversations";

export default function ConversationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const conversations = useConversations();
  return (
    <ConversationsContext.Provider value={conversations}>
      {children}
    </ConversationsContext.Provider>
  );
}
