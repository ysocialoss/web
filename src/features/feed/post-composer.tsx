import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, ChartNoAxesColumn, Plus, X } from "lucide-react";
import { ComingSoonDialog } from "@/components/coming-soon-dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { LoginDialogContent } from "@/features/auth/login-dialog-content";
import { MentionTextarea } from "./mention-textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FeedState } from "./use-feed";
import { GifPicker } from "@/features/gifs/gif-picker";
import {
  pollDraftSchema,
  type GifSearchItem,
  type PollDraft,
  type Post,
  type VoiceDraft,
} from "@/lib/api";
import { QuotedPostCard } from "./quoted-post";
import { quoteOf } from "./quote";
import { VoiceRecorder } from "./voice-recorder";
import { renderShortcodes } from "@/lib/emoji";
import { useEmojiIndex } from "@/lib/use-emoji-index";
import {
  TopicSuggestionList,
  topicOptionId,
  useTopicSuggestions,
} from "./topic-suggestions";

export type QuoteOptions = {
  /** Compose a quote of this post instead of an ordinary post. */
  quote?: Post;
  autoFocus?: boolean;
  /** Called right after the quote is handed off for sending. */
  onSubmitted?: () => void;
  /** Called once the server has saved the quote. */
  onConfirmed?: (post: Post) => void;
};

export function PostComposer({
  feed,
  placeholder = "What's on your mind?",
  topics = true,
  dropUp = false,
  ...quoting
}: {
  feed: FeedState;
  placeholder?: string;
  /** Offer #topic completion. */
  topics?: boolean;
  /** Open suggestion lists above the field (for composers pinned to the bottom). */
  dropUp?: boolean;
} & QuoteOptions) {
  if (!feed.sessionLoading && !feed.authenticated) {
    return (
      <Dialog>
        <DialogTrigger
          render={
            <button
              type="button"
              className="mx-auto block w-full max-w-xl rounded-[1.75rem] bg-muted px-4 py-4 text-left text-sm leading-5 text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring sm:px-5 md:text-base md:leading-6"
            />
          }
        >
          {placeholder}
        </DialogTrigger>
        <LoginDialogContent
          title="Log in to post"
          description="Sign in with CNS to share what's on your mind."
        />
      </Dialog>
    );
  }
  return (
    <AuthenticatedPostComposer
      feed={feed}
      placeholder={placeholder}
      topics={topics}
      dropUp={dropUp}
      {...quoting}
    />
  );
}

const LIMIT = 2000;
// The ring only shows up once the end is in sight.
const RING_FROM = 1600;
const MAX_HEIGHT = 240;

/** A small ring that fills and shifts from yellow to red as the limit nears. */
function LimitRing({ length }: { length: number }) {
  const progress = Math.min(
    1,
    Math.max(0, (length - RING_FROM) / (LIMIT - RING_FROM)),
  );
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const hue = 95 - 70 * progress;
  const visible = length >= RING_FROM;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={`flex size-6 shrink-0 items-center justify-center transition-opacity duration-200 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
          />
        }
      >
        <svg
          viewBox="0 0 20 20"
          className="size-5 -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="10"
            cy="10"
            r={radius}
            fill="none"
            strokeWidth="2.5"
            className="stroke-foreground/15"
          />
          <circle
            cx="10"
            cy="10"
            r={radius}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            style={{ stroke: `oklch(0.8 0.19 ${hue})` }}
            className="transition-[stroke-dashoffset,stroke] duration-150"
          />
        </svg>
      </TooltipTrigger>
      <TooltipContent>
        {length.toLocaleString()} / {LIMIT.toLocaleString()}
      </TooltipContent>
    </Tooltip>
  );
}

function AuthenticatedPostComposer({
  feed,
  placeholder,
  topics,
  dropUp,
  quote,
  autoFocus,
  onSubmitted,
  onConfirmed,
}: {
  feed: FeedState;
  placeholder: string;
  topics: boolean;
  dropUp: boolean;
} & QuoteOptions) {
  const [published, setPublished] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [soonOpen, setSoonOpen] = useState(false);
  const [gif, setGif] = useState<GifSearchItem | null>(null);
  const [poll, setPoll] = useState<PollDraft | null>(null);
  const [voice, setVoice] = useState<VoiceDraft>();
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceKey, setVoiceKey] = useState(0);
  // Kept here, not in the feed state: typing must not re-render every post.
  const [draft, setDraft] = useState("");
  const [height, setHeight] = useState<number>();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const scrolls = (height ?? 0) > MAX_HEIGHT;
  const helpId = useId();
  const suggestionsId = useId();
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const pendingCaret = useRef<number | null>(null);
  const suggestions = useTopicSuggestions(
    draft,
    caret,
    topics && focused && feed.canPost,
  );
  const emojiIndex = useEmojiIndex(focused);
  const finalDraft = emojiIndex ? renderShortcodes(draft, emojiIndex) : draft;
  const length = Array.from(finalDraft.trim()).length;
  const parsedPoll = poll ? pollDraftSchema.safeParse(poll) : null;
  const valid =
    feed.canPost &&
    !voiceBusy &&
    (length > 0 || gif !== null || poll !== null || voice !== undefined) &&
    length <= LIMIT &&
    (parsedPoll === null || parsedPoll.success);

  // A hidden copy of the text measures how tall the field needs to be, so the
  // visible one can animate between heights (field-sizing cannot transition).
  useLayoutEffect(() => {
    const copy = mirror.current;
    if (!copy) return;
    const update = () => setHeight(copy.offsetHeight || undefined);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(copy);
    return () => observer.disconnect();
  }, []);

  // After a completion rewrites the text, put the caret behind the topic.
  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    textarea.current?.setSelectionRange(
      pendingCaret.current,
      pendingCaret.current,
    );
    pendingCaret.current = null;
  }, [draft]);

  useEffect(() => {
    if (autoFocus) textarea.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!published) return;
    const timer = setTimeout(() => setPublished(false), 2000);
    return () => clearTimeout(timer);
  }, [published]);

  function pickTopic(name: string) {
    const completed = suggestions.complete(name);
    if (!completed) return;
    pendingCaret.current = completed.caret;
    setCaret(completed.caret);
    setDraft(completed.text);
    textarea.current?.focus();
  }

  function publish() {
    if (!valid) return;
    const started = quote
      ? feed.publishQuote(quote, finalDraft, gif, parsedPoll?.data, onConfirmed, voice)
      : feed.publishPost(finalDraft, gif, parsedPoll?.data, voice);
    if (!started) return;
    onSubmitted?.();
    setVoice(undefined);
    setVoiceKey((key) => key + 1);
    setGif(null);
    setPoll(null);
    textarea.current?.blur();
    setDraft("");
    setPublished(true);
  }

  const textClass = "py-1.5 text-base leading-6 md:text-base";
  return (
    <>
    <Dialog open={gifPickerOpen} onOpenChange={setGifPickerOpen}>
      {/* Equal 8px padding above, below and right of the buttons (36px). */}
      <div className="relative mx-auto w-full max-w-xl">
        <form
          className="flex w-full flex-wrap items-end gap-2 rounded-[1.75rem] bg-muted p-2 pl-4 transition-shadow focus-within:ring-1 focus-within:ring-border sm:pl-5"
          aria-label="Post composer"
          onSubmit={(event) => {
            event.preventDefault();
            publish();
          }}
        >
          {gif && (
            <div className="w-full pt-2">
              <div className="relative w-fit max-w-full">
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  className="max-h-40 max-w-full rounded-xl"
                />
                <IconButton
                  label="Remove GIF"
                  type="button"
                  size="icon-sm"
                  className="absolute top-1 right-1 rounded-full bg-background"
                  onClick={() => {
                    setGif(null);
                    textarea.current?.focus();
                  }}
                >
                  <X />
                </IconButton>
              </div>
            </div>
          )}
          <div
            className="relative min-h-9 min-w-0 flex-1 basis-[calc(100%-0.5rem)] transition-[height] duration-200 ease-out"
            style={{
              height: height ? Math.min(height, MAX_HEIGHT) : undefined,
            }}
          >
            <div
              ref={mirror}
              aria-hidden="true"
              className={`pointer-events-none invisible absolute inset-x-0 top-0 min-h-9 break-words whitespace-pre-wrap ${textClass}`}
            >
              {draft || " "}
              {"\u200b"}
            </div>
            <MentionTextarea
              ref={textarea}
              aria-label={placeholder.replace("…", "")}
              aria-describedby={helpId}
              limitPostBlankLines
              aria-controls={suggestions.open ? suggestionsId : undefined}
              aria-activedescendant={
                suggestions.open && suggestions.index >= 0
                  ? topicOptionId(suggestionsId, suggestions.index)
                  : undefined
              }
              placeholder={placeholder}
              rows={1}
              value={draft}
              onValueChange={setDraft}
              topics={topics}
              dropUp={dropUp}
              wrapperClassName="relative h-full"
              disabled={!feed.canPost}
              onChange={(event) => {
                setPublished(false);
                setDraft(event.target.value);
                setCaret(event.target.selectionStart);
              }}
              onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(event) => {
                if (suggestions.open && !event.nativeEvent.isComposing) {
                  const chosen =
                    suggestions.items[Math.max(suggestions.index, 0)];
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    suggestions.move(event.key === "ArrowDown" ? 1 : -1);
                    return;
                  }
                  if (
                    (event.key === "Tab" && !event.shiftKey) ||
                    (event.key === "Enter" &&
                      !event.ctrlKey &&
                      !event.metaKey &&
                      !event.shiftKey &&
                      suggestions.index >= 0)
                  ) {
                    event.preventDefault();
                    pickTopic(chosen.name);
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    suggestions.dismiss();
                    return;
                  }
                }
                if (
                  event.key === "Enter" &&
                  (event.ctrlKey || event.metaKey) &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  if (!event.repeat) publish();
                }
                if (event.key === "Escape" && !draft) {
                  event.currentTarget.blur();
                }
              }}
              style={{ overflowY: scrolls ? "auto" : "hidden" }}
              className={`absolute inset-0 h-full min-h-0 resize-none field-sizing-fixed rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 disabled:bg-transparent disabled:opacity-100 dark:bg-transparent dark:disabled:bg-transparent ${textClass}`}
            />
          </div>
          {poll && (
            <PollFields
              poll={poll}
              onChange={setPoll}
              onRemove={() => {
                setPoll(null);
                textarea.current?.focus();
              }}
              disabled={!feed.canPost}
            />
          )}
          <VoiceRecorder
            key={voiceKey}
            userId={feed.viewerId}
            disabled={!feed.canPost}
            onChange={setVoice}
            onBusyChange={setVoiceBusy}
            renderToolbar={(recordButton) => (
              <div className="-ml-2 flex shrink-0 basis-[calc(100%+0.5rem)] items-center gap-0.5">
                <IconButton
                  label="Upload"
                  type="button"
                  className="rounded-full text-muted-foreground"
                  onClick={() => setSoonOpen(true)}
                >
                  <Plus aria-hidden="true" />
                </IconButton>
                {!poll && (
                  <IconButton
                    label="Add poll"
                    type="button"
                    className="rounded-full text-muted-foreground"
                    disabled={!feed.canPost}
                    onClick={() =>
                      setPoll({
                        title: "",
                        options: ["", ""],
                        anonymous: false,
                      })
                    }
                  >
                    <ChartNoAxesColumn aria-hidden="true" />
                  </IconButton>
                )}
                {recordButton}
                <DialogTrigger
                  render={
                    <IconButton
                      label={gif ? "Change GIF" : "Add GIF"}
                      type="button"
                      disabled={!feed.canPost}
                      className="rounded-full text-muted-foreground"
                    />
                  }
                >
                  <span className="text-[10px] font-semibold">GIF</span>
                </DialogTrigger>
                <div className="ml-auto flex items-center gap-1">
                  <LimitRing length={length} />
                  <IconButton
                    label={quote ? "Publish quote" : "Publish post"}
                    type="submit"
                    variant="default"
                    className="rounded-full"
                    disabled={!valid}
                  >
                    <ArrowUp />
                  </IconButton>
                </div>
              </div>
            )}
          />
          <p id={helpId} className="sr-only">
            {feed.canPost
              ? "Enter adds a new line. Press Ctrl+Enter or Command+Enter to post. Maximum 2000 characters."
              : "Sign in and complete your profile to post or reply."}
            {length >= RING_FROM &&
              ` ${LIMIT - length >= 0 ? `${LIMIT - length} characters left.` : `${length - LIMIT} characters over the limit.`}`}
          </p>
          <p role="status" className="sr-only">
            {published ? "Post added" : ""}
          </p>
        </form>
        {quote && (
          <QuotedPostCard quote={quoteOf(quote)} interactive={false} className="mx-1" />
        )}
        <TopicSuggestionList
          id={suggestionsId}
          suggestions={suggestions}
          dropUp={dropUp}
          onPick={pickTopic}
        />
        <p role="status" className="sr-only">
          {suggestions.open
            ? `${suggestions.items.length} topic suggestions. Use the arrow keys to choose and Tab to insert.`
            : ""}
        </p>
      </div>
      {gifPickerOpen && (
        <GifPicker
          onSelect={(item) => {
            setGif(item);
            setGifPickerOpen(false);
          }}
        />
      )}
    </Dialog>
    <ComingSoonDialog open={soonOpen} onOpenChange={setSoonOpen} />
    </>
  );
}

function PollFields({
  poll,
  onChange,
  onRemove,
  disabled,
}: {
  poll: PollDraft;
  onChange: (poll: PollDraft) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const labels = poll.options.map((option) => option.trim().toLowerCase());
  const duplicates = labels.some((label, index) => label && labels.indexOf(label) !== index);
  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 w-full space-y-2 rounded-2xl border border-border bg-background p-3 text-sm"
    >
      <legend className="sr-only">Poll</legend>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <ChartNoAxesColumn className="size-4 text-muted-foreground" aria-hidden="true" />
          Poll
        </div>
        <IconButton
          label="Remove poll"
          type="button"
          size="icon-sm"
          className="-mr-1 rounded-full text-muted-foreground"
          disabled={disabled}
          onClick={onRemove}
        >
          <X />
        </IconButton>
      </div>
      <Input
        aria-label="Poll title (required)"
        placeholder="Poll title"
        required
        autoFocus
        maxLength={120}
        value={poll.title}
        onChange={(event) => onChange({ ...poll, title: event.target.value })}
      />
      {poll.options.map((option, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <Input
            aria-label={`Option ${index + 1}`}
            placeholder={`Option ${index + 1}`}
            required
            maxLength={80}
            value={option}
            aria-invalid={Boolean(labels[index] && labels.indexOf(labels[index]) !== index)}
            onChange={(event) => {
              const options = [...poll.options];
              options[index] = event.target.value;
              onChange({ ...poll, options });
            }}
          />
          {index >= 2 && index === poll.options.length - 1 && (
            <IconButton
              label="Remove last option"
              type="button"
              size="icon-sm"
              className="rounded-full text-muted-foreground"
              disabled={disabled}
              onClick={() => onChange({ ...poll, options: poll.options.slice(0, -1) })}
            >
              <X />
            </IconButton>
          )}
        </div>
      ))}
      {duplicates && (
        <p role="status" className="text-xs text-destructive">Give each option a different label.</p>
      )}
      {poll.options.length < 6 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full text-muted-foreground"
          disabled={disabled}
          onClick={() => onChange({ ...poll, options: [...poll.options, ""] })}
        >
          <Plus aria-hidden="true" />
          Add option
        </Button>
      )}
      <div className="space-y-1 border-t border-border pt-2 text-sm">
        <label className="flex min-h-8 cursor-pointer items-center gap-2.5 px-1">
          <Checkbox
            checked={poll.anonymous}
            disabled={disabled}
            onCheckedChange={(anonymous) => onChange({ ...poll, anonymous })}
          />
          Anonymous voting
        </label>
      </div>
    </fieldset>
  );
}
