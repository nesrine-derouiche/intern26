import 'package:flutter/material.dart';

/// Constrains content to a readable column on wide screens and centers it.
class MaxWidth extends StatelessWidget {
  const MaxWidth({
    super.key,
    this.maxWidth = 640,
    this.padding = const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
    required this.child,
  });

  final double maxWidth;
  final EdgeInsetsGeometry padding;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Padding(
          padding: padding,
          child: child,
        ),
      ),
    );
  }
}
