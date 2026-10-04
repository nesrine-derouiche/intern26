import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../models/reunion.dart';
import '../../providers/dashboard/dashboard_providers.dart';
import '../../widgets/common/app_section_header.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/dashboard/dashboard_skeletons.dart';
import '../../widgets/dashboard/reunion_card.dart';

class MyMeetingsScreen extends ConsumerWidget {
  const MyMeetingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reunionsAsync = ref.watch(myReunionsProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Mes réunions'),
      ),
      body: _buildBody(context, ref, reunionsAsync),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<List<Reunion>> reunionsAsync,
  ) {
    if (reunionsAsync.isLoading && !reunionsAsync.hasValue) {
      return ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 4,
        itemBuilder: (context, index) => const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: ReunionCardSkeleton(),
        ),
      );
    }

    if (reunionsAsync.hasError && !reunionsAsync.hasValue) {
      return ErrorView(
        message: reunionsAsync.error.toString(),
        onRetry: () => ref.refresh(myReunionsProvider.future),
      );
    }

    final reunions = reunionsAsync.value ?? const <Reunion>[];
    if (reunions.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => ref.refresh(myReunionsProvider.future),
        child: const CustomScrollView(
          physics: AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverFillRemaining(
              hasScrollBody: false,
              child: EmptyState(
                icon: Icons.event_outlined,
                title: 'Aucune réunion',
                message:
                    'Les réunions planifiées avec votre encadrant apparaîtront ici.',
              ),
            ),
          ],
        ),
      );
    }

    final upcoming = reunions.where((r) => r.estAVenir).toList()
      ..sort((a, b) => _compareDate(a, b));
    final past = reunions.where((r) => !r.estAVenir).toList()
      ..sort((a, b) => _compareDate(b, a));

    return RefreshIndicator(
      onRefresh: () => ref.refresh(myReunionsProvider.future),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (upcoming.isNotEmpty) ...[
            _SectionHeader(title: 'À venir', count: upcoming.length, accent: true),
            for (final reunion in upcoming)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: ReunionCard(
                  reunion: reunion,
                  onTap: () => _openDetail(context, reunion),
                ),
              ),
          ],
          if (past.isNotEmpty) ...[
            _SectionHeader(title: 'Passées', count: past.length, accent: false),
            for (final reunion in past)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: ReunionCard(
                  reunion: reunion,
                  onTap: () => _openDetail(context, reunion),
                ),
              ),
          ],
        ],
      ),
    );
  }

  int _compareDate(Reunion a, Reunion b) {
    final da = a.date;
    final db = b.date;
    if (da == null && db == null) return a.heure.compareTo(b.heure);
    if (da == null) return 1;
    if (db == null) return -1;
    final dateCompare = da.compareTo(db);
    if (dateCompare != 0) return dateCompare;
    return a.heure.compareTo(b.heure);
  }

  void _openDetail(BuildContext context, Reunion reunion) {
    context.push(
      '${RoutePaths.mesReunions}/${reunion.id}',
      extra: reunion,
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    required this.count,
    required this.accent,
  });

  final String title;
  final int count;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return AppSectionHeader(
      icon: accent ? Icons.upcoming_outlined : Icons.history,
      title: title,
      count: count,
      color: accent ? AppColors.primary : AppColors.textSecondary,
    );
  }
}
