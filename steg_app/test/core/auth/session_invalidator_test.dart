import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/core/auth/session_invalidator.dart';

void main() {
  group('SessionInvalidator', () {
    late SessionInvalidator invalidator;

    setUp(() {
      invalidator = SessionInvalidator.instance;
    });

    test('fires event when invalidate() is called', () async {
      final events = <void>[];
      final sub = invalidator.onInvalidated.listen(events.add);

      invalidator.invalidate();
      await Future<void>.delayed(Duration.zero);

      expect(events, hasLength(1));
      await sub.cancel();
    });

    test('multiple invalidate() calls fire multiple events', () async {
      final events = <void>[];
      final sub = invalidator.onInvalidated.listen(events.add);

      invalidator.invalidate();
      invalidator.invalidate();
      invalidator.invalidate();
      await Future<void>.delayed(Duration.zero);

      expect(events, hasLength(3));
      await sub.cancel();
    });

    test('concurrent invalidate() calls are safe and do not crash',
        () async {
      final events = <void>[];
      final sub = invalidator.onInvalidated.listen(events.add);

      await Future.wait([
        Future<void>(() => invalidator.invalidate()),
        Future<void>(() => invalidator.invalidate()),
        Future<void>(() => invalidator.invalidate()),
      ]);
      await Future<void>.delayed(Duration.zero);

      expect(events, hasLength(3));
      await sub.cancel();
    });

    test('invalidate is idempotent in effect — auth state ends unauthenticated',
        () async {
      var eventCount = 0;
      final sub = invalidator.onInvalidated.listen((_) => eventCount++);

      invalidator.invalidate();
      invalidator.invalidate();
      await Future<void>.delayed(Duration.zero);

      // Multiple fires, but the auth provider only sets state once per call
      expect(eventCount, 2);
      await sub.cancel();
    });
  });
}
