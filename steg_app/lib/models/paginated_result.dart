class PaginatedResult<T> {
  const PaginatedResult({
    required this.data,
    required this.total,
    required this.page,
    required this.pages,
  });

  final List<T> data;
  final int total;
  final int page;
  final int pages;
}
