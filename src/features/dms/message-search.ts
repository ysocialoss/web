import { useCallback, useEffect, useRef, useState } from "react";
import { dmApi, type DmUser } from "./dm-api";
import { decryptPage, readContext } from "./dm-context";
import type { LocalDevice } from "./dm-crypto";
import { subscribeDm } from "./dm-live";
import { payloadSummary } from "./message-payload";

export type IndexedMessage = {
  id: string;
  conversationId: string;
  peer: DmUser;
  senderId: string;
  createdAt: string;
  text: string;
  folded: string;
  has: "link" | "poll" | "voice" | "gif" | "file" | "text";
};

export type SearchHit = IndexedMessage & { at: number; length: number };
export type SearchFilters = { sender: "anyone" | "me" | "them"; has: "any" | "link" | "poll" | "voice" | "gif" | "file" };
export const noFilters: SearchFilters = { sender: "anyone", has: "any" };
export type Searchable = { id: string; peer: DmUser; lastMessageAt: string | null };

const PAGE_CAP = 50;
const CONCURRENCY = 3;

export const fold = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

type Entry = { stamp: string | null; messages: IndexedMessage[] };

export function useMessageSearch(device: LocalDevice, conversations: Searchable[] | undefined, active: boolean) {
  const index = useRef(new Map<string, Entry>());
  const running = useRef<AbortController | null>(null);
  const stale = useRef(new Set<string>());
  const [version, setVersion] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failed, setFailed] = useState(false);
  const latest = useRef(conversations);
  useEffect(() => { latest.current = conversations; }, [conversations]);

  const build = useCallback(async () => {
    if (running.current) return;
    const controller = new AbortController();
    running.current = controller;
    const { signal } = controller;
    const failures = new Set<string>();
    setFailed(false);
    try {
      while (!signal.aborted) {
        const todo = (latest.current ?? []).filter((conversation) => {
          const entry = index.current.get(conversation.id);
          return !failures.has(conversation.id) && (!entry || stale.current.has(conversation.id) || entry.stamp !== conversation.lastMessageAt);
        });
        if (!todo.length) break;
        setProgress({ done: 0, total: todo.length });
        let done = 0;
        const queue = [...todo];
        await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
          for (let conversation = queue.shift(); conversation && !signal.aborted; conversation = queue.shift()) {
            stale.current.delete(conversation.id);
            try {
              const [context, initial] = await Promise.all([
                readContext(conversation.id, device, signal),
                dmApi.messages(conversation.id, device, undefined, signal),
              ]);
              const messages: IndexedMessage[] = [];
              let result = initial;
              for (let page = 1; ; page++) {
                signal.throwIfAborted();
                const decrypted = await decryptPage(conversation.id, device, context, result.messages);
                for (const message of decrypted) {
                  const body = message.text;
                  if (body === null) continue;
                  const text = payloadSummary({ ...message, text: body });
                  if (text) {
                    messages.push({
                      id: message.id, conversationId: conversation.id, peer: conversation.peer, senderId: message.senderId,
                      createdAt: message.createdAt, text, folded: fold(text),
                      has: message.poll ? "poll" : message.voice ? "voice" : message.file ? "file" : message.gif ? "gif" : /https?:\/\//i.test(body) ? "link" : "text",
                    });
                  }
                }
                const before = result.messages[0]?.sequence;
                if (page === PAGE_CAP || !result.more || !before) break;
                result = await dmApi.messages(conversation.id, device, { before }, signal);
              }
              if (signal.aborted) return;
              index.current.set(conversation.id, { stamp: conversation.lastMessageAt, messages });
            } catch {
              if (signal.aborted) return;
              failures.add(conversation.id);
              stale.current.add(conversation.id);
              index.current.delete(conversation.id);
            }
            setProgress({ done: ++done, total: todo.length });
            setVersion((current) => current + 1);
          }
        }));
      }
    } finally {
      if (running.current === controller) {
        running.current = null;
        setFailed(failures.size > 0);
        setProgress({ done: 0, total: 0 });
      }
    }
  }, [device]);

  useEffect(() => {
    if (!active) return;
    const unsubscribe = subscribeDm(device.userId, (event) => {
      if (event.type === "conversation" && event.message && latest.current?.some(({ id }) => id === event.id)) {
        stale.current.add(event.id);
        void build();
      }
    });
    return () => {
      unsubscribe();
      running.current?.abort();
      running.current = null;
    };
  }, [active, device.userId, build]);
  useEffect(() => {
    if (active && conversations?.length) void build();
  }, [active, conversations, build]);

  const search = useCallback((query: string, filters: SearchFilters, limit = 60): SearchHit[] => {
    const terms = fold(query).split(/\s+/).filter(Boolean);
    if (!terms.length && filters.sender === "anyone" && filters.has === "any") return [];
    const hits: SearchHit[] = [];
    for (const entry of index.current.values()) {
      for (const message of entry.messages) {
        if (filters.has !== "any" && message.has !== filters.has) continue;
        if (filters.sender === "me" && message.senderId !== device.userId) continue;
        if (filters.sender === "them" && message.senderId === device.userId) continue;
        let first = -1;
        let length = 0;
        let ok = true;
        for (const term of terms) {
          const at = message.folded.indexOf(term);
          if (at < 0) { ok = false; break; }
          if (first < 0 || at < first) { first = at; length = term.length; }
        }
        if (ok) hits.push({ ...message, at: Math.max(0, first), length });
      }
    }
    return hits.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.userId, version]);

  return { search, progress, failed, retry: build };
}
