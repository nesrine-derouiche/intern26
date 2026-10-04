import 'package:flutter/material.dart';

import '../common/skeleton_box.dart';
import '../common/skeleton_card.dart';

class ApplicationCardSkeleton extends StatelessWidget {
  const ApplicationCardSkeleton({super.key});

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
              SkeletonBox(width: 86, height: 24, radius: 999),
            ],
          ),
          SizedBox(height: 14),
          SkeletonBox(width: 150, height: 12, radius: 4),
          SizedBox(height: 10),
          SkeletonBox(width: 110, height: 12, radius: 4),
        ],
      ),
    );
  }
}


