/** One page of `items`, in the shape the shared pagination footer reads. */
export function pageOf<T>(items: T[], page: number, perPage: number) {
  const lastPage = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(page, lastPage);
  const start = (current - 1) * perPage;
  const data = items.slice(start, start + perPage);
  return {
    data,
    current_page: current,
    last_page: lastPage,
    total: items.length,
    from: data.length > 0 ? start + 1 : null,
    to: data.length > 0 ? start + data.length : null,
  };
}
