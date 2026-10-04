import 'package:steg_app/features/auth/domain/auth_repository.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/features/onboarding/domain/onboarding_repository.dart';
import 'package:steg_app/models/document_onboarding.dart';
import 'package:steg_app/models/internship_access.dart';
import 'package:steg_app/models/login_request.dart';
import 'package:steg_app/models/user.dart';

const candidat = User(
  id: 'c-1',
  nom: 'Gharbi',
  prenom: 'Amine',
  email: 'amine@steg.tn',
  role: 'CANDIDAT',
);

const stagiaire = User(
  id: 's-1',
  nom: 'Ben Ahmed',
  prenom: 'Sami',
  email: 'sami@steg.tn',
  role: 'STAGIAIRE',
);

const admin = User(
  id: 'a-1',
  nom: 'Admin',
  prenom: 'Super',
  email: 'admin@steg.tn',
  role: 'ADMIN',
);

const onboardingTypes = ['CV', 'CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION'];

DocumentOnboarding buildOnboarding({
  Map<String, OnboardingDocumentStatus> statuses = const {},
  String candidatureId = 'candidature-1',
}) {
  final documents = [
    for (final type in onboardingTypes)
      OnboardingDocument(
        type: type,
        status: statuses[type] ?? OnboardingDocumentStatus.manquant,
      ),
  ];
  final submitted = documents.where((d) => d.isSubmitted).length;
  return DocumentOnboarding(
    candidatureId: candidatureId,
    requiredTypes: onboardingTypes,
    documents: documents,
    submitted: submitted,
    total: onboardingTypes.length,
  );
}

DocumentOnboarding buildComplete() => buildOnboarding(
      statuses: {
        'CV': OnboardingDocumentStatus.enAttente,
        'CIN': OnboardingDocumentStatus.enAttente,
        'DEMANDE_STAGE': OnboardingDocumentStatus.enAttente,
        'LETTRE_AFFECTATION': OnboardingDocumentStatus.enAttente,
      },
    );

/// Dossier complet avec tous les documents validés (accès accordé).
DocumentOnboarding buildValidated() => buildOnboarding(
      statuses: {
        'CV': OnboardingDocumentStatus.valide,
        'CIN': OnboardingDocumentStatus.valide,
        'DEMANDE_STAGE': OnboardingDocumentStatus.valide,
        'LETTRE_AFFECTATION': OnboardingDocumentStatus.valide,
      },
    );

/// Verdict d'accès au stage ; par défaut accordé avec tous les documents VALID.
InternshipAccess buildAccess({
  bool granted = true,
  Map<String, String>? documents,
}) {
  final docs = documents ??
      {
        'cv': granted ? 'VALID' : 'EN_ATTENTE',
        'cin': granted ? 'VALID' : 'EN_ATTENTE',
        'demande_stage': granted ? 'VALID' : 'EN_ATTENTE',
        'lettre_affectation': granted ? 'VALID' : 'EN_ATTENTE',
      };
  return InternshipAccess(accessGranted: granted, documents: docs);
}

class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository({this.session});

  AuthSession? session;

  @override
  Future<AuthSession?> getSession() async => session;

  @override
  Future<AuthSession> login(LoginRequest request) async {
    throw UnimplementedError();
  }

  @override
  Future<void> logout() async {
    session = null;
  }
}

class FakeOnboardingRepository implements OnboardingRepository {
  FakeOnboardingRepository({
    this.onboarding,
    this.access,
    this.accessError,
  });

  DocumentOnboarding? onboarding;
  Object? getError;
  Object? uploadErrorOnce;
  Future<DocumentOnboarding?> Function()? getOverride;
  DocumentOnboarding Function(String type)? onUpload;

  InternshipAccess? access;
  Object? accessError;

  int getOnboardingCalls = 0;
  int uploadCalls = 0;
  int getInternshipAccessCalls = 0;

  @override
  Future<DocumentOnboarding?> getOnboarding() {
    getOnboardingCalls++;
    if (getError != null) return Future.error(getError!);
    if (getOverride != null) return getOverride!();
    return Future.value(onboarding);
  }

  @override
  Future<DocumentOnboarding> uploadDocument({
    required String candidatureId,
    required String type,
    required String filePath,
    String? fileName,
  }) {
    uploadCalls++;
    if (uploadErrorOnce != null) {
      final error = uploadErrorOnce!;
      uploadErrorOnce = null;
      return Future.error(error);
    }
    final next = onUpload?.call(type) ?? onboarding;
    if (next == null) {
      return Future.error(StateError('Aucun dossier en cours'));
    }
    onboarding = next;
    return Future.value(next);
  }

  @override
  Future<InternshipAccess> getInternshipAccess(String candidatureId) {
    getInternshipAccessCalls++;
    if (accessError != null) return Future.error(accessError!);
    return Future.value(access ?? buildAccess());
  }
}
