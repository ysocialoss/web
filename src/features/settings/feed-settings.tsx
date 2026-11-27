import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api, errorMessage, type FeedFeedbackList, type FeedSlider } from "@/lib/api";
import { isTopicName, normalizeTopic } from "@/lib/topics";
import { SettingsGroup } from "./settings-group";

type SliderValues = Record<FeedSlider, number>;
type SessionSliders = Partial<Record<"feedDiscovery" | "feedFreshness" | "feedReplies", number>>;

const sessionKey = { discovery: "feedDiscovery", freshness: "feedFreshness", replies: "feedReplies" } as const;

const sliders: { key: FeedSlider; title: string; description: string; low: string; high: string; steps: string[] }[] = [
  {
    key: "discovery",
    title: "Discovery",
    description: "How many posts come from people you don't follow yet.",
    low: "Mostly people you follow",
    high: "Lots of new people",
    steps: ["Mostly people you follow", "Fewer new people", "Balanced", "More new people", "Lots of new people"],
  },
  {
    key: "freshness",
    title: "Freshness",
    description: "How strongly newer posts are preferred.",
    low: "Older posts too",
    high: "Only the newest",
    steps: ["Older posts too", "A bit older", "Balanced", "Newer", "Only the newest"],
  },
  {
    key: "replies",
    title: "Replies",
    description: "How often replies from people you follow show up.",
    low: "No replies",
    high: "Lots of replies",
    steps: ["No replies", "Fewer replies", "Balanced", "More replies", "Lots of replies"],
  },
];

const linkButton =
  "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50";

function daysLeft(expiresAt: string | null) {
  if (!expiresAt) return "";
  const days = Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
  return days === 1 ? "1 day left" : `${days} days left`;
}

function SliderRow({
  item,
  value,
  disabled,
  onCommit,
}: {
  item: (typeof sliders)[number];
  value: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(value);
  }
  return (
    <div className="px-4 py-3.5">
      <p id={`feed-${item.key}-label`} className="text-sm font-medium">{item.title}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
      <Slider
        className="mt-4"
        min={-2}
        max={2}
        step={1}
        value={[draft]}
        disabled={disabled}
        thumbLabel={item.title}
        valueText={(current) => item.steps[current + 2] ?? ""}
        onValueChange={(next) => setDraft(Array.isArray(next) ? next[0]! : next)}
        onValueCommitted={(next) => {
          const committed = Array.isArray(next) ? next[0]! : next;
          if (committed !== value) onCommit(committed);
        }}
      />
      <div className="mt-2 flex justify-between gap-4 text-xs text-muted-foreground" aria-hidden="true">
        <span>{item.low}</span>
        <span className="font-medium text-foreground">{item.steps[draft + 2]}</span>
        <span className="text-right">{item.high}</span>
      </div>
    </div>
  );
}

export function FeedSettings({
  userId,
  personalize,
  values,
  onSlidersChange,
}: {
  userId: string;
  personalize: boolean;
  values: SliderValues;
  onSlidersChange: (userId: string, values: SessionSliders) => void;
}) {
  const [list, setList] = useState<FeedFeedbackList | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [topic, setTopic] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.feedFeedback(controller.signal)
      .then((loaded) => {
        setList(loaded);
        setLoadError("");
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(reason));
      });
    return () => controller.abort();
  }, [revision]);

  const reload = () => setRevision((current) => current + 1);

  async function commit(key: FeedSlider, next: number) {
    const previous = values[key];
    setError("");
    onSlidersChange(userId, { [sessionKey[key]]: next });
    try {
      const saved = await api.setFeedSliders({ [key]: next });
      onSlidersChange(userId, { feedDiscovery: saved.discovery, feedFreshness: saved.freshness, feedReplies: saved.replies });
    } catch (reason) {
      onSlidersChange(userId, { [sessionKey[key]]: previous });
      setError(errorMessage(reason));
    }
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      reload();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  function addTopic(direction: 1 | -1, name = topic) {
    const normalized = normalizeTopic(name.trim().replace(/^#/, ""));
    if (!isTopicName(normalized)) {
      setError("Topics start with a letter and use only letters, numbers and underscores.");
      return;
    }
    void run(async () => {
      await api.addFeedFeedback({ kind: "topic", topic: normalized, direction });
      setTopic("");
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    addTopic(submitter?.value === "less" ? -1 : 1);
  }

  const more = list?.topics.filter((entry) => entry.direction > 0) ?? [];
  const fewer = list?.topics.filter((entry) => entry.direction < 0) ?? [];

  return (
    <>
      <SettingsGroup
        title="How your Feed is ranked"
        description={<>Tune what the Feed shows first. <a href="/legal/feed" className="underline underline-offset-4">How the feed works</a></>}
      >
        {!personalize && (
          <p className="px-4 py-3 text-sm text-muted-foreground">These apply when your Feed is on.</p>
        )}
        {sliders.map((item) => (
          <SliderRow
            key={item.key}
            item={item}
            value={values[item.key]}
            disabled={busy}
            onCommit={(next) => void commit(item.key, next)}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup title="Topics" description="Ask for more or fewer posts about a #topic. These stay until you remove them.">
        <form className="flex flex-wrap items-center gap-2 px-4 py-3.5" onSubmit={submit}>
          <Input
            aria-label="Topic"
            placeholder="#topic"
            value={topic}
            maxLength={33}
            onChange={(event) => setTopic(event.target.value)}
            className="min-w-0 flex-1 basis-40"
          />
          <Button type="submit" value="more" variant="outline" size="sm" disabled={busy || !topic.trim()}>More</Button>
          <Button type="submit" value="less" variant="outline" size="sm" disabled={busy || !topic.trim()}>Fewer</Button>
        </form>
        {[{ label: "More about", entries: more }, { label: "Fewer about", entries: fewer }].map((group) => (
          <div key={group.label} className="px-4 py-3.5">
            <p className="text-sm font-medium">{group.label}</p>
            {group.entries.length ? (
              <ul className="mt-2 flex flex-wrap gap-2" aria-label={group.label}>
                {group.entries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-3 text-sm">
                    #{entry.topic}
                    <button
                      type="button"
                      aria-label={`Remove #${entry.topic}`}
                      disabled={busy}
                      onClick={() => void run(() => api.removeFeedFeedback(entry.id))}
                      className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">None yet.</p>
            )}
          </div>
        ))}
        {!!list?.suggestedTopics.length && (
          <div className="px-4 py-3.5">
            <p className="text-sm font-medium">Suggested from your activity</p>
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Suggested topics">
              {list.suggestedTopics.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => addTopic(1, name)}
                    className="rounded-full border px-3 py-0.5 text-sm hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    More #{name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SettingsGroup>

      <SettingsGroup title="Snoozed accounts" description="Their posts stay out of your Feed for 30 days. You still see them in Following and on their profile.">
        {list?.snoozed.length ? list.snoozed.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{entry.user.displayName || entry.user.handle}</p>
              <p className="truncate text-sm text-muted-foreground">@{entry.user.handle} · {daysLeft(entry.expiresAt)}</p>
            </div>
            <button
              type="button"
              className={linkButton}
              disabled={busy}
              onClick={() => void run(() => api.removeFeedFeedback(entry.id))}
            >
              Unsnooze
            </button>
          </div>
        )) : (
          <p className="px-4 py-3.5 text-sm text-muted-foreground">{list ? "No snoozed accounts." : loadError || "Loading…"}</p>
        )}
      </SettingsGroup>

      <SettingsGroup title="Posts you rated">
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-medium">Not interested</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {list ? `${list.posts.notInterested} ${list.posts.notInterested === 1 ? "post" : "posts"} hidden from your Feed for 60 days.` : "Loading…"}
            </p>
          </div>
          <button
            type="button"
            className={linkButton}
            disabled={busy || !list?.posts.notInterested}
            onClick={() => void run(async () => {
              const { removed } = await api.clearFeedFeedback("post");
              return removed;
            })}
          >
            Clear
          </button>
        </div>
        {error && (
          <p role="alert" className="px-4 py-3 text-sm text-destructive">{error}</p>
        )}
      </SettingsGroup>
    </>
  );
}
