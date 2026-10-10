import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/candidature.dart';
import '../../models/note.dart';
import '../../models/offre.dart';
import '../../models/reunion.dart';
import '../../models/tache.dart';
import '../../providers/auth/auth_provider.dart';
import '../../providers/onboarding/document_onboarding_provider.dart';
import '../../providers/onboarding/internship_access_provider.dart';
import '../../screens/auth/forgot_password_screen.dart';
import '../../screens/auth/login_screen.dart';
import '../../screens/calendar/calendar_screen.dart';
import '../../screens/candidatures/application_details_screen.dart';
import '../../screens/candidatures/my_applications_screen.dart';
import '../../screens/dashboard/completion_screen.dart';
import '../../screens/dashboard/intern_dashboard_screen.dart';
import '../../screens/dashboard/meeting_detail_screen.dart';
import '../../screens/dashboard/my_documents_screen.dart';
import '../../screens/dashboard/my_meetings_screen.dart';
import '../../screens/dashboard/my_notifications_screen.dart';
import '../../screens/dashboard/my_tasks_screen.dart';
import '../../screens/dashboard/task_details_screen.dart';
import '../../screens/home/home_screen.dart';
import '../../screens/journal/journal_screen.dart';
import '../../screens/certification/certification_screen.dart';
import '../../screens/notes/note_editor_screen.dart';
import '../../screens/notes/notes_list_screen.dart';
import '../../screens/offres/offre_details_screen.dart';
import '../../screens/offres/offres_list_screen.dart';
import '../../screens/onboarding/document_onboarding_screen.dart';
import '../../screens/planning/planning_screen.dart';
import '../../screens/profile/profile_screen.dart';
import '../../screens/profile/edit_profile_screen.dart';
import '../../screens/auth/change_password_screen.dart';
import '../../screens/shell/app_shell.dart';
import '../../screens/splash/splash_screen.dart';
import '../../screens/stagiaire/historique_presences_screen.dart';
import '../../screens/stagiaire/pointage_screen.dart';
import '../../screens/stagiaire/stagiaire_project_screen.dart';
import 'route_paths.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: RoutePaths.splash,
    redirect: (context, state) {
      const publicLocations = {RoutePaths.login, RoutePaths.forgotPassword};
      final location = state.matchedLocation;
      final auth = ref.read(authProvider);
      final authState = auth.value;
      final isAuthenticated = authState?.isAuthenticated ?? false;

      if (location == RoutePaths.splash) {
        if (auth.isLoading || authState == null) return null;
        if (!isAuthenticated) return RoutePaths.login;
        final onboardingAsync = ref.read(documentOnboardingProvider);
        if (onboardingAsync.isLoading || onboardingAsync.isRefreshing) {
          return onboardingAsync.value == null
              ? null
              : RoutePaths.documentOnboarding;
        }
        if (onboardingAsync.hasError) return RoutePaths.documentOnboarding;
        return onboardingAsync.value != null
            ? RoutePaths.documentOnboarding
            : RoutePaths.home;
      }

      if (!isAuthenticated && !publicLocations.contains(location)) {
        return RoutePaths.login;
      }
      if (isAuthenticated && publicLocations.contains(location)) {
        return RoutePaths.home;
      }
      if (!isAuthenticated) return null;

      // ── Garde centrale d'onboarding (candidats uniquement) ──────────────
      // Décision unique : dossier incomplet ou dossier dont les documents ne
      // sont pas encore tous validés → écran d'onboarding verrouillé ; dossier
      // validé (`access_granted` côté backend) → accès accordé. Pas de dossier
      // en cours → accès accordé. La sécurité est en plus appliquée côté
      // backend (403 sur les API du stage tant que le dossier n'est pas validé).
      final role = authState?.session?.user.role;
      final isCandidate = role == 'CANDIDAT';

      // ── Planning : écran réservé aux stagiaires, candidats bloqués ─────
      if (isCandidate && location == RoutePaths.planning) {
        return RoutePaths.home;
      }

      final onboardingAsync = ref.read(documentOnboardingProvider);
      final onboarding = onboardingAsync.value;

      if (isCandidate) {
        if (onboarding == null) {
          if (onboardingAsync.isLoading || onboardingAsync.isRefreshing) {
            return null;
          }
          if (onboardingAsync.hasError) {
            return location == RoutePaths.documentOnboarding
                ? null
                : RoutePaths.documentOnboarding;
          }
          // Pas de dossier en cours : accès accordé.
          return location == RoutePaths.documentOnboarding
              ? RoutePaths.home
              : null;
        }

        // Dossier en cours : l'accès dépend du verdict de vérification.
        final accessAsync = ref.read(internshipAccessProvider);
        final access = accessAsync.value;
        if (access == null) {
          if (accessAsync.isLoading || accessAsync.isRefreshing) {
            return location == RoutePaths.documentOnboarding
                ? null
                : RoutePaths.documentOnboarding;
          }
          // Erreur de vérification : on verrouille prudemment sur l'onboarding.
          return location == RoutePaths.documentOnboarding
              ? null
              : RoutePaths.documentOnboarding;
        }
        if (access.accessGranted) {
          // Accès accordé : navigation libre ; l'écran d'onboarding reste
          // accessible pour afficher le dossier complet.
          return null;
        }
        return location == RoutePaths.documentOnboarding
            ? null
            : RoutePaths.documentOnboarding;
      }

      // Non-candidat : l'écran d'onboarding ne lui est pas destiné.
      if (location == RoutePaths.documentOnboarding) {
        return RoutePaths.home;
      }
      return null;
    },
    routes: [
      GoRoute(path: RoutePaths.splash, builder: (context, state) => const SplashScreen()),
      GoRoute(path: RoutePaths.login, builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: RoutePaths.forgotPassword,
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: RoutePaths.documentOnboarding,
        builder: (context, state) => const DocumentOnboardingScreen(),
      ),
      StatefulShellRoute(
        navigatorContainerBuilder: (context, navigationShell, children) =>
            FadingBranchContainer(
          currentIndex: navigationShell.currentIndex,
          children: children,
        ),
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.home,
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.calendrier,
                builder: (context, state) => const CalendarScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.mesTaches,
                builder: (context, state) => const MyTasksScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.mesNotifications,
                builder: (context, state) => const MyNotificationsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.profile,
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(path: RoutePaths.offres, builder: (context, state) => const OffresListScreen()),
      GoRoute(
        path: RoutePaths.offreDetails,
        builder: (context, state) => OffreDetailsScreen(
          offreId: state.pathParameters['id'] ?? '',
          offre: state.extra as Offre?,
        ),
      ),
      GoRoute(
        path: RoutePaths.mesCandidatures,
        builder: (context, state) => const MyApplicationsScreen(),
      ),
      GoRoute(
        path: RoutePaths.candidatureDetails,
        builder: (context, state) => ApplicationDetailsScreen(
          candidatureId: state.pathParameters['id'] ?? '',
          candidature: state.extra as Candidature?,
        ),
      ),
      GoRoute(
        path: RoutePaths.internDashboard,
        builder: (context, state) => const InternDashboardScreen(),
      ),
      GoRoute(
        path: RoutePaths.mesReunions,
        builder: (context, state) => const MyMeetingsScreen(),
      ),
      GoRoute(
        path: RoutePaths.meetingDetail,
        builder: (context, state) {
          final reunion = state.extra;
          if (reunion is! Reunion) {
            return const Scaffold(
              body: Center(child: Text('Réunion introuvable')),
            );
          }
          return MeetingDetailScreen(reunion: reunion);
        },
      ),
      GoRoute(
        path: RoutePaths.taskDetails,
        builder: (context, state) {
          final task = state.extra;
          if (task is! Tache) {
            return const Scaffold(
              body: Center(child: Text('Tâche introuvable')),
            );
          }
          return TaskDetailsScreen(task: task);
        },
      ),
      GoRoute(
        path: RoutePaths.mesDocuments,
        builder: (context, state) => const MyDocumentsScreen(),
      ),
      GoRoute(
        path: RoutePaths.monProjet,
        builder: (context, state) => const StagiaireProjectScreen(),
      ),
      GoRoute(
        path: RoutePaths.journal,
        builder: (context, state) => const JournalScreen(),
      ),
      GoRoute(
        path: RoutePaths.certification,
        builder: (context, state) => const CertificationScreen(),
      ),
      GoRoute(
        path: RoutePaths.notes,
        builder: (context, state) => const NotesListScreen(),
      ),
      GoRoute(
        path: RoutePaths.noteEditor,
        builder: (context, state) {
          final note = state.extra;
          return NoteEditorScreen(note: note is Note ? note : null);
        },
      ),
      GoRoute(
        path: RoutePaths.planning,
        builder: (context, state) => const PlanningScreen(),
      ),
      GoRoute(
        path: RoutePaths.completion,
        builder: (context, state) => const CompletionScreen(),
      ),
      GoRoute(
        path: RoutePaths.pointage,
        builder: (context, state) => const PointageScreen(),
      ),
      GoRoute(
        path: RoutePaths.historiquePresences,
        builder: (context, state) => const HistoriquePresencesScreen(),
      ),
      GoRoute(
        path: RoutePaths.editProfile,
        builder: (context, state) => const EditProfileScreen(),
      ),
      GoRoute(
        path: RoutePaths.changePassword,
        builder: (context, state) => const ChangePasswordScreen(),
      ),
    ],
  );
  ref.listen(authProvider, (previous, next) {
    router.refresh();
  });
  ref.listen(documentOnboardingProvider, (previous, next) {
    router.refresh();
  });
  ref.listen(internshipAccessProvider, (previous, next) {
    router.refresh();
  });
  ref.onDispose(router.dispose);
  return router;
});
