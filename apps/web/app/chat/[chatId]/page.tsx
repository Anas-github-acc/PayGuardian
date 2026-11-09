"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { AssistantView } from "../../../components/chat/assistant-view";

export default function ChatSessionPage() {
  const params = useParams();
  const chatId = typeof params?.chatId === "string" ? params.chatId : "new";

  return <AssistantView conversationIdFromUrl={chatId} />;
}
