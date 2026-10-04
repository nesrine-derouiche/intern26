import 'package:flutter/material.dart';

import '../common/app_card.dart';
import '../common/skeleton_box.dart';

class CalendarSkeleton extends StatelessWidget {
  const CalendarSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const SkeletonBox(width: 200, height: 20),
        const SizedBox(height: 16),
        AppCard(
          padding: const EdgeInsets.all(12),
          child: GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              mainAxisSpacing: 6,
              crossAxisSpacing: 6,
            ),
            itemCount: 35,
            itemBuilder: _gridItem,
          ),
        ),
        const SizedBox(height: 16),
        const SkeletonBox(width: 160, height: 18),
        const SizedBox(height: 12),
        for (var i = 0; i < 3; i++) ...[
          const AppCard(
            padding: EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(width: double.infinity, height: 14),
                SizedBox(height: 8),
                SkeletonBox(width: 140, height: 12),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }

  static Widget _gridItem(BuildContext context, int index) {
    return const SkeletonBox(height: 36, width: double.infinity);
  }
}
