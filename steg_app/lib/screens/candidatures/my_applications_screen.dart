import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/candidature.dart';
import '../../providers/candidatures/applications_providers.dart';
import '../../providers/offres/offres_providers.dart';
import '../../widgets/candidatures/application_card.dart';
import '../../widgets/candidatures/application_card_skeleton.dart';
import '../../widgets/candidatures/application_status_badge.dart';
import '../../widgets/common/app_section_header.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';

class MyApplicationsScreen extends ConsumerWidget {
  const MyApplicationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final applicationsAsync = ref.watch(myCandidaturesProvider);
    final sections = ref.watch(applicationsSectionsProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Mes candidatures'),
      ),
      body: _buildBody(context, ref, applicationsAsync, sections),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<List<Candidature>> applicationsAsync,
    List<ApplicationSection> sections,
  ) {
    if (applicationsAsync.isLoading && !applicationsAsync.hasValue) {
      return ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 4,
        itemBuilder: (context, index) => const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: ApplicationCardSkeleton(),
        ),
      );
    }

    if (applicationsAsync.hasError && !applicationsAsync.hasValue) {
      return ErrorView(
        message: applicationsAsync.error.toString(),
        onRetry: () => ref.refresh(myCandidaturesProvider.future),
      );
    }

    final total = sections.fold<int>(0, (sum, section) => sum + section.items.length);

    if (total == 0) {
      return RefreshIndicator(
        onRefresh: () => ref.refresh(myCandidaturesProvider.future),
        child: const CustomScrollView(
          physics: AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverFillRemaining(
              hasScrollBody: false,
              child: EmptyState(
                icon: Icons.fact_check_outlined,
                title: 'Aucune candidature',
                message:
                    'Postulez à une offre de stage pour retrouver votre historique ici.',
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.refresh(myCandidaturesProvider.future),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final section in sections)
            if (section.items.isNotEmpty) ...[
              _SectionHeader(section: section),
              const SizedBox(height: 8),
              for (final candidature in section.items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: ApplicationCard(candidature: candidature),
                ),
            ],
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.section});

  final ApplicationSection section;

  @override
  Widget build(BuildContext context) {
    final status = section.status;
    return AppSectionHeader(
      icon: ApplicationStatusBadge.icon(status),
      title: status.label,
      count: section.items.length,
      color: ApplicationStatusBadge.color(status),
    );
  }
}
