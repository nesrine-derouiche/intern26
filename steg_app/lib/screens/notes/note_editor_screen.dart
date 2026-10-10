import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/note.dart';
import '../../providers/notes/notes_provider.dart';

enum _SaveState { idle, saving, saved, error }

class NoteEditorScreen extends ConsumerStatefulWidget {
  const NoteEditorScreen({super.key, this.note});

  final Note? note;

  @override
  ConsumerState<NoteEditorScreen> createState() => _NoteEditorScreenState();
}

class _NoteEditorScreenState extends ConsumerState<NoteEditorScreen> {
  late final TextEditingController _titleController;
  late final TextEditingController _bodyController;
  late final String _clientKey;
  Timer? _debounce;
  _SaveState _saveState = _SaveState.idle;
  String? _errorMessage;
  Note? _savedNote;
  bool _dirty = false;

  static const _autosaveDelay = Duration(milliseconds: 800);

  @override
  void initState() {
    super.initState();
    _savedNote = widget.note;
    _titleController = TextEditingController(text: widget.note?.titre ?? '');
    _bodyController =
        TextEditingController(text: widget.note?.contenu ?? '');
    _clientKey =
        '${DateTime.now().microsecondsSinceEpoch}-${Random().nextInt(1 << 32)}';
    _titleController.addListener(_onChanged);
    _bodyController.addListener(_onChanged);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _titleController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  void _onChanged() {
    _dirty = true;
    if (_saveState == _SaveState.saved) {
      setState(() => _saveState = _SaveState.idle);
    }
    _debounce?.cancel();
    _debounce = Timer(_autosaveDelay, _saveNow);
  }

  String get _titre => _titleController.text;
  String get _contenu => _bodyController.text;

  bool get _isBlank => _titre.trim().isEmpty && _contenu.trim().isEmpty;

  Future<void> _saveNow() async {
    _debounce?.cancel();
    if (!_dirty || _isBlank || _saveState == _SaveState.saving) return;
    setState(() {
      _saveState = _SaveState.saving;
      _errorMessage = null;
    });
    try {
      final notifier = ref.read(notesProvider.notifier);
      if (_savedNote == null) {
        _savedNote = await notifier.createNote(
          titre: _titre,
          contenu: _contenu,
          clientKey: _clientKey,
        );
      } else {
        _savedNote = await notifier.updateNote(
          _savedNote!.id,
          titre: _titre,
          contenu: _contenu,
        );
      }
      _dirty = false;
      if (mounted) setState(() => _saveState = _SaveState.saved);
    } catch (error) {
      if (mounted) {
        setState(() {
          _saveState = _SaveState.error;
          _errorMessage = error.toString();
        });
      }
    }
  }

  Future<void> _flushAndPop() async {
    await _saveNow();
    if (mounted) Navigator.of(context).pop(_savedNote);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        await _flushAndPop();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            onPressed: _flushAndPop,
          ),
          title: const Text('Note'),
          actions: [
            if (_saveState == _SaveState.saving)
              const Padding(
                padding: EdgeInsets.only(right: 16),
                child: Center(
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              )
            else if (_saveState == _SaveState.error)
              TextButton.icon(
                onPressed: _saveNow,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Réessayer'),
              ),
          ],
        ),
        body: Column(
          children: [
            _SaveStatusBar(state: _saveState, message: _errorMessage),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  TextField(
                    controller: _titleController,
                    decoration: const InputDecoration(
                      hintText: 'Titre',
                      border: InputBorder.none,
                    ),
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                    textInputAction: TextInputAction.next,
                  ),
                  const Divider(height: 24),
                  TextField(
                    controller: _bodyController,
                    decoration: const InputDecoration(
                      hintText: 'Écrivez vos idées ici…',
                      border: InputBorder.none,
                    ),
                    style: theme.textTheme.bodyLarge,
                    maxLines: null,
                    keyboardType: TextInputType.multiline,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SaveStatusBar extends StatelessWidget {
  const _SaveStatusBar({required this.state, this.message});

  final _SaveState state;
  final String? message;

  @override
  Widget build(BuildContext context) {
    switch (state) {
      case _SaveState.saving:
        return const _StatusRow(
          icon: Icons.cloud_upload_outlined,
          text: 'Enregistrement…',
          color: AppColors.textSecondary,
        );
      case _SaveState.saved:
        return const _StatusRow(
          icon: Icons.check_circle_outline,
          text: 'Enregistré',
          color: AppColors.success,
        );
      case _SaveState.error:
        return _StatusRow(
          icon: Icons.error_outline,
          text: message ?? 'Échec de l’enregistrement. Texte conservé.',
          color: AppColors.danger,
        );
      case _SaveState.idle:
        return const SizedBox(height: 8);
    }
  }
}

class _StatusRow extends StatelessWidget {
  const _StatusRow({
    required this.icon,
    required this.text,
    required this.color,
  });

  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Row(
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              text,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: color),
            ),
          ),
        ],
      ),
    );
  }
}
