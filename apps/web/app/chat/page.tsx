"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "../lib/workspace-store";
import { getCachedConversations } from "../../lib/chat-cache";

export default function ChatIndexPage() {
  const router = useRouter();
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;

  React.useEffect(() => {
    if (currentEnv?.id) {
      getCachedConversations(currentEnv.id).then((cached) => {
        if (cached && cached.length > 0) {
          router.replace(`/chat/${cached[0].id}`);
        } else {
          router.replace("/chat/new");
        }
      });
    } else {
      router.replace("/chat/new");
    }
  }, [currentEnv?.id, router]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-zinc-400 text-xs font-mono">
      Loading agent conversation…
    </div>
  );
}
