

interface PaginationProps {
  page: number;
  totalPages: number;
  setPage: (page: number | ((p: number) => number)) => void;
}

export function Pagination({ page, totalPages, setPage }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div class="pagination">
      <button
        class="btn btn--tinted pagination-btn"
        disabled={page === 1}
        onClick={() => setPage((p) => p - 1)}
      >
        Prev
      </button>
      {Array.from({ length: totalPages }).map((_, i) => (
        <button
          key={i}
          class={`btn pagination-btn ${page === i + 1 ? "btn--filled" : "btn--tinted"}`}
          onClick={() => setPage(i + 1)}
        >
          {i + 1}
        </button>
      ))}
      <button
        class="btn btn--tinted pagination-btn"
        disabled={page === totalPages}
        onClick={() => setPage((p) => p + 1)}
      >
        Next
      </button>
    </div>
  );
}
