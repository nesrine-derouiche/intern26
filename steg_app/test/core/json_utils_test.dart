import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/core/utils/json_utils.dart';

void main() {
  group('numOrNull', () {
    test('returns the same value for a number', () {
      expect(numOrNull(16), 16);
      expect(numOrNull(16.4), 16.4);
      expect(numOrNull(0), 0);
    });

    test('parses numeric strings sent by PostgreSQL numeric columns', () {
      expect(numOrNull('16.00'), 16.0);
      expect(numOrNull('16.40'), 16.4);
      expect(numOrNull('0.00000000000000000000'), 0);
      expect(numOrNull('4'), 4);
    });

    test('returns null for null, empty or invalid values', () {
      expect(numOrNull(null), isNull);
      expect(numOrNull(''), isNull);
      expect(numOrNull('abc'), isNull);
      expect(numOrNull(true), isNull);
    });
  });
}
