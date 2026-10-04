import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/date_utils.dart';
import '../../models/internship.dart';
import '../../models/stagiaire_profile.dart';
import '../../models/user.dart';
import '../../providers/auth/auth_provider.dart';
import '../../providers/profile/profile_providers.dart';
import '../../widgets/common/animated_progress.dart';
import '../../widgets/common/app_avatar.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/app_section_header.dart';
import '../../widgets/common/skeleton_box.dart';
import '../../widgets/common/skeleton_card.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).value?.session?.user;
    final profileAsync = ref.watch(profileProvider);

    final isStagiaire = user?.role == 'STAGIAIRE';

    return Scaffold(
      appBar: AppBar(title: const Text('Mon profil')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(profileProvider.future),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
          children: [
            _ProfileHeader(
              user: user,
              profile: profileAsync.asData?.value,
              onEdit: () => _showEditPlaceholder(context),
            ),
            if (isStagiaire) ...[
              const SizedBox(height: 16),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 350),
                switchInCurve: Curves.easeOutCubic,
                switchOutCurve: Curves.easeInCubic,
                child: _buildStagiaireContent(ref, profileAsync),
              ),
            ],
            const SizedBox(height: 16),
            _ActionsCard(
              onOpenSettings: () => showModalBottomSheet<void>(
                context: context,
                showDragHandle: true,
                builder: (context) => const _SettingsSheet(),
              ),
              onLogout: () => ref.read(authProvider.notifier).logout(),
            ),
          ],
        ),
      ),
    );
  }

  static void _showEditPlaceholder(BuildContext context) {
    context.push(RoutePaths.editProfile);
  }

  Widget _buildStagiaireContent(
    WidgetRef ref,
    AsyncValue<StagiaireProfile?> profileAsync,
  ) {
    if (profileAsync.isLoading && !profileAsync.hasValue) {
      return const _ProgressCardSkeleton(key: ValueKey('profile-skeleton'));
    }

    if (profileAsync.hasError && !profileAsync.hasValue) {
      return _ErrorBanner(
        key: const ValueKey('profile-error'),
        message: profileAsync.error.toString(),
        onRetry: () => ref.refresh(profileProvider.future),
      );
    }

    final stage = profileAsync.value?.activeStage;
    if (stage == null) {
      return const _StageHint(key: ValueKey('profile-hint'));
    }

    return _ProgressCard(
      key: const ValueKey('profile-progress'),
      stage: stage,
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.user,
    required this.profile,
    required this.onEdit,
  });

  final User? user;
  final StagiaireProfile? profile;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final name = user?.fullName ?? 'Utilisateur';
    final role = roleLabel(user?.role ?? '');
    final departement = profile?.departementNom;

    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              Container(
                height: 84,
                width: double.infinity,
                decoration: const BoxDecoration(
                  gradient: AppColors.brandGradient,
                  borderRadius: BorderRadius.vertical(
                    top: Radius.circular(AppTheme.radiusLg),
                  ),
                ),
                child: Stack(
                  children: [
                    Positioned(
                      right: -24,
                      top: -40,
                      child: _DecorativeCircle(size: 130, opacity: 0.1),
                    ),
                    Positioned(
                      right: 90,
                      bottom: -50,
                      child: _DecorativeCircle(size: 110, opacity: 0.08),
                    ),
                  ],
                ),
              ),
              Positioned(
                right: 12,
                top: 12,
                child: IconButton(
                  tooltip: 'Modifier le profil',
                  onPressed: onEdit,
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: 0.22),
                    foregroundColor: Colors.white,
                  ),
                  icon: const Icon(Icons.edit_outlined, size: 20),
                ),
              ),
              Positioned(
                left: 18,
                bottom: -34,
                child: Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: theme.colorScheme.surface,
                    border: Border.all(
                      color: theme.colorScheme.surface,
                      width: 3,
                    ),
                    boxShadow: AppColors.softShadowSmall,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(2),
                    child: AppAvatar(name: name, size: 66),
                  ),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 42, 18, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                      ),
                      child: Text(
                        role,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    if (departement != null && departement.isNotEmpty) ...[
                      const SizedBox(width: 10),
                      Icon(
                        Icons.business_outlined,
                        size: 15,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          departement,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({super.key, required this.stage});

  final Internship stage;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final progress = stage.progress;
    final color = stage.isActive ? AppColors.primary : AppColors.success;
    final joursRestants = stage.dateFin == null
        ? null
        : dateOnly(stage.dateFin!).difference(dateOnly(DateTime.now())).inDays;
    final subtitle = (stage.dateFin != null &&
            joursRestants != null &&
            joursRestants >= 0)
        ? '$joursRestants ${joursRestants == 1 ? 'jour' : 'jours'} restants'
        : stage.periodeLabel;

    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          SizedBox(
            width: 58,
            height: 58,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AnimatedCircularProgress(
                  value: progress / 100,
                  strokeWidth: 6,
                  backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                  color: color,
                ),
                Center(
                  child: AnimatedCounter(
                    value: progress,
                    suffix: '%',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Mon stage',
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  stage.titre,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionsCard extends StatelessWidget {
  const _ActionsCard({
    required this.onOpenSettings,
    required this.onLogout,
  });

  final VoidCallback onOpenSettings;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16),
            leading: const Icon(
              Icons.settings_outlined,
              color: AppColors.textSecondary,
            ),
            title: const Text('Réglages'),
            trailing: const Icon(
              Icons.chevron_right,
              color: AppColors.textTertiary,
            ),
            onTap: onOpenSettings,
          ),
          const Divider(height: 1, indent: 56, endIndent: 16),
          ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16),
            leading: const Icon(Icons.logout, color: AppColors.danger),
            title: Text(
              'Déconnexion',
              style: TextStyle(
                color: AppColors.danger,
                fontWeight: FontWeight.w600,
              ),
            ),
            onTap: onLogout,
          ),
        ],
      ),
    );
  }
}

class _SettingsSheet extends ConsumerWidget {
  const _SettingsSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const AppSectionHeader(
              title: 'Réglages',
              icon: Icons.settings_outlined,
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(
                Icons.lock_outline,
                color: AppColors.textSecondary,
              ),
              title: const Text('Changer le mot de passe'),
              trailing: const Icon(
                Icons.chevron_right,
                color: AppColors.textTertiary,
              ),
              onTap: () {
                Navigator.pop(context);
                context.push(RoutePaths.changePassword);
              },
            ),
            const Divider(),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Notifications push'),
              subtitle: const Text(
                'Recevoir une alerte lors d\'un nouvel événement',
              ),
              value: settings.pushNotifications,
              onChanged: (_) =>
                  ref.read(settingsProvider.notifier).togglePushNotifications(),
            ),
            const Divider(),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(
                Icons.language_outlined,
                color: AppColors.textSecondary,
              ),
              title: const Text('Langue'),
              trailing: Text(
                settings.language,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(
                Icons.info_outline,
                color: AppColors.textSecondary,
              ),
              title: const Text('Version'),
              trailing: Text(
                '1.0.0',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StageHint extends StatelessWidget {
  const _StageHint({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      padding: const EdgeInsets.all(16),
      color: Theme.of(context).colorScheme.surface,
      child: Row(
        children: [
          Icon(Icons.work_off_outlined, size: 20, color: AppColors.textSecondary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Aucun stage renseigné pour le moment.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      padding: const EdgeInsets.all(12),
      color: Theme.of(context).colorScheme.surface,
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.danger, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),
          TextButton(onPressed: onRetry, child: const Text('Réessayer')),
        ],
      ),
    );
  }
}

class _ProgressCardSkeleton extends StatelessWidget {
  const _ProgressCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SkeletonCard(
      child: Row(
        children: [
          SkeletonBox(width: 58, height: 58, radius: 999),
          SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(width: 90, height: 14),
                SizedBox(height: 8),
                SkeletonBox(width: 160, height: 14),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DecorativeCircle extends StatelessWidget {
  const _DecorativeCircle({required this.size, required this.opacity});

  final double size;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: opacity),
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
