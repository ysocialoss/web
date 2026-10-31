import { createMemo, createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { MAX_ATTACHMENTS } from "~/lib/attachments";
import { Component, ChevronRight, Search, Plus, Smile, Sticker, Video, X, Paperclip } from "~/components/Icons";

type Attachment = { name: string; url: string };
type Message = { attachments?: Attachment[]; sender: "them" | "you"; text: string; time: string };
type Conversation = { id: string; name: string; community: string; initial: string; color: string; unread: number; messages: Message[] };
const messageGroupWindowMinutes = 5;

function combinesWithPrevious(message: Message, previous: Message | undefined) {
  if (!previous || previous.sender !== message.sender) return false;
  const minutes = (time: string) => {
    if (!/^\d{2}:\d{2}$/.test(time)) return undefined;
    const [hours, mins] = time.split(":").map(Number);
    return hours * 60 + mins;
  };
  const currentTime = minutes(message.time);
  const previousTime = minutes(previous.time);
  return currentTime !== undefined && previousTime !== undefined && currentTime >= previousTime && currentTime - previousTime <= messageGroupWindowMinutes;
}

function Badge(props: { name: string }) {
  return <span class="badge"><Component size={12} />{props.name}</span>;
}

export default function DirectMessages() {
  const [conversations, setConversations] = createSignal<Conversation[]>([]);
  const [selectedId, setSelectedId] = createSignal("");
  const [startingConversation, setStartingConversation] = createSignal(false);
  const [recipient, setRecipient] = createSignal("");
  let recipientInput: HTMLInputElement | undefined;
  let newMessageButton: HTMLButtonElement | undefined;
  let messageInput: HTMLInputElement | undefined;
  const [picker, setPicker] = createSignal<"emoji" | "sticker" | null>(null);
  const [query, setQuery] = createSignal("");
  const [unreadOnly, setUnreadOnly] = createSignal(false);
  const [mobileChat, setMobileChat] = createSignal(false);
  const [attachments, setAttachments] = createSignal<Record<string, Attachment[]>>({});
  const [attachmentError, setAttachmentError] = createSignal("");
  const attachmentUrls: string[] = [];
  onCleanup(() => attachmentUrls.forEach(url => URL.revokeObjectURL(url)));
  let filePicker: HTMLInputElement | undefined;
  const [drafts, setDrafts] = createSignal<Record<string, string>>({});
  const selected = createMemo(() => conversations().find(item => item.id === selectedId()));
  const filtered = createMemo(() => conversations().filter(item => item.name.toLowerCase().includes(query().toLowerCase()) && (!unreadOnly() || item.unread > 0)));
  let history: HTMLDivElement | undefined;
  onMount(() => history?.scrollTo({ top: history.scrollHeight }));

  function openConversation(id: string) {
    setAttachmentError("");
    setPicker(null);
    setSelectedId(id);
    setMobileChat(true);
    setConversations(items => items.map(item => item.id === id ? { ...item, unread: 0 } : item));
    if (unreadOnly() && !conversations().some(item => item.unread > 0)) setUnreadOnly(false);
    queueMicrotask(() => history?.scrollTo({ top: history.scrollHeight }));
  }
  function startConversation() {
    const name = recipient().trim().replace(/^@/, "").trim();
    if (!name) return;
    const existing = conversations().find(item => item.name.toLowerCase() === name.toLowerCase());
    const id = existing?.id ?? crypto.randomUUID();
    if (!existing) {
      setConversations(items => [{
        id, name, community: "", initial: Array.from(name)[0].toUpperCase(),
        color: "#00d363", unread: 0, messages: [],
      }, ...items]);
    }
    setQuery("");
    setUnreadOnly(false);
    setStartingConversation(false);
    setRecipient("");
    openConversation(id);
    queueMicrotask(() => messageInput?.focus());
  }
  function closeNewMessage() {
    setStartingConversation(false);
    setRecipient("");
    newMessageButton?.focus();
  }
  function sendMessage() {
    const text = (drafts()[selectedId()] ?? "").trim();
    const files = attachments()[selectedId()] ?? [];
    if (!text && !files.length) return;
    setAttachmentError("");
    const message: Message = { sender: "you", text, attachments: files, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) };
    setConversations(items => items.map(item => item.id === selectedId() ? { ...item, messages: [...item.messages, message] } : item));
    setDrafts(items => ({ ...items, [selectedId()]: "" }));
    setAttachments(items => ({ ...items, [selectedId()]: [] }));
    queueMicrotask(() => history?.scrollTo({ top: history.scrollHeight, behavior: "smooth" }));
  }

  return <div class="dm-layout" classList={{ "dm-chat-open": mobileChat() }}>
    <section class="dm-inbox" aria-label="Conversations">
      <div class="dm-inbox-tools">
        <label class="dm-search"><Search size={20} /><input aria-label="Search conversations" placeholder="Search messages" value={query()} onInput={event => setQuery(event.currentTarget.value)} /></label>
        <button ref={newMessageButton} type="button" class="dm-new-message" aria-label="New message" title="New message" aria-expanded={startingConversation()} aria-controls="dm-new-conversation" onClick={() => {
          if (startingConversation()) { closeNewMessage(); return; }
          setStartingConversation(true);
          queueMicrotask(() => recipientInput?.focus());
        }}><Plus size={22} /></button>
      </div>
      <Show when={startingConversation()}>
        <form id="dm-new-conversation" class="dm-new-conversation" onSubmit={event => { event.preventDefault(); startConversation(); }} onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); closeNewMessage(); }
        }}>
          <span class="dm-recipient-prefix" aria-hidden="true">@</span>
          <label class="sr-only" for="dm-recipient">Recipient username</label>
          <input ref={recipientInput} id="dm-recipient" placeholder="Username" autocomplete="off" autocapitalize="none" spellcheck={false} required value={recipient()} onInput={event => setRecipient(event.currentTarget.value)} />
          <button type="button" aria-label="Cancel new message" title="Cancel" onClick={closeNewMessage}><X size={18} /></button>
          <button type="submit" aria-label="Start conversation" title="Start conversation" disabled={!recipient().trim().replace(/^@/, "").trim()}><ChevronRight size={20} /></button>
        </form>
      </Show>
      <div class="dm-filters" aria-label="Filter conversations"><button aria-pressed={!unreadOnly()} onClick={() => setUnreadOnly(false)}>All</button><button aria-pressed={unreadOnly()} onClick={() => setUnreadOnly(true)}>Unread <span>{conversations().filter(item => item.unread > 0).length}</span></button></div>
      <div class="dm-conversations"><Show when={conversations().length > 0 && filtered().length === 0}><p class="dm-empty">No results</p></Show><For each={filtered()}>{item => <button class="dm-conversation" classList={{ "dm-conversation-selected": selectedId() === item.id }} onClick={() => openConversation(item.id)} aria-pressed={selectedId() === item.id}>
        <span class="dm-avatar" style={{ background: item.color }}>{item.initial}</span><span class="dm-conversation-body"><span class="dm-conversation-name">{item.name}<Show when={item.community}><Badge name={item.community} /></Show></span><span class="dm-preview">{item.messages.at(-1)?.text}</span></span><Show when={item.unread}><span class="dm-unread">{item.unread}</span></Show>
      </button>}</For></div>
    </section>
    <Show when={selected()} fallback={<section class="dm-thread" />}>{conversation =>
    <section class="dm-thread" aria-label={`Conversation with ${conversation().name}`}>
      <header class="dm-thread-header">
        <button class="dm-back" aria-label="Back to conversations" onClick={() => setMobileChat(false)}><ChevronRight size={22} /></button>
        <h2 class="dm-thread-heading">@{conversation().name}</h2>
      </header>
      <div class="dm-history" ref={history} role="log" aria-label="Message history" aria-live="polite"><div class="dm-message-list"><For each={conversation().messages}>{(message, index) => {
        const combined = () => combinesWithPrevious(message, conversation().messages[index() - 1]);
        return <article class="dm-message" classList={{ "dm-message-combined": combined() }}><Show when={!combined()}><Show when={message.sender === "you"} fallback={<span class="dm-avatar" style={{ background: conversation().color }}>{conversation().initial}</span>}><span class="dm-avatar">Y</span></Show></Show><div class="dm-message-body"><Show when={!combined()}><header><strong>{message.sender === "you" ? "You" : conversation().name}</strong><Show when={message.sender === "them"}><Badge name={conversation().community} /></Show><time>{message.time}</time></header></Show><p title={combined() ? message.time : undefined}>{message.text}</p><For each={message.attachments}>{file => <a class="dm-file" href={file.url} download={file.name}><Paperclip size={16} />{file.name}</a>}</For></div></article>; }}</For></div></div>
      <div class="dm-compose-wrap">
        <input ref={filePicker} type="file" multiple hidden aria-label="Choose attachments" onChange={event => {
          const selectedFiles = Array.from(event.currentTarget.files ?? []);
          if ((attachments()[selectedId()] ?? []).length + selectedFiles.length > MAX_ATTACHMENTS) {
            setAttachmentError(`Maximum ${MAX_ATTACHMENTS} attachments.`);
            event.currentTarget.value = "";
            return;
          }
          setAttachmentError("");
          const files = selectedFiles.map(file => {
            const url = URL.createObjectURL(file);
            attachmentUrls.push(url);
            return { name: file.name, url };
          });
          setAttachments(items => ({ ...items, [selectedId()]: [...(items[selectedId()] ?? []), ...files] }));
          event.currentTarget.value = "";
        }} />
        <Show when={attachments()[selectedId()]?.length}><div class="dm-attachment-drafts"><For each={attachments()[selectedId()]}>{file => <span class="dm-file"><Paperclip size={16} />{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => { setAttachmentError(""); setAttachments(items => ({ ...items, [selectedId()]: (items[selectedId()] ?? []).filter(item => item !== file) })); }}><X size={14} /></button></span>}</For></div></Show>
        <Show when={attachmentError()}><p class="mb-2 text-sm text-[#ff7373]" role="alert">{attachmentError()}</p></Show>
        <Show when={picker()}><div class="dm-emoji-picker" aria-label={picker() === "emoji" ? "Choose an emoji" : "Choose a sticker"}><For each={picker() === "emoji" ? ["🙂", "😂", "💚", "👍", "👀", "✨", "🔥", "🙌"] : ["🌻", "🐸", "🍎", "🛸"]}>{emoji => <button type="button" aria-label={`Insert ${emoji}`} onClick={() => { setDrafts(items => ({ ...items, [selectedId()]: (items[selectedId()] ?? "") + emoji })); setPicker(null); }}>{emoji}</button>}</For></div></Show>
        <form class="dm-compose" onSubmit={event => { event.preventDefault(); sendMessage(); }}>
          <button type="button" class="dm-compose-tool" aria-label="Add attachment" title="Add attachment" onClick={() => filePicker?.click()}><Plus size={21} /></button>
          <input ref={messageInput} aria-label={`Message ${conversation().name}`} placeholder={`Message @${conversation().name}`} value={drafts()[selectedId()] ?? ""} onInput={event => setDrafts(items => ({ ...items, [selectedId()]: event.currentTarget.value }))} />
          <div class="dm-compose-actions">
            <button type="button" class="dm-compose-tool" aria-label="Choose emoji" aria-expanded={picker() === "emoji"} onClick={() => setPicker(value => value === "emoji" ? null : "emoji")}><Smile size={21} /></button>
            <button type="button" class="dm-compose-tool" aria-label="Choose sticker" aria-expanded={picker() === "sticker"} onClick={() => setPicker(value => value === "sticker" ? null : "sticker")}><Sticker size={21} /></button>
            <button type="button" class="dm-compose-tool" aria-label="Add media" title="Media is not available in this preview" disabled><Video size={21} /></button>
          </div>
          <button type="submit" class="dm-send" aria-label="Send message" disabled={!(drafts()[selectedId()] ?? "").trim() && !(attachments()[selectedId()] ?? []).length}>Send</button>
        </form>
      </div>
    </section>
    }</Show>
  </div>;
}
