"use client";

import * as React from "react";
import { AuthBoundary } from "../auth-provider";
import { ChatProvider } from "../../components/chat/chat-context";
import { ChatSidebar } from "../../components/chat/chat-sidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthBoundary>
      <ChatProvider>
        <div className="flex h-screen w-full overflow-hidden bg-zinc-950">
          <ChatSidebar />
          <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden bg-zinc-950">
            {children}
          </div>
        </div>
      </ChatProvider>
    </AuthBoundary>
  );
}
