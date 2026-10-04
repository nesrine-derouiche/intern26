import 'dart:io';
import 'dart:typed_data';

import 'package:open_filex/open_filex.dart';

String extensionOf(String fileName) {
  final dot = fileName.lastIndexOf('.');
  if (dot < 0 || dot == fileName.length - 1) return '';
  return fileName.substring(dot + 1).toLowerCase();
}

bool isPdfName(String fileName) => extensionOf(fileName) == 'pdf';

Future<File> writeTempFile(Uint8List bytes, String fileName) async {
  final dir = await Directory.systemTemp.createTemp('steg_docs_');
  final file = File('${dir.path}/$fileName');
  await file.writeAsBytes(bytes, flush: true);
  return file;
}

Future<void> openWithSystemViewer(Uint8List bytes, String fileName) async {
  final file = await writeTempFile(bytes, fileName);
  await OpenFilex.open(file.path);
}
