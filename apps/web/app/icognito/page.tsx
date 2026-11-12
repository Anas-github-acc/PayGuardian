"use client";

import * as React from "react";
import { ChatProvider } from "../../components/chat/chat-context";
import { AssistantView } from "../../components/chat/assistant-view";

export default function IncognitoChatPage() {
  return (
    <ChatProvider>
      <div className="flex h-screen w-full overflow-hidden bg-zinc-950">
        <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden bg-zinc-950">
          <AssistantView isIncognito={true} />
        </div>
      </div>
    </ChatProvider>
  );
}
