export function TrendingTopics() {
  return (
    <section aria-labelledby="trending-heading" className="mt-10">
      <h2 id="trending-heading" className="text-base font-semibold">
        Trending Topics
      </h2>
      <ul className="mt-3 space-y-1 text-sm">
        {["#1", "#2", "#3"].map((topic) => (
          <li key={topic} className="py-2">
            <span className="transition-colors hover:text-primary hover:underline">
              {topic}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
