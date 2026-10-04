import 'package:flutter/material.dart';

/// Non-scrollable, responsive grid meant to be embedded inside a scroll view.
///
/// Unlike [GridView] this does not create its own [Scrollable], which keeps
/// screens with several grids down to a single scrollable (required by tests
/// relying on `scrollUntilVisible`).
class ResponsiveGrid extends StatelessWidget {
  const ResponsiveGrid({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    this.maxCrossAxisExtent = 160,
    this.spacing = 12,
    this.childAspectRatio = 1,
  });

  final int itemCount;
  final Widget Function(BuildContext context, int index) itemBuilder;
  final double maxCrossAxisExtent;
  final double spacing;
  final double childAspectRatio;

  @override
  Widget build(BuildContext context) {
    if (itemCount == 0) return const SizedBox.shrink();
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = ((constraints.maxWidth + spacing) /
                (maxCrossAxisExtent + spacing))
            .ceil()
            .clamp(1, itemCount)
            .toInt();
        final tileWidth =
            (constraints.maxWidth - spacing * (columns - 1)) / columns;
        final tileHeight = tileWidth / childAspectRatio;
        final rows = (itemCount / columns).ceil();

        final rowsWidgets = <Widget>[];
        for (var r = 0; r < rows; r++) {
          rowsWidgets.add(
            Row(
              children: [
                for (var c = 0; c < columns; c++) ...[
                  if (c > 0) SizedBox(width: spacing),
                  SizedBox(
                    width: tileWidth,
                    height: tileHeight,
                    child: r * columns + c < itemCount
                        ? itemBuilder(context, r * columns + c)
                        : null,
                  ),
                ],
              ],
            ),
          );
          if (r < rows - 1) rowsWidgets.add(SizedBox(height: spacing));
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: rowsWidgets,
        );
      },
    );
  }
}
