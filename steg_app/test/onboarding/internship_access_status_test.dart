import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/document_onboarding.dart';
import 'package:steg_app/models/internship_access.dart';

import 'onboarding_utils.dart';

OnboardingDocument doc({
  String? statut,
  String? verificationStatus,
}) {
  return OnboardingDocument.fromJson({
    'type': 'CV',
    'statut': ?statut,
    'verification_status': ?verificationStatus,
  });
}

void main() {
  group('OnboardingDocumentStatus.effective', () {
    test('aucune ligne → manquant', () {
      expect(doc().status, OnboardingDocumentStatus.manquant);
    });

    test('statut EN_ATTENTE sans verdict → envoyé', () {
      expect(
        doc(statut: 'EN_ATTENTE').status,
        OnboardingDocumentStatus.enAttente,
      );
    });

    test('statut REJETE → rejeté (même sans verdict)', () {
      expect(doc(statut: 'REJETE').status, OnboardingDocumentStatus.rejete);
    });

    test('verdict REJECTED → rejeté (priorité maximale)', () {
      expect(
        doc(statut: 'EN_ATTENTE', verificationStatus: 'REJECTED').status,
        OnboardingDocumentStatus.rejete,
      );
    });

    test('verdict REVIEW_REQUIRED → vérification manuelle nécessaire', () {
      expect(
        doc(statut: 'EN_ATTENTE', verificationStatus: 'REVIEW_REQUIRED').status,
        OnboardingDocumentStatus.reviewRequired,
      );
    });

    test('verdict PENDING → vérification en cours', () {
      expect(
        doc(statut: 'EN_ATTENTE', verificationStatus: 'PENDING').status,
        OnboardingDocumentStatus.verification,
      );
    });

    test('statut VALIDE → document validé', () {
      expect(doc(statut: 'VALIDE').status, OnboardingDocumentStatus.valide);
    });

    test('statut VALID (valeur backend) → document validé', () {
      expect(doc(statut: 'VALID').status, OnboardingDocumentStatus.valide);
    });

    test('verdict VALID → document validé (même si statut EN_ATTENTE)', () {
      expect(
        doc(statut: 'EN_ATTENTE', verificationStatus: 'VALID').status,
        OnboardingDocumentStatus.valide,
      );
    });

    test('statut EN_ATTENTE après rejet → priorité au rejet', () {
      expect(
        doc(statut: 'EN_ATTENTE', verificationStatus: 'REJECTED').status,
        OnboardingDocumentStatus.rejete,
      );
    });
  });

  group('InternshipAccess', () {
    test('fromJson : access_granted + documents', () {
      final access = InternshipAccess.fromJson({
        'access_granted': true,
        'documents': {
          'cv': 'VALID',
          'cin': 'VALID',
          'demande_stage': 'VALID',
          'lettre_affectation': 'VALID',
        },
      });

      expect(access.accessGranted, isTrue);
      expect(access.allValid, isTrue);
      expect(
        access.effectiveStatus(OnboardingDocumentType.cv),
        OnboardingDocumentStatus.valide,
      );
    });

    test('accès refusé quand un document n\'est pas validé', () {
      final access = InternshipAccess.fromJson({
        'access_granted': false,
        'documents': {
          'cv': 'VALID',
          'cin': 'VERIFICATION',
          'demande_stage': 'VALID',
          'lettre_affectation': 'VALID',
        },
      });

      expect(access.accessGranted, isFalse);
      expect(access.allValid, isFalse);
      expect(
        access.effectiveStatus(OnboardingDocumentType.cin),
        OnboardingDocumentStatus.verification,
      );
    });

    test('document VALID → valide', () {
      final access = buildAccess();
      expect(
        access.effectiveStatus(OnboardingDocumentType.cin),
        OnboardingDocumentStatus.valide,
      );
    });
  });
}
