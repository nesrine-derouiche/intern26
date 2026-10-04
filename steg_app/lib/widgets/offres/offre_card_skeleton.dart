import 'package:flutter/material.dart';

import '../common/skeleton_box.dart';
import '../common/skeleton_card.dart';

class OffreCardSkeleton extends StatelessWidget {
  const OffreCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SkeletonBox(width: 46, height: 46, radius: 23),
              SizedBox(width: 14),
              Expanded(
                child: SkeletonBox(width: double.infinity, height: 16, radius: 6),
              ),
              SizedBox(width: 12),
              SkeletonBox(width: 72, height: 24, radius: 999),
            ],
          ),
          SizedBox(height: 14),
          SkeletonBox(width: 140, height: 12, radius: 4),
          SizedBox(height: 12),
          SkeletonBox(width: double.infinity, height: 12, radius: 4),
          SizedBox(height: 6),
          SkeletonBox(width: 180, height: 12, radius: 4),
          SizedBox(height: 14),
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              SkeletonBox(width: 90, height: 12, radius: 4),
              SkeletonBox(width: 90, height: 12, radius: 4),
              SkeletonBox(width: 110, height: 12, radius: 4),
            ],
          ),
        ],
      ),
    );
  }
}


