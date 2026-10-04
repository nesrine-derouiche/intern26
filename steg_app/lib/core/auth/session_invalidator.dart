import 'dart:async';

/// Broadcast stream that fires when the session becomes invalid (e.g. 401).
/// The interceptor clears token storage, then fires this stream.
/// The auth provider listens and transitions to unauthenticated state.
class SessionInvalidator {
  SessionInvalidator._();

  static final SessionInvalidator instance = SessionInvalidator._();

  final _controller = StreamController<void>.broadcast();

  /// Stream that the auth provider listens to.
  Stream<void> get onInvalidated => _controller.stream;

  /// Called by the auth interceptor when a 401 is received.
  void invalidate() {
    if (!_controller.isClosed) {
      _controller.add(null);
    }
  }

  /// Clean up (should only be called in tests).
  Future<void> dispose() async {
    await _controller.close();
  }
}
