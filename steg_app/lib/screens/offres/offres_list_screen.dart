import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../core/routing/route_paths.dart';
import '../../models/offre.dart';
import '../../providers/offres/offres_providers.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/offres/offre_card.dart';
import '../../widgets/offres/offre_card_skeleton.dart';
import '../../widgets/offres/offre_filter_sheet.dart';

class OffresListScreen extends ConsumerStatefulWidget {
  const OffresListScreen({super.key});

  @override
  ConsumerState<OffresListScreen> createState() => _OffresListScreenState();
}

class _OffresListScreenState extends ConsumerState<OffresListScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    if (position.pixels >= position.maxScrollExtent - 200) {
      final total = ref.read(offresFilteredProvider).length;
      ref.read(offresUiProvider.notifier).loadMore(total);
    }
  }

  Future<void> _refresh() => ref.read(offresListProvider.notifier).refresh();

  void _clearSearch() {
    _searchController.clear();
    ref.read(offresUiProvider.notifier).setSearch('');
  }

  void _openFilters() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => const OffreFilterSheet(),
    );
  }

  void _openDetails(Offre offre) {
    context.push(
      RoutePaths.offreDetails.replaceFirst(':id', offre.id),
      extra: offre,
    );
  }

  @override
  Widget build(BuildContext context) {
    final filters = ref.watch(offresUiProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Offres de stage'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    onChanged: (value) =>
                        ref.read(offresUiProvider.notifier).setSearch(value),
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      hintText: 'Rechercher une offre...',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _searchController.text.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(Icons.clear),
                              tooltip: 'Effacer la recherche',
                              onPressed: _clearSearch,
                            ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Badge.count(
                  count: filters.activeFilterCount,
                  isLabelVisible: filters.hasFilters,
                  child: IconButton.filledTonal(
                    tooltip: 'Filtres',
                    onPressed: _openFilters,
                    icon: const Icon(Icons.tune),
                  ),
                ),
              ],
            ),
          ),
          Expanded(child: _buildContent()),
        ],
      ),
    );
  }

  Widget _buildContent() {
    final offresAsync = ref.watch(offresListProvider);

    if (offresAsync.isLoading && !offresAsync.hasValue) {
      return ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        itemCount: 5,
        itemBuilder: (context, index) =>
            const Padding(padding: EdgeInsets.only(bottom: 12), child: OffreCardSkeleton()),
      );
    }

    if (offresAsync.hasError && !offresAsync.hasValue) {
      return ErrorView(
        message: offresAsync.error is ApiException
            ? offresAsync.error.toString()
            : 'Impossible de charger les offres. Veuillez réessayer.',
        onRetry: _refresh,
      );
    }

    final filtered = ref.watch(offresFilteredProvider);
    final visible = ref.watch(offresVisibleProvider);
    final hasMore = visible.length < filtered.length;

    if (filtered.isEmpty) {
      final hasFilters = ref.read(offresUiProvider).hasFilters;
      return RefreshIndicator(
        onRefresh: _refresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverFillRemaining(
              hasScrollBody: false,
              child: EmptyState(
                icon: Icons.work_off_outlined,
                title: hasFilters ? 'Aucun résultat' : 'Aucune offre disponible',
                message: hasFilters
                    ? 'Modifiez votre recherche ou vos filtres pour trouver des offres.'
                    : 'Les offres de stage apparaîtront ici dès qu\'elles seront publiées.',
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        itemCount: visible.length + (hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= visible.length) {
            return Padding(
              padding: const EdgeInsets.only(top: 4),
              child: OutlinedButton.icon(
                onPressed: () =>
                    ref.read(offresUiProvider.notifier).loadMore(filtered.length),
                icon: const Icon(Icons.keyboard_arrow_down),
                label: Text(
                  'Voir plus (${filtered.length - visible.length} '
                  '${filtered.length - visible.length > 1 ? 'offres' : 'offre'})',
                ),
              ),
            );
          }
          final offre = visible[index];
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: OffreCard(offre: offre, onTap: () => _openDetails(offre)),
          );
        },
      ),
    );
  }
}
