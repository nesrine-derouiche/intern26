import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/application_status.dart';
import '../common/status_pill.dart';

class ApplicationStatusBadge extends StatelessWidget {
  const ApplicationStatusBadge({super.key, required this.status});

  final ApplicationStatut status;

  static IconData icon(ApplicationStatut status) {
    return switch (status) {
      ApplicationStatut.enAttente => Icons.hourglass_top,
      ApplicationStatut.acceptee => Icons.check_circle_outline,
      ApplicationStatut.refusee => Icons.cancel_outlined,
      ApplicationStatut.stagiaireCree => Icons.celebration_outlined,
    };
  }

  static Color color(ApplicationStatut status) {
    return switch (status) {
      ApplicationStatut.enAttente => AppColors.warning,
      ApplicationStatut.acceptee => AppColors.success,
      ApplicationStatut.refusee => AppColors.danger,
      ApplicationStatut.stagiaireCree => AppColors.info,
    };
  }

  @override
  Widget build(BuildContext context) {
    return StatusPill(
      label: status.label,
      color: color(status),
      icon: icon(status),
      dot: false,
    );
  }
}
