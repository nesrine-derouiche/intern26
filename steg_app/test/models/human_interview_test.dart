import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/human_interview.dart';

void main() {
  group('HumanInterview', () {
    test('fromJson parses a scheduled interview', () {
      final interview = HumanInterview.fromJson(const {
        'id': 'hi-1',
        'date': '2026-09-10',
        'heure': '10:30',
        'duree': 45,
        'interviewer': 'Salma Bouazizi',
        'interviewer_email': 'salma.bouazizi@steg.tn',
        'lien_visio': 'https://meet.steg.tn/salma-2026',
        'statut': 'PLANIFIE',
      });

      expect(interview.id, 'hi-1');
      expect(interview.dateLabel, '10/09/2026');
      expect(interview.timeLabel, '10:30');
      expect(interview.durationLabel, '45 minutes');
      expect(interview.interviewer, 'Salma Bouazizi');
      expect(interview.interviewerEmail, 'salma.bouazizi@steg.tn');
      expect(interview.lienVisio, 'https://meet.steg.tn/salma-2026');
      expect(interview.isScheduled, isTrue);
      expect(interview.isCancelled, isFalse);
      expect(interview.hasMeetingLink, isTrue);
    });

    test('fromJson handles a cancelled interview and missing fields', () {
      final interview = HumanInterview.fromJson(const {
        'id': 'hi-2',
        'statut': 'ANNULE',
      });

      expect(interview.isScheduled, isFalse);
      expect(interview.isCancelled, isTrue);
      expect(interview.hasMeetingLink, isFalse);
      expect(interview.dateLabel, '—');
      expect(interview.timeLabel, '—');
      expect(interview.durationLabel, '—');
    });
  });
}
