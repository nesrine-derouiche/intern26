import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../providers/dashboard/dashboard_providers.dart';

/// Shell for the five primary destinations.
///
/// Each branch keeps its own navigator and state via the animated
/// [FadingBranchContainer], so switching tabs never loses the scroll
/// position or the in-memory state of the previous tab.
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onDestinationSelected(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(unreadCountProvider).value ?? 0;
    final index = navigationShell.currentIndex;

    final wide = MediaQuery.sizeOf(context).width >= 700;
    final destinations = [
                  const NavigationDestination(
                    icon: Icon(Icons.home_outlined),
                    selectedIcon: Icon(Icons.home),
                    label: 'Accueil',
                  ),
                  const NavigationDestination(
                    icon: Icon(Icons.calendar_month_outlined),
                    selectedIcon: Icon(Icons.calendar_month),
                    label: 'Agenda',
                  ),
                  const NavigationDestination(
                    icon: Icon(Icons.checklist_outlined),
                    selectedIcon: Icon(Icons.checklist),
                    label: 'Tâches',
                  ),
                  NavigationDestination(
                    icon: _NotificationIcon(
                      icon: Icons.notifications_outlined,
                      unread: unread,
                      showBadge: index != 0,
                    ),
                    selectedIcon: _NotificationIcon(
                      icon: Icons.notifications,
                      unread: unread,
                      showBadge: index != 0,
                    ),
                    label: 'Notifications',
                    tooltip: 'Notifications',
                  ),
                  const NavigationDestination(
                    icon: Icon(Icons.person_outline),
                    selectedIcon: Icon(Icons.person),
                    label: 'Profil',
                  ),
                ];

    return Scaffold(
      body: wide
          ? Row(
              children: [
                SafeArea(
                  right: false,
                  child: NavigationRail(
                    selectedIndex: index,
                    labelType: NavigationRailLabelType.all,
                    onDestinationSelected: _onDestinationSelected,
                    destinations: destinations
                        .map(
                          (destination) => NavigationRailDestination(
                            icon: destination.icon,
                            selectedIcon: destination.selectedIcon,
                            label: Text(destination.label),
                          ),
                        )
                        .toList(),
                  ),
                ),
                const VerticalDivider(width: 1),
                Expanded(child: navigationShell),
              ],
            )
          : navigationShell,
      bottomNavigationBar: wide
          ? null
          : _FloatingBottomBar(
              selectedIndex: index,
              destinations: destinations,
              onDestinationSelected: _onDestinationSelected,
            ),
    );
  }
}

class _FloatingBottomBar extends StatelessWidget {
  const _FloatingBottomBar({
    required this.selectedIndex,
    required this.destinations,
    required this.onDestinationSelected,
  });

  final int selectedIndex;
  final List<NavigationDestination> destinations;
  final ValueChanged<int> onDestinationSelected;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    if (bottomInset > 0) return const SizedBox.shrink();

    final theme = Theme.of(context);
    return SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(12, 4, 12, 10),
      child: Container(
        height: 72,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: theme.colorScheme.outlineVariant),
          boxShadow: const [
            BoxShadow(
              color: Color(0x1A12304A),
              blurRadius: 20,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            for (var i = 0; i < destinations.length; i++)
              Expanded(
                child: _FloatingDestination(
                  destination: destinations[i],
                  selected: i == selectedIndex,
                  onTap: () => onDestinationSelected(i),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _FloatingDestination extends StatelessWidget {
  const _FloatingDestination({
    required this.destination,
    required this.selected,
    required this.onTap,
  });

  final NavigationDestination destination;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final label = destination.label;
    return Semantics(
      selected: selected,
      button: true,
      label: label,
      child: Tooltip(
        message: destination.tooltip ?? label,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            padding: const EdgeInsets.symmetric(horizontal: 6),
            decoration: BoxDecoration(
              color: selected
                  ? theme.colorScheme.primaryContainer
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 180),
                  transitionBuilder: (child, animation) => ScaleTransition(
                    scale: animation,
                    child: child,
                  ),
                  child: selected
                      ? KeyedSubtree(
                          key: const ValueKey('selected'),
                              child: destination.selectedIcon ?? destination.icon,
                        )
                      : KeyedSubtree(
                          key: const ValueKey('unselected'),
                          child: destination.icon,
                        ),
                ),
                if (selected) ...[
                  const SizedBox(width: 5),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onPrimaryContainer,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NotificationIcon extends StatelessWidget {
  const _NotificationIcon({
    required this.icon,
    required this.unread,
    required this.showBadge,
  });

  final IconData icon;
  final int unread;
  final bool showBadge;

  @override
  Widget build(BuildContext context) {
    return Badge.count(
      count: unread,
      isLabelVisible: showBadge && unread > 0,
      child: Icon(icon),
    );
  }
}

/// Container for the branch navigators of the stateful shell route.
///
/// Keeps every branch mounted (so their state is preserved) while only the
/// active branch is on stage. Switching tabs fades the incoming branch in.
class FadingBranchContainer extends StatefulWidget {
  const FadingBranchContainer({
    super.key,
    required this.currentIndex,
    required this.children,
  });

  final int currentIndex;
  final List<Widget> children;

  @override
  State<FadingBranchContainer> createState() => _FadingBranchContainerState();
}

class _FadingBranchContainerState extends State<FadingBranchContainer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 300),
    value: 1,
  );

  late final Animation<double> _opacity = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeOutCubic,
  );

  @override
  void didUpdateWidget(covariant FadingBranchContainer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentIndex != widget.currentIndex) {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        for (var i = 0; i < widget.children.length; i++)
          Offstage(
            offstage: i != widget.currentIndex,
            child: TickerMode(
              enabled: i == widget.currentIndex,
              child: FadeTransition(opacity: _opacity, child: widget.children[i]),
            ),
          ),
      ],
    );
  }
}
