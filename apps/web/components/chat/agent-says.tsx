"use client";

import * as React from "react";
import { Bot, User } from "lucide-react";
import type { AgentSaysMessage } from "./types";

export interface AgentSaysProps {
  message: AgentSaysMessage;
  className?: string;
}

/**
 * AgentSays component
 *
 * CRITICAL SECURITY INVARIANT:
 * Renders agent conversational prose strictly as escaped plain text inside a standard
 * React text node. ZERO dangerouslySetInnerHTML is used. Agent speech can NEVER
 * inject HTML, fake a VerifiedBlock card, or execute arbitrary markup.
 */
export function AgentSays({ message, className = "" }: AgentSaysProps) {
  const isUser = message.sender.toLowerCase() === "you" || message.sender.toLowerCase() === "user";

  return (
    <div
      className={`flex flex-col gap-1 text-xs ${
        isUser ? "items-end" : "items-start"
      } ${className}`}
    >
      {/* Sender & Timestamp Header */}
      <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
        {!isUser && (
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary border border-border">
            <Bot className="h-2.5 w-2.5 text-success" />
          </div>
        )}
        <span className="font-medium text-muted-foreground">{message.sender}</span>
        {message.role && !isUser && (
          <span className="text-[10px] text-muted-foreground">({message.role})</span>
        )}
        <span className="text-[10px] text-muted-foreground font-mono">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        {isUser && (
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-muted border border-border">
            <User className="h-2.5 w-2.5 text-foreground" />
          </div>
        )}
      </div>

      {/* Bubble Container: strictly rendering plain string message.text */}
      <div
        className={`max-w-[90%] rounded-lg px-3.5 py-2.5 leading-relaxed break-words top-shade select-text ${
          isUser
            ? "bg-secondary text-foreground border border-border"
            : "bg-secondary text-foreground border border-border"
        }`}
      >
        {/* Strictly pure text node — ZERO dangerouslySetInnerHTML */}
        <span className="whitespace-pre-wrap">{message.text}</span>
      </div>
    </div>
  );
}
