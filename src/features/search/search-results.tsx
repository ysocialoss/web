import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router";
import { RotateCcw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoadingSkeleton } from "@/components/loading-skeletons";
import { DisplayName } from "@/components/display-name";
import { Feed } from "@/features/feed/feed";
import { useFeed } from "@/features/feed/use-feed";
import {
  api,
  errorMessage,
  type SearchUser,
  type Session,
  type TopicCount,
} from "@/lib/api";
import { countFormat } from "@/lib/count-format";
import { topicPath } from "@/lib/topics";

type Page<T> = { items: T[]; nextCursor: string | null };
type FetchPage<T> = (
  query: string,
  cursor: string | undefined,
  signal: AbortSignal,
) => Promise<Page<T>>;

const compactCount = new Intl.NumberFormat(undefined, countFormat);
const plural = (count: number, one: string, many: string) =>
  `${compactCount.format(count)} ${count === 1 ? one : many}`;

const fetchUsers: FetchPage<SearchUser> = (query, cursor, signal) =>
  api
    .searchUsers(query, cursor, signal)
    .then((page) => ({ items: page.users, nextCursor: page.nextCursor }));
const fetchTopics: FetchPage<TopicCount> = (query, cursor, signal) =>
  api
    .searchTopics(query, cursor, signal)
    .then((page) => ({ items: page.topics, nextCursor: page.nextCursor }));

function usePagedResults<T>(query: string, fetchPage: FetchPage<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const request = useCallback(
    (cursor: string | undefined, signal: AbortSignal) =>
      fetchPage(query, cursor, signal)
        .then((page) => {
          if (signal.aborted) return;
          setItems((current) =>
            cursor ? [...current, ...page.items] : page.items,
          );
          setNextCursor(page.nextCursor);
          setLoading(false);
        })
        .catch((failure: unknown) => {
          if (signal.aborted) return;
          setError(errorMessage(failure));
          setLoading(false);
        }),
    [query, fetchPage],
  );
  useEffect(() => {
    const own = (controller.current = new AbortController());
    void request(undefined, own.signal);
    return () => own.abort();
  }, [request]);
  function run(cursor?: string) {
    controller.current?.abort();
    const own = (controller.current = new AbortController());
    setLoading(true);
    setError("");
    void request(cursor, own.signal);
  }
  return {
    items,
    loading,
    error,
    loadMore: nextCursor ? () => run(nextCursor) : null,
    retry: () => run(nextCursor ?? undefined),
  };
}

export function UserResult({
  user,
  onOpen,
}: {
  user: SearchUser;
  onOpen: () => void;
}) {
  return (
    <Link
      to={`/@${user.handle}`}
      onClick={onOpen}
      className="flex items-start gap-3 rounded-lg px-2 py-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Avatar userId={user.id} className="size-10 shrink-0" aria-hidden="true">
        {user.avatarUrl && (
          <AvatarImage
            src={user.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
          />
        )}
        <AvatarFallback className="text-xs">
          {(user.displayName || user.handle).slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <DisplayName
          as="p"
          user={user}
          name={user.displayName || user.handle}
          className="truncate font-semibold"
        />
        <p className="truncate text-xs text-muted-foreground">
          @{user.handle} · {plural(user.followerCount, "follower", "followers")}
        </p>
        {user.bio && (
          <p className="mt-1 line-clamp-2 text-sm wrap-anywhere">{user.bio}</p>
        )}
      </div>
    </Link>
  );
}

export function TopicResult({
  topic,
  onOpen,
}: {
  topic: TopicCount;
  onOpen: () => void;
}) {
  return (
    <Link
      to={topicPath(topic.name)}
      onClick={onOpen}
      className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0 truncate font-semibold">#{topic.name}</span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {plural(topic.count, "post", "posts")}
      </span>
    </Link>
  );
}

function ResultsSkeleton({ label }: { label: string }) {
  return (
    <LoadingSkeleton label={label}>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-3 px-2 py-3">
          <Skeleton className="size-10 rounded-[30%]" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </LoadingSkeleton>
  );
}

function ResultsFooter({
  loading,
  error,
  loadMore,
  retry,
}: {
  loading: boolean;
  error: string;
  loadMore: (() => void) | null;
  retry: () => void;
}) {
  return (
    <>
      {error && (
        <div role="alert" className="space-y-2 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={retry}>
            <RotateCcw aria-hidden="true" />
            Try again
          </Button>
        </div>
      )}
      {loadMore && !loading && !error && (
        <div className="flex justify-center py-3">
          <Button variant="outline" onClick={loadMore}>
            Show more
          </Button>
        </div>
      )}
    </>
  );
}

export function PeopleResults({
  query,
  onOpen,
}: {
  query: string;
  onOpen: () => void;
}) {
  const results = usePagedResults(query, fetchUsers);
  return (
    <div className="mx-auto mt-4 w-full max-w-xl">
      <ul className="divide-y">
        {results.items.map((user) => (
          <li key={user.id}>
            <UserResult user={user} onOpen={onOpen} />
          </li>
        ))}
      </ul>
      {results.loading && <ResultsSkeleton label="Loading people…" />}
      {!results.loading && !results.error && results.items.length === 0 && (
        <p role="status" className="py-4 text-muted-foreground">
          No people match this search.
        </p>
      )}
      <ResultsFooter {...results} />
    </div>
  );
}

export function TopicResults({
  query,
  onOpen,
}: {
  query: string;
  onOpen: () => void;
}) {
  const results = usePagedResults(query, fetchTopics);
  return (
    <div className="mx-auto mt-4 w-full max-w-xl">
      <ul className="divide-y">
        {results.items.map((topic) => (
          <li key={topic.name}>
            <TopicResult topic={topic} onOpen={onOpen} />
          </li>
        ))}
      </ul>
      {results.loading && <ResultsSkeleton label="Loading topics…" />}
      {!results.loading && !results.error && results.items.length === 0 && (
        <p role="status" className="py-4 text-muted-foreground">
          No topics match this search. Topics are written as #name in a post.
        </p>
      )}
      <ResultsFooter {...results} />
    </div>
  );
}

function Section({
  title,
  seeAllLabel,
  onSeeAll,
  children,
}: {
  title: string;
  seeAllLabel: string;
  onSeeAll: (() => void) | null;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="mt-4">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
        {onSeeAll && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={seeAllLabel}
                  onClick={onSeeAll}
                />
              }
            >
              See all
            </TooltipTrigger>
            <TooltipContent>{seeAllLabel}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <ul className="divide-y">{children}</ul>
    </section>
  );
}

function SearchPreview({
  query,
  onOpen,
  onSeeAllPeople,
  onSeeAllTopics,
}: {
  query: string;
  onOpen: () => void;
  onSeeAllPeople: () => void;
  onSeeAllTopics: () => void;
}) {
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof api.search>
  > | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api
      .search(query, controller.signal)
      .then(setResult)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [query]);
  if (!result)
    return failed ? (
      <p className="mt-4 px-2 text-sm text-muted-foreground">
        Couldn't load people and topics.
      </p>
    ) : (
      <ResultsSkeleton label="Loading people and topics…" />
    );
  const people = result.users.length > 0 && (
    <Section
      key="people"
      title="People"
      seeAllLabel="See all people"
      onSeeAll={result.moreUsers ? onSeeAllPeople : null}
    >
      {result.users.map((user) => (
        <li key={user.id}>
          <UserResult user={user} onOpen={onOpen} />
        </li>
      ))}
    </Section>
  );
  const topics = result.topics.length > 0 && (
    <Section
      key="topics"
      title="Topics"
      seeAllLabel="See all topics"
      onSeeAll={result.moreTopics ? onSeeAllTopics : null}
    >
      {result.topics.map((topic) => (
        <li key={topic.name}>
          <TopicResult topic={topic} onOpen={onOpen} />
        </li>
      ))}
    </Section>
  );
  return query.trimStart().startsWith("#") ? (
    <>
      {topics}
      {people}
    </>
  ) : (
    <>
      {people}
      {topics}
    </>
  );
}

export function PostResults({
  query,
  search,
  session,
  withPreview,
  onOpen,
  onSeeAllPeople,
  onSeeAllTopics,
}: {
  query: string;
  search: string;
  session: Session | null;
  withPreview: boolean;
  onOpen: () => void;
  onSeeAllPeople: () => void;
  onSeeAllTopics: () => void;
}) {
  const feed = useFeed(session, undefined, true, undefined, undefined, search);
  const { key } = useLocation();
  return (
    <Feed
      feed={feed}
      refreshKey={key}
      showComposer={false}
      emptyMessage="No posts match this search."
      header={
        <div className="mx-auto w-full max-w-xl">
          {withPreview && (
            <>
              <SearchPreview
                query={query}
                onOpen={onOpen}
                onSeeAllPeople={onSeeAllPeople}
                onSeeAllTopics={onSeeAllTopics}
              />
              <h2 className="-mb-3 mt-6 px-2 text-sm font-semibold text-muted-foreground">
                Posts
              </h2>
            </>
          )}
        </div>
      }
    />
  );
}
