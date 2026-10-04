import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../models/internship.dart';
import '../../models/user.dart';
import '../common/animated_progress.dart';
import '../common/app_avatar.dart';

/// Branded header with the current internship summary for stagiaires.
class HomeHero extends StatelessWidget {
  const HomeHero({
    super.key,
    required this.user,
    this.internship,
    this.department,
  });

  final User? user;
  final Internship? internship;
  final String? department;

  @override
  Widget build(BuildContext context) {
    final user = this.user;
    final internship = this.internship;
    final name = user?.fullName ?? 'Utilisateur';
    final prenom = user?.prenom ?? '';
    final greeting =
        prenom.trim().isEmpty ? 'Bonjour !' : 'Bonjour, $prenom !';
    final isStagiaire = user?.role == 'STAGIAIRE';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.32),
            blurRadius: 26,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppAvatar(
                    name: name,
                    size: 60,
                    background: Colors.white.withValues(alpha: 0.22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          greeting,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 21,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.8),
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _HeroPill(
                              icon: Icons.verified_outlined,
                              label: roleLabel(user?.role ?? ''),
                            ),
                            if (isStagiaire && internship != null)
                              _HeroPill(
                                icon: Icons.today_outlined,
                                label: internship.statut == 'EN_COURS'
                                    ? 'En cours'
                                    : internship.statut,
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (isStagiaire) ...[
                const SizedBox(height: 18),
                Container(
                  height: 1,
                  color: Colors.white.withValues(alpha: 0.16),
                ),
                const SizedBox(height: 14),
                if (internship == null)
                  Row(
                    children: [
                      const _HeroIcon(icon: Icons.work_outline),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Aucun stage en cours',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.9),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  )
                else ...[
                  Row(
                    children: [
                      const _HeroIcon(icon: Icons.work_outline),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              internship.titre,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _departmentLine(department ?? internship.departementNom),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.72),
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      _ProgressRing(progress: internship.progress),
                    ],
                  ),
                  const SizedBox(height: 14),
                  AnimatedLinearProgress(
                    value: internship.progress / 100,
                    minHeight: 6,
                    backgroundColor: Colors.white.withValues(alpha: 0.18),
                    color: Colors.white,
                  ),
                ],
              ],
            ],
          ),
        ],
      ),
    );
  }

  static String _departmentLine(String department) {
    if (department.trim().isEmpty) return 'Département non renseigné';
    return 'Département · $department';
  }
}

class _HeroIcon extends StatelessWidget {
  const _HeroIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(13),
      ),
      child: Icon(icon, size: 21, color: Colors.white),
    );
  }
}

class _HeroPill extends StatelessWidget {
  const _HeroPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressRing extends StatelessWidget {
  const _ProgressRing({required this.progress});

  final int progress;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 46,
      height: 46,
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedCircularProgress(
            value: progress / 100,
            strokeWidth: 4,
            backgroundColor: Colors.white.withValues(alpha: 0.18),
            color: Colors.white,
          ),
          Text(
            '$progress%',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

String roleLabel(String role) {
  return switch (role) {
    'STAGIAIRE' => 'Stagiaire',
    'ENCADRANT' => 'Encadrant',
    'CHEF_DEPARTEMENT' => 'Chef de département',
    'ADMIN' => 'Administrateur',
    'RH' => 'Ressources humaines',
    _ => role,
  };
}
