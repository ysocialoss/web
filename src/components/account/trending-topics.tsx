import { useEffect, useState } from "react";
import { Link } from "react-router";
import NumberFlow from "@number-flow/react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { subscribeToPublished } from "@/features/feed/post-outbox";
import { api, type TopicCount } from "@/lib/api";
import { countFormat } from "@/lib/count-format";
import { topicPath } from "@/lib/topics";

const REFRESH_EVERY = 60_000;

/** The most used topics of the last 24 hours, kept fresh while the tab is open. */
const STORAGE_KEY = "trending-topics";
let remembered: TopicCount[] | null | undefined;

function readRemembered() {
  if (remembered !== undefined) return remembered;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    remembered = Array.isArray(parsed) ? (parsed as TopicCount[]) : null;
  } catch {
    remembered = null;
  }
  return remembered;
}

function remember(topics: TopicCount[]) {
  remembered = topics;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
  } catch {
    remembered = topics;
  }
}

function useTrendingTopics() {
  const [topics, setTopics] = useState<TopicCount[] | null>(readRemembered);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let controller: AbortController | undefined;
    function load() {
      controller?.abort();
      const own = (controller = new AbortController());
      api
        .trendingTopics(own.signal)
        .then((result) => {
          remember(result.topics);
          setTopics(result.topics);
          setFailed(false);
        })
        .catch(() => {
          if (!own.signal.aborted) setFailed(true);
        });
    }
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_EVERY);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const unsubscribe = subscribeToPublished(load);
    return () => {
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
    };
  }, []);
  return { topics, failed };
}

export function TrendingTopicsStrip() {
  const { topics, failed } = useTrendingTopics();
  if (topics === null && !failed)
    return (
      <div aria-hidden="true" className="mx-auto mb-4 flex w-full max-w-xl items-center gap-2 pb-1 lg:hidden">
        <Skeleton className="h-4 w-14 shrink-0" />
        {[0, 1, 2, 3].map((pill) => (
          <Skeleton key={pill} className="h-8 w-20 shrink-0 rounded-full" />
        ))}
      </div>
    );
  if (!topics?.length) return null;
  return (
    <section
      aria-label="Trending topics"
      className="mx-auto mb-4 w-full max-w-xl lg:hidden"
    >
      <ul className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <li className="shrink-0 text-xs font-semibold text-muted-foreground">
          Trending
        </li>
        {topics.map((topic) => (
          <li key={topic.name} className="shrink-0">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    to={topicPath(topic.name)}
                    aria-label={`#${topic.name}, ${topic.count.toLocaleString()} ${topic.count === 1 ? "post" : "posts"} in the last 24 hours`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  />
                }
              >
                #{topic.name}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {topic.count.toLocaleString()}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {topic.count.toLocaleString()}{" "}
                {topic.count === 1 ? "post" : "posts"} in the last 24 hours
              </TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TrendingTopics() {
  const { topics, failed } = useTrendingTopics();
  return (
    <section aria-labelledby="trending-heading">
      <Tooltip>
        <TooltipTrigger
          render={
            <h2
              id="trending-heading"
              tabIndex={0}
              className="w-fit rounded-sm text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          Trending Topics
        </TooltipTrigger>
        <TooltipContent side="left">
          The topics with the most new posts in the last 24 hours
        </TooltipContent>
      </Tooltip>
      {topics === null && !failed && (
        <ul aria-hidden="true" className="mt-3 space-y-1">
          {[0, 1, 2].map((row) => (
            <li key={row} className="flex items-center justify-between py-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-6" />
            </li>
          ))}
        </ul>
      )}
      {topics === null && failed && (
        <p className="mt-3 text-sm text-muted-foreground">
          Couldn't load topics.
        </p>
      )}
      {topics?.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing is trending yet. Add #topic to a post to start one.
        </p>
      )}
      {topics && topics.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {topics.map((topic) => (
            <li key={topic.name}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      to={topicPath(topic.name)}
                      aria-label={`#${topic.name}, ${topic.count.toLocaleString()} ${topic.count === 1 ? "post" : "posts"} in the last 24 hours`}
                      className="group flex items-center justify-between gap-3 rounded-sm py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  }
                >
                  <span className="min-w-0 truncate transition-colors group-hover:text-primary group-hover:underline">
                    #{topic.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    <NumberFlow format={countFormat} value={topic.count} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {topic.count.toLocaleString()}{" "}
                  {topic.count === 1 ? "post" : "posts"} in the last 24 hours
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
