import 'package:flutter/material.dart';

import '../common/skeleton_box.dart';
import '../common/skeleton_card.dart';

class DashboardSkeleton extends StatelessWidget {
  const DashboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        SkeletonBox(width: 220, height: 20, radius: 6),
        SizedBox(height: 8),
        SkeletonBox(width: 320, height: 14, radius: 4),
        SizedBox(height: 20),
        _SkeletonGrid(),
        SizedBox(height: 16),
        SkeletonBox(width: double.infinity, height: 140, radius: 12),
        SizedBox(height: 16),
        Row(
          children: [
            Expanded(child: SkeletonBox(width: double.infinity, height: 120, radius: 12)),
            SizedBox(width: 16),
            Expanded(child: SkeletonBox(width: double.infinity, height: 120, radius: 12)),
          ],
        ),
        SizedBox(height: 24),
        SkeletonBox(width: 160, height: 18, radius: 5),
        SizedBox(height: 12),
        TacheCardSkeleton(),
        SizedBox(height: 12),
        TacheCardSkeleton(),
        SizedBox(height: 24),
        SkeletonBox(width: 160, height: 18, radius: 5),
        SizedBox(height: 12),
        ReunionCardSkeleton(),
        SizedBox(height: 12),
        ReunionCardSkeleton(),
      ],
    );
  }
}

class _SkeletonGrid extends StatelessWidget {
  const _SkeletonGrid();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: const [
        Expanded(child: SkeletonBox(width: double.infinity, height: 110, radius: 12)),
        SizedBox(width: 12),
        Expanded(child: SkeletonBox(width: double.infinity, height: 110, radius: 12)),
      ],
    );
  }
}

class TacheCardSkeleton extends StatelessWidget {
  const TacheCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          Row(
            children: [
              SkeletonBox(width: 46, height: 46, radius: 23),
              SizedBox(width: 14),
              Expanded(child: SkeletonBox(width: double.infinity, height: 16, radius: 6)),
              SizedBox(width: 12),
              SkeletonBox(width: 82, height: 24, radius: 999),
            ],
          ),
          SizedBox(height: 14),
          SkeletonBox(width: 160, height: 12, radius: 4),
          SizedBox(height: 10),
          SkeletonBox(width: 110, height: 12, radius: 4),
          SizedBox(height: 16),
          SkeletonBox(width: double.infinity, height: 8, radius: 4),
        ],
      ),
    );
  }
}

class ReunionCardSkeleton extends StatelessWidget {
  const ReunionCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          Row(
            children: [
              SkeletonBox(width: 46, height: 46, radius: 23),
              SizedBox(width: 14),
              Expanded(child: SkeletonBox(width: double.infinity, height: 16, radius: 6)),
              SizedBox(width: 12),
              SkeletonBox(width: 70, height: 24, radius: 999),
            ],
          ),
          SizedBox(height: 14),
          SkeletonBox(width: 180, height: 12, radius: 4),
          SizedBox(height: 10),
          SkeletonBox(width: 130, height: 12, radius: 4),
        ],
      ),
    );
  }
}

class DocumentCardSkeleton extends StatelessWidget {
  const DocumentCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonCard(
      padding: const EdgeInsets.all(14),
      child: const Row(
        children: [
          SkeletonBox(width: 44, height: 44, radius: 22),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(width: double.infinity, height: 14, radius: 4),
                SizedBox(height: 8),
                SkeletonBox(width: 140, height: 12, radius: 4),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class NotificationCardSkeleton extends StatelessWidget {
  const NotificationCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonCard(
      padding: const EdgeInsets.all(14),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SkeletonBox(width: 40, height: 40, radius: 20),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(width: double.infinity, height: 14, radius: 4),
                SizedBox(height: 8),
                SkeletonBox(width: double.infinity, height: 12, radius: 4),
                SizedBox(height: 8),
                SkeletonBox(width: 90, height: 11, radius: 4),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
