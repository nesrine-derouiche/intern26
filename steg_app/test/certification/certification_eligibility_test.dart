import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/core/utils/certification_eligibility.dart';

void main() {
  group('isInFinalWeek', () {
    test('is true inside the final seven days (inclusive bounds)', () {
      final now = DateTime(2026, 10, 2, 15, 30);
      expect(isInFinalWeek(now, DateTime(2026, 10, 2)), isTrue);
      expect(isInFinalWeek(now, DateTime(2026, 10, 8)), isTrue);
      expect(isInFinalWeek(now, DateTime(2026, 10, 3)), isTrue);
    });

    test('is false outside the final week', () {
      final now = DateTime(2026, 10, 2);
      expect(isInFinalWeek(now, DateTime(2026, 10, 9)), isFalse);
      expect(isInFinalWeek(now, DateTime(2026, 11, 1)), isFalse);
    });

    test('is false for expired internships', () {
      final now = DateTime(2026, 10, 2);
      expect(isInFinalWeek(now, DateTime(2026, 10, 1)), isFalse);
      expect(isInFinalWeek(now, DateTime(2026, 9, 15)), isFalse);
    });

    test('is false when the end date is missing', () {
      expect(isInFinalWeek(DateTime(2026, 10, 2), null), isFalse);
    });

    test('ignores time-of-day boundaries (date-only comparison)', () {
      final endOfDay = DateTime(2026, 10, 8, 23, 59);
      final startOfDay = DateTime(2026, 10, 2, 0, 0);
      expect(isInFinalWeek(startOfDay, endOfDay), isTrue);
      expect(isInFinalWeek(endOfDay, startOfDay), isFalse);
    });
  });

  group('isFinalWeekDay', () {
    test('marks exactly the seven final days', () {
      final end = DateTime(2026, 10, 8);
      for (var i = 0; i < 7; i++) {
        expect(
          isFinalWeekDay(DateTime(2026, 10, 2 + i), end),
          isTrue,
          reason: 'day offset $i',
        );
      }
      expect(isFinalWeekDay(DateTime(2026, 10, 1), end), isFalse);
      expect(isFinalWeekDay(DateTime(2026, 10, 9), end), isFalse);
    });

    test('never highlights unrelated dates or missing ends', () {
      expect(isFinalWeekDay(DateTime(2026, 10, 5), null), isFalse);
      expect(
        isFinalWeekDay(DateTime(2026, 10, 5), DateTime(2026, 12, 25)),
        isFalse,
      );
      expect(
        isFinalWeekDay(DateTime(2026, 10, 5), DateTime(2026, 9, 1)),
        isFalse,
      );
    });
  });
}
