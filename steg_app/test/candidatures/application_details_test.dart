import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:steg_app/core/network/api_exception.dart';
import 'package:steg_app/features/offres/domain/offre_repository.dart';
import 'package:steg_app/models/candidature.dart';
import 'package:steg_app/models/human_interview.dart';
import 'package:steg_app/models/offre.dart';
import 'package:steg_app/models/paginated_result.dart';
import 'package:steg_app/providers/offres/offres_providers.dart';
import 'package:steg_app/screens/candidatures/application_details_screen.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

HumanInterview buildInterview({String statut = 'PLANIFIE'}) {
  return HumanInterview(
    id: 'hi-1',
    date: DateTime(2026, 9, 10),
    heure: '10:30',
    duree: 45,
    interviewer: 'Salma Bouazizi',
    interviewerEmail: 'salma.bouazizi@steg.tn',
    lienVisio: 'https://meet.steg.tn/salma-2026',
    statut: statut,
  );
}

class FakeOffreRepository implements OffreRepository {
  FakeOffreRepository({this.interview});

  final HumanInterview? interview;
  ApiException? error;

  @override
  Future<PaginatedResult<Offre>> listOffres({
    required int page,
    required int limit,
  }) async {
    return const PaginatedResult(data: [], total: 0, page: 1, pages: 0);
  }

  @override
  Future<List<Candidature>> listMyCandidatures() async => const [];

  @override
  Future<Candidature> applyToOffre({
    required String stagiaireId,
    required String offreId,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<HumanInterview?> getHumanInterview(String candidatureId) async {
    if (error != null) throw error!;
    return interview;
  }
}

class FakeUrlLauncherPlatform extends Fake
    with MockPlatformInterfaceMixin
    implements UrlLauncherPlatform {
  final List<String> launchedUrls = [];

  @override
  Future<bool> canLaunch(String url) async => true;

  @override
  Future<bool> launchUrl(String url, LaunchOptions options) async {
    launchedUrls.add(url);
    return true;
  }
}

void main() {
  late FakeUrlLauncherPlatform urlLauncher;
  late UrlLauncherPlatform originalLauncher;

  setUp(() {
    originalLauncher = UrlLauncherPlatform.instance;
    urlLauncher = FakeUrlLauncherPlatform();
    UrlLauncherPlatform.instance = urlLauncher;
  });

  tearDown(() {
    UrlLauncherPlatform.instance = originalLauncher;
  });

  Future<void> pumpDetails(
    WidgetTester tester, {
    required FakeOffreRepository repo,
    Candidature? candidature,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [offreRepositoryProvider.overrideWithValue(repo)],
        child: MaterialApp(
          home: ApplicationDetailsScreen(
            candidatureId: 'c1',
            candidature: candidature,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'Candidate sees a scheduled interview with date, time, interviewer and a join link',
    (tester) async {
      tester.view.physicalSize = const Size(1000, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await pumpDetails(tester, repo: FakeOffreRepository(interview: buildInterview()));

      expect(find.text('Entretien humain'), findsOneWidget);
      expect(find.text('Entretien programmé'), findsOneWidget);
      expect(find.text('10/09/2026'), findsOneWidget);
      expect(find.text('10:30'), findsOneWidget);
      expect(find.text('45 minutes'), findsOneWidget);
      expect(find.text('Salma Bouazizi'), findsOneWidget);
      expect(find.text('salma.bouazizi@steg.tn'), findsOneWidget);
      expect(find.text('Rejoindre la visio'), findsOneWidget);

      await tester.tap(find.text('Rejoindre la visio'));
      await tester.pump();

      expect(urlLauncher.launchedUrls, ['https://meet.steg.tn/salma-2026']);
    },
  );

  testWidgets('Candidate sees a cancelled interview', (tester) async {
    tester.view.physicalSize = const Size(1000, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await pumpDetails(
      tester,
      repo: FakeOffreRepository(interview: buildInterview(statut: 'ANNULE')),
    );

    expect(find.text('Entretien humain'), findsOneWidget);
    expect(find.text('Entretien annulé'), findsOneWidget);
    expect(find.text('Votre entretien humain a été annulé. Vous serez informé d\'une éventuelle nouvelle planification.'), findsOneWidget);
    expect(find.text('Rejoindre la visio'), findsNothing);
  });

  testWidgets('No interview scheduled → section is not rendered', (tester) async {
    tester.view.physicalSize = const Size(1000, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await pumpDetails(tester, repo: FakeOffreRepository(interview: null));

    expect(find.text('Entretien humain'), findsNothing);
    expect(find.text('Entretien programmé'), findsNothing);
  });

  testWidgets('A 403 response shows an error state with retry', (tester) async {
    tester.view.physicalSize = const Size(1000, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repo = FakeOffreRepository(interview: null)
      ..error = const ApiException(403, 'Accès refusé');

    await pumpDetails(tester, repo: repo);

    expect(find.text('Accès refusé'), findsOneWidget);
    expect(find.text('Réessayer'), findsOneWidget);
  });
}
