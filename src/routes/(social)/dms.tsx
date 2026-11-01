import {
  createMemo,
  createSignal,
  For,
  Show,
  onCleanup,
  onMount,
} from "solid-js";
import { MAX_ATTACHMENTS } from "~/lib/attachments";
import {
  Component,
  ChevronRight,
  Search,
  Plus,
  Smile,
  Sticker,
  Video,
  X,
  Paperclip,
} from "~/components/Icons";

type Attachment = { name: string; url: string };
type Message = {
  attachments?: Attachment[];
  sender: "them" | "you";
  text: string;
  time: string;
};
type Conversation = {
  id: string;
  name: string;
  community: string;
  initial: string;
  color: string;
  unread: number;
  messages: Message[];
};
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
  return (
    currentTime !== undefined &&
    previousTime !== undefined &&
    currentTime >= previousTime &&
    currentTime - previousTime <= messageGroupWindowMinutes
  );
}

function Badge(props: { name: string }) {
  return (
    <span data-badge class="inline-flex items-center gap-1 rounded-[5px] bg-[#bd3e41] px-[5px] py-[3px] text-[11px] leading-[14px] font-bold max-[701px]:text-[9px]">
      <Component size={12} />
      {props.name}
    </span>
  );
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
  const [attachments, setAttachments] = createSignal<
    Record<string, Attachment[]>
  >({});
  const [attachmentError, setAttachmentError] = createSignal("");
  const attachmentUrls: string[] = [];
  onCleanup(() => attachmentUrls.forEach((url) => URL.revokeObjectURL(url)));
  let filePicker: HTMLInputElement | undefined;
  const [drafts, setDrafts] = createSignal<Record<string, string>>({});
  const selected = createMemo(() =>
    conversations().find((item) => item.id === selectedId()),
  );
  const filtered = createMemo(() =>
    conversations().filter(
      (item) =>
        item.name.toLowerCase().includes(query().toLowerCase()) &&
        (!unreadOnly() || item.unread > 0),
    ),
  );
  let history: HTMLDivElement | undefined;
  onMount(() => history?.scrollTo({ top: history.scrollHeight }));

  function openConversation(id: string) {
    setAttachmentError("");
    setPicker(null);
    setSelectedId(id);
    setMobileChat(true);
    setConversations((items) =>
      items.map((item) => (item.id === id ? { ...item, unread: 0 } : item)),
    );
    if (unreadOnly() && !conversations().some((item) => item.unread > 0))
      setUnreadOnly(false);
    queueMicrotask(() => history?.scrollTo({ top: history.scrollHeight }));
  }
  function startConversation() {
    const name = recipient().trim().replace(/^@/, "").trim();
    if (!name) return;
    const existing = conversations().find(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );
    const id = existing?.id ?? crypto.randomUUID();
    if (!existing) {
      setConversations((items) => [
        {
          id,
          name,
          community: "",
          initial: Array.from(name)[0].toUpperCase(),
          color: "#00d363",
          unread: 0,
          messages: [],
        },
        ...items,
      ]);
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
    const message: Message = {
      sender: "you",
      text,
      attachments: files,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    };
    setConversations((items) =>
      items.map((item) =>
        item.id === selectedId()
          ? { ...item, messages: [...item.messages, message] }
          : item,
      ),
    );
    setDrafts((items) => ({ ...items, [selectedId()]: "" }));
    setAttachments((items) => ({ ...items, [selectedId()]: [] }));
    queueMicrotask(() =>
      history?.scrollTo({ top: history.scrollHeight, behavior: "smooth" }),
    );
  }

  return (
    <div class="
      group/dm grid h-full min-h-0 grid-cols-[310px_minmax(0,1fr)] gap-10
      max-[1701px]:grid-cols-[290px_minmax(0,1fr)] max-[1701px]:gap-8
      max-[1251px]:grid-cols-[260px_minmax(0,1fr)] max-[1251px]:gap-6
      min-[701px]:max-[951px]:grid-cols-[210px_minmax(0,1fr)] min-[701px]:max-[951px]:gap-5 max-[701px]:flex
    " data-chat-open={mobileChat()}>
      <section class="flex min-w-0 flex-col max-[701px]:w-full max-[701px]:group-data-[chat-open=true]/dm:hidden" aria-label="Conversations">
        <div class="flex items-center gap-2.5 [&_label]:min-w-0 [&_label]:flex-1">
          <label class="
            flex h-[50px] items-center gap-3 rounded-[28px] bg-[#202020] px-[17px] text-[#999]
            focus-within:shadow-[inset_0_0_0_1px_#00d363] [&_input]:w-full [&_input]:min-w-0 [&_input]:border-0
            [&_input]:bg-transparent [&_input]:text-[14px] [&_input]:text-[#f5f5f5] [&_input]:outline-none
          ">
            <Search size={20} />
            <input
              aria-label="Search conversations"
              placeholder="Search messages"
              value={query()}
              onInput={(event) => setQuery(event.currentTarget.value)}
            />
          </label>
          <button
            ref={newMessageButton}
            type="button"
            class="grid size-11 shrink-0 place-items-center rounded-full bg-[#202020] text-[#bbb] aria-expanded:bg-[#0c2b1a] aria-expanded:text-[#00d363]"
            aria-label="New message"
            title="New message"
            aria-expanded={startingConversation()}
            aria-controls="dm-new-conversation"
            onClick={() => {
              if (startingConversation()) {
                closeNewMessage();
                return;
              }
              setStartingConversation(true);
              queueMicrotask(() => recipientInput?.focus());
            }}
          >
            <Plus size={22} />
          </button>
        </div>
        <Show when={startingConversation()}>
          <form
            id="dm-new-conversation"
            class="
              mt-3 flex items-center gap-0.5 rounded-[14px] border border-[#383838] bg-[#1a1a1a] py-[3px]
              pr-[5px] pl-4 focus-within:border-[#527560] [&_input]:h-11 [&_input]:w-full [&_input]:min-w-0
              [&_input]:flex-1 [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-1.5 [&_input]:py-0
              [&_input]:text-[14px] [&_input]:outline-none [&_input]:placeholder:text-[#888] [&_button]:grid
              [&_button]:shrink-0 [&_button]:place-items-center [&_button]:rounded-[10px] [&_button]:text-[#999]
              [&_button[type=submit]]:bg-[#0c2b1a] [&_button[type=submit]]:text-[#00d363]
              [&_button[type=submit]:disabled]:bg-transparent [&_button[type=submit]:disabled]:text-[#555]
            "
            onSubmit={(event) => {
              event.preventDefault();
              startConversation();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeNewMessage();
              }
            }}
          >
            <span class="text-[15px] text-[#777]" aria-hidden="true">
              @
            </span>
            <label class="sr-only" for="dm-recipient">
              Recipient username
            </label>
            <input
              ref={recipientInput}
              id="dm-recipient"
              placeholder="Username"
              autocomplete="off"
              autocapitalize="none"
              spellcheck={false}
              required
              value={recipient()}
              onInput={(event) => setRecipient(event.currentTarget.value)}
            />
            <button
              type="button"
              aria-label="Cancel new message"
              title="Cancel"
              onClick={closeNewMessage}
            >
              <X size={18} />
            </button>
            <button
              type="submit"
              aria-label="Start conversation"
              title="Start conversation"
              disabled={!recipient().trim().replace(/^@/, "").trim()}
            >
              <ChevronRight size={20} />
            </button>
          </form>
        </Show>
        <div class="
          mt-4 mb-6 flex gap-2.5 [&_button]:min-h-9 [&_button]:rounded-3xl [&_button]:border
          [&_button]:border-[#404040] [&_button]:px-[17px] [&_button]:text-[13px]
          [&_button[aria-pressed=true]]:bg-[#0c2b1a] [&_button[aria-pressed=true]]:text-[#00d363]
          [&_button[aria-pressed=true]]:border-[#205b39] [&_span]:ml-[5px] [&_span]:text-[11px]
          [&_span]:text-[#999]
        " aria-label="Filter conversations">
          <button
            aria-pressed={!unreadOnly()}
            onClick={() => setUnreadOnly(false)}
          >
            All
          </button>
          <button
            aria-pressed={unreadOnly()}
            onClick={() => setUnreadOnly(true)}
          >
            Unread{" "}
            <span>
              {conversations().filter((item) => item.unread > 0).length}
            </span>
          </button>
        </div>
        <div class="overflow-y-auto">
          <Show when={conversations().length > 0 && filtered().length === 0}>
            <p class="px-3 py-6 text-[14px] text-[#888]">No results</p>
          </Show>
          <For each={filtered()}>
            {(item) => (
              <button
                class="
                  mb-[5px] flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-4
                  text-left aria-pressed:bg-[#202020] aria-pressed:border-[#454545] hover:bg-[#202020]
                  hover:scale-100! min-[701px]:max-[951px]:gap-2 min-[701px]:max-[951px]:px-2
                  min-[701px]:max-[951px]:[&>[data-avatar]]:hidden
                "
                onClick={() => openConversation(item.id)}
                aria-pressed={selectedId() === item.id}
              >
                <span data-avatar class="flex size-10 shrink-0 items-center justify-center rounded-full object-cover text-[23px] font-semibold text-[#181818]" style={{ background: item.color }}>
                  {item.initial}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex flex-wrap items-center gap-2 text-[14px] font-semibold [&_[data-badge]]:px-1 [&_[data-badge]]:py-0.5 [&_[data-badge]]:text-[9px]">
                    {item.name}
                    <Show when={item.community}>
                      <Badge name={item.community} />
                    </Show>
                  </span>
                  <span class="mt-[7px] block overflow-hidden text-[13px] text-ellipsis whitespace-nowrap text-[#888]">{item.messages.at(-1)?.text}</span>
                </span>
                <Show when={item.unread}>
                  <span class="grid h-[23px] min-w-[23px] place-items-center rounded-[20px] bg-[#0c2b1a] text-[11px] text-[#00d363]">{item.unread}</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </section>
      <Show when={selected()} fallback={<section class="flex min-h-0 min-w-0 flex-col max-[701px]:hidden max-[701px]:w-full max-[701px]:group-data-[chat-open=true]/dm:flex" />}>
        {(conversation) => (
          <section
            class="flex min-h-0 min-w-0 flex-col max-[701px]:hidden max-[701px]:w-full max-[701px]:group-data-[chat-open=true]/dm:flex"
            aria-label={`Conversation with ${conversation().name}`}
          >
            <header class="flex min-h-[50px] items-center gap-2 border-b border-[#252525]">
              <button
                class="hidden max-[701px]:-ml-2.5 max-[701px]:grid max-[701px]:place-items-center max-[701px]:[&_svg]:rotate-180"
                aria-label="Back to conversations"
                onClick={() => setMobileChat(false)}
              >
                <ChevronRight size={22} />
              </button>
              <h2 class="text-[14px] font-semibold [overflow-wrap:anywhere]">@{conversation().name}</h2>
            </header>
            <div
              class="flex min-h-0 flex-1 flex-col overflow-y-auto pt-[30px] pr-1 pb-2.5 [scrollbar-width:thin] [scrollbar-color:#333_transparent]"
              ref={history}
              role="log"
              aria-label="Message history"
              aria-live="polite"
            >
              <div class="mt-auto shrink-0 [&>div:last-child]:mb-0">
                <For each={conversation().messages}>
                  {(message, index) => {
                    const combined = () =>
                      combinesWithPrevious(
                        message,
                        conversation().messages[index() - 1],
                      );
                    return (
                      <article
                        class="
                          mb-7 flex gap-3 max-[701px]:mb-6 has-[+[data-combined=true]]:mb-0.5!
                          data-[combined=true]:pl-[52px] [&_header]:flex [&_header]:min-h-[22px]
                          [&_header]:flex-wrap [&_header]:items-center [&_header]:gap-2 [&_strong]:text-[14px]
                          [&_time]:text-[12px] [&_time]:text-[#888] [&_p]:mt-1 [&_p]:whitespace-pre-wrap
                          [&_p]:text-[14px] [&_p]:leading-[22px] [&_p]:[overflow-wrap:anywhere]
                          data-[combined=true]:[&_p]:mt-0
                        "
                        data-combined={combined()}
                      >
                        <Show when={!combined()}>
                          <Show
                            when={message.sender === "you"}
                            fallback={
                              <span
                                data-avatar class="flex size-10 shrink-0 items-center justify-center rounded-full object-cover text-[23px] font-semibold text-[#181818]"
                                style={{ background: conversation().color }}
                              >
                                {conversation().initial}
                              </span>
                            }
                          >
                            <span data-avatar class="flex size-10 shrink-0 items-center justify-center rounded-full object-cover text-[23px] font-semibold text-[#181818]">Y</span>
                          </Show>
                        </Show>
                        <div class="min-w-0">
                          <Show when={!combined()}>
                            <header>
                              <strong>
                                {message.sender === "you"
                                  ? "You"
                                  : conversation().name}
                              </strong>
                              <Show when={message.sender === "them"}>
                                <Badge name={conversation().community} />
                              </Show>
                              <time>{message.time}</time>
                            </header>
                          </Show>
                          <p title={combined() ? message.time : undefined}>
                            {message.text}
                          </p>
                          <For each={message.attachments}>
                            {(file) => (
                              <a
                                class="
                                  mt-1.5 inline-flex max-w-full items-center gap-2 rounded-lg border
                                  border-[#383838] bg-[#202020] px-2.5 py-1.5 text-[13px] [overflow-wrap:anywhere]
                                  [&_button]:grid [&_button]:min-h-7 [&_button]:min-w-7
                                  [&_button]:place-items-center
                                "
                                href={file.url}
                                download={file.name}
                              >
                                <Paperclip size={16} />
                                {file.name}
                              </a>
                            )}
                          </For>
                        </div>
                      </article>
                    );
                  }}
                </For>
              </div>
            </div>
            <div class="relative mt-3">
              <input
                ref={filePicker}
                type="file"
                multiple
                hidden
                aria-label="Choose attachments"
                onChange={(event) => {
                  const selectedFiles = Array.from(
                    event.currentTarget.files ?? [],
                  );
                  if (
                    (attachments()[selectedId()] ?? []).length +
                      selectedFiles.length >
                    MAX_ATTACHMENTS
                  ) {
                    setAttachmentError(
                      `Maximum ${MAX_ATTACHMENTS} attachments.`,
                    );
                    event.currentTarget.value = "";
                    return;
                  }
                  setAttachmentError("");
                  const files = selectedFiles.map((file) => {
                    const url = URL.createObjectURL(file);
                    attachmentUrls.push(url);
                    return { name: file.name, url };
                  });
                  setAttachments((items) => ({
                    ...items,
                    [selectedId()]: [...(items[selectedId()] ?? []), ...files],
                  }));
                  event.currentTarget.value = "";
                }}
              />
              <Show when={attachments()[selectedId()]?.length}>
                <div class="flex flex-wrap gap-2 pb-2.5">
                  <For each={attachments()[selectedId()]}>
                    {(file) => (
                      <span class="
                        mt-1.5 inline-flex max-w-full items-center gap-2 rounded-lg border border-[#383838]
                        bg-[#202020] px-2.5 py-1.5 text-[13px] [overflow-wrap:anywhere] [&_button]:grid
                        [&_button]:min-h-7 [&_button]:min-w-7 [&_button]:place-items-center
                      ">
                        <Paperclip size={16} />
                        {file.name}
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() => {
                            setAttachmentError("");
                            setAttachments((items) => ({
                              ...items,
                              [selectedId()]: (
                                items[selectedId()] ?? []
                              ).filter((item) => item !== file),
                            }));
                          }}
                        >
                          <X size={14} />
                        </button>
                      </span>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={attachmentError()}>
                <p class="mb-2 text-sm text-[#ff7373]" role="alert">
                  {attachmentError()}
                </p>
              </Show>
              <Show when={picker()}>
                <div
                  class="
                    absolute right-0 bottom-[calc(100%+10px)] flex max-w-[250px] flex-wrap rounded-xl border
                    border-[#383838] bg-[#202020] p-2 shadow-[0_8px_24px_#0005] [&_button]:rounded-lg
                    [&_button]:text-[24px]
                  "
                  aria-label={
                    picker() === "emoji"
                      ? "Choose an emoji"
                      : "Choose a sticker"
                  }
                >
                  <For
                    each={
                      picker() === "emoji"
                        ? ["🙂", "😂", "💚", "👍", "👀", "✨", "🔥", "🙌"]
                        : ["🌻", "🐸", "🍎", "🛸"]
                    }
                  >
                    {(emoji) => (
                      <button
                        type="button"
                        aria-label={`Insert ${emoji}`}
                        onClick={() => {
                          setDrafts((items) => ({
                            ...items,
                            [selectedId()]: (items[selectedId()] ?? "") + emoji,
                          }));
                          setPicker(null);
                        }}
                      >
                        {emoji}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
              <form
                class="
                  flex min-h-11 items-center gap-1.5 rounded-[10px] bg-[#202020] px-1.5 py-0.5
                  focus-within:outline focus-within:outline-[#00d363] focus-within:outline-offset-2
                  [&_input]:w-full [&_input]:min-w-0 [&_input]:border-0 [&_input]:bg-transparent
                  [&_input]:px-0.5 [&_input]:text-[13px] [&_input]:text-[#f5f5f5] [&_input]:outline-none
                  [&_input]:placeholder:text-[#808080]
                "
                onSubmit={(event) => {
                  event.preventDefault();
                  sendMessage();
                }}
              >
                <button
                  type="button"
                  class="grid size-9 min-h-9 min-w-9 shrink-0 place-items-center rounded-[7px] text-[#bbb] aria-expanded:bg-[#333] aria-expanded:text-[#f5f5f5] disabled:text-[#888]"
                  aria-label="Add attachment"
                  title="Add attachment"
                  onClick={() => filePicker?.click()}
                >
                  <Plus size={21} />
                </button>
                <input
                  ref={messageInput}
                  aria-label={`Message ${conversation().name}`}
                  placeholder={`Message @${conversation().name}`}
                  value={drafts()[selectedId()] ?? ""}
                  onInput={(event) =>
                    setDrafts((items) => ({
                      ...items,
                      [selectedId()]: event.currentTarget.value,
                    }))
                  }
                />
                <div class="flex items-center gap-0">
                  <button
                    type="button"
                    class="grid size-9 min-h-9 min-w-9 shrink-0 place-items-center rounded-[7px] text-[#bbb] aria-expanded:bg-[#333] aria-expanded:text-[#f5f5f5] disabled:text-[#888]"
                    aria-label="Choose emoji"
                    aria-expanded={picker() === "emoji"}
                    onClick={() =>
                      setPicker((value) => (value === "emoji" ? null : "emoji"))
                    }
                  >
                    <Smile size={21} />
                  </button>
                  <button
                    type="button"
                    class="grid size-9 min-h-9 min-w-9 shrink-0 place-items-center rounded-[7px] text-[#bbb] aria-expanded:bg-[#333] aria-expanded:text-[#f5f5f5] disabled:text-[#888]"
                    aria-label="Choose sticker"
                    aria-expanded={picker() === "sticker"}
                    onClick={() =>
                      setPicker((value) =>
                        value === "sticker" ? null : "sticker",
                      )
                    }
                  >
                    <Sticker size={21} />
                  </button>
                  <button
                    type="button"
                    class="grid size-9 min-h-9 min-w-9 shrink-0 place-items-center rounded-[7px] text-[#bbb] aria-expanded:bg-[#333] aria-expanded:text-[#f5f5f5] disabled:text-[#888]"
                    aria-label="Add media"
                    title="Media is not available in this preview"
                    disabled
                  >
                    <Video size={21} />
                  </button>
                </div>
                <button
                  type="submit"
                  class="shrink-0 px-2 text-[#00d363] disabled:text-[#777]"
                  aria-label="Send message"
                  disabled={
                    !(drafts()[selectedId()] ?? "").trim() &&
                    !(attachments()[selectedId()] ?? []).length
                  }
                >
                  Send
                </button>
              </form>
            </div>
          </section>
        )}
      </Show>
    </div>
  );
}
