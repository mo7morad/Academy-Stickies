/**
 * Prev/next paging for a long list. Callers render it above and below the list
 * they're paging so reaching the bottom of one page doesn't mean scrolling
 * back up. It stays silent for screen readers — the caller's range count is
 * the live region — and disappears entirely when there's only one page.
 */
export function Pager({
  page,
  totalPages,
  label,
  onPage,
}: {
  page: number;
  totalPages: number;
  /** Names what's being paged, e.g. "Roster pages". */
  label: string;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav class="pagination" aria-label={label}>
      <button
        class="btn btn--tinted"
        disabled={page === 1}
        onClick={() => onPage(Math.max(1, page - 1))}
      >
        &larr; Prev
      </button>
      <span class="pagination__status">
        Page {page} of {totalPages}
      </span>
      <button
        class="btn btn--tinted"
        disabled={page === totalPages}
        onClick={() => onPage(Math.min(totalPages, page + 1))}
      >
        Next &rarr;
      </button>
    </nav>
  );
}
