import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../models/dashboard_stats.dart';
import '../../models/journal_entry.dart';
import '../../providers/dashboard/dashboard_providers.dart';
import '../../providers/journal/journal_providers.dart';
import '../../widgets/common/app_button.dart';
import '../../widgets/common/app_text_field.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/loading_overlay.dart';
import '../../widgets/journal/journal_status_chip.dart';

class JournalFormScreen extends ConsumerStatefulWidget {
  const JournalFormScreen({super.key, this.journal});

  final JournalEntry? journal;

  @override
  ConsumerState<JournalFormScreen> createState() => _JournalFormScreenState();
}

class _JournalFormScreenState extends ConsumerState<JournalFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _travauxController;
  late final TextEditingController _difficultesController;
  late final TextEditingController _solutionsController;
  late final TextEditingController _competencesController;
  late final TextEditingController _heuresController;
  late final TextEditingController _commentaireController;
  late DateTime _semaine;
  bool _saving = false;
  bool _submitting = false;

  bool get _isEditing => widget.journal != null;

  @override
  void initState() {
    super.initState();
    final journal = widget.journal;
    _travauxController = TextEditingController(text: journal?.travaux ?? '');
    _difficultesController = TextEditingController(
      text: journal?.difficultes ?? '',
    );
    _solutionsController = TextEditingController(
      text: journal?.solutions ?? '',
    );
    _competencesController = TextEditingController(
      text: journal?.competences ?? '',
    );
    _heuresController = TextEditingController(
      text: (journal?.heures ?? 0) > 0 ? journal!.heuresLabel : '',
    );
    _commentaireController = TextEditingController(
      text: journal?.commentaire ?? '',
    );
    _semaine = journal?.semaine ?? startOfWeek(DateTime.now());
  }

  @override
  void dispose() {
    _travauxController.dispose();
    _difficultesController.dispose();
    _solutionsController.dispose();
    _competencesController.dispose();
    _heuresController.dispose();
    _commentaireController.dispose();
    super.dispose();
  }

  String? _stageIdFromStats(DashboardStats? stats) {
    if (_isEditing) return widget.journal!.stageId;
    return stats?.internship?.id;
  }

  Future<String?> _resolveStageId() async {
    if (_isEditing) return widget.journal!.stageId;
    final stats = await ref.read(dashboardStatsProvider.future);
    return stats.internship?.id;
  }

  Future<void> _pickWeek() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _semaine,
      firstDate: DateTime(2000),
      lastDate: DateTime(DateTime.now().year + 1),
      helpText: 'Choisir la semaine',
    );
    if (picked == null || !mounted) return;
    setState(() {
      _semaine = startOfWeek(picked);
    });
  }

  JournalDraft _draft({String? stageId}) {
    return JournalDraft(
      stageId: _isEditing ? null : stageId,
      semaine: _semaine,
      travaux: _travauxController.text.trim(),
      difficultes: _difficultesController.text.trim(),
      solutions: _solutionsController.text.trim(),
      competences: _competencesController.text.trim(),
      heures: double.tryParse(_heuresController.text.replaceAll(',', '.')) ?? 0,
      commentaire: _commentaireController.text.trim(),
    );
  }

  Future<void> _save({required bool submit}) async {
    if (!_formKey.currentState!.validate()) return;
    final stageId = await _resolveStageId();
    if (stageId == null || stageId.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Aucun stage actif pour créer un journal.'),
        ),
      );
      return;
    }
    setState(() {
      if (submit) {
        _submitting = true;
      } else {
        _saving = true;
      }
    });

    final notifier = ref.read(myJournalsProvider.notifier);
    var draft = _draft(stageId: stageId);
    try {
      if (_isEditing) {
        draft = JournalDraft(
          semaine: draft.semaine,
          travaux: draft.travaux,
          difficultes: draft.difficultes,
          solutions: draft.solutions,
          competences: draft.competences,
          heures: draft.heures,
          commentaire: draft.commentaire,
        );
        final journal = await notifier.updateJournal(
          id: widget.journal!.id,
          draft: draft,
        );
        if (submit) await notifier.submit(journal.id);
      } else {
        final journal = await notifier.create(draft);
        if (submit) await notifier.submit(journal.id);
      }
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _submitting = false;
      });
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final statsAsync = ref.watch(dashboardStatsProvider);
    final stageId = _stageIdFromStats(statsAsync.value);
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? 'Modifier le journal' : 'Nouveau journal'),
        actions: [
          if (_isEditing)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: JournalStatusChip(statut: widget.journal!.statut),
              ),
            ),
        ],
      ),
      body: stageId == null || stageId.isEmpty
          ? const EmptyState(
              icon: Icons.business_center_outlined,
              title: 'Aucun stage actif',
              message:
                  'Un stage en cours est requis pour rédiger un journal hebdomadaire.',
            )
          : LoadingOverlay(
              loading: _saving || _submitting,
              child: Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _WeekPicker(semaine: _semaine, onTap: _pickWeek),
                    const SizedBox(height: 16),
                    _SectionHeader(
                      icon: Icons.work_outline,
                      title: 'Travaux réalisés',
                      required: true,
                    ),
                    const SizedBox(height: 8),
                    _MultilineField(
                      controller: _travauxController,
                      label: 'Travaux réalisés',
                      hint: 'Décrivez ce que vous avez accompli cette semaine',
                      validator: (value) =>
                          (value == null || value.trim().isEmpty)
                          ? 'Veuillez décrire vos travaux réalisés.'
                          : null,
                    ),
                    const SizedBox(height: 16),
                    const _SectionHeader(
                      icon: Icons.help_outline,
                      title: 'Difficultés rencontrées',
                    ),
                    const SizedBox(height: 8),
                    _MultilineField(
                      controller: _difficultesController,
                      label: 'Difficultés',
                      hint: 'Problèmes, blocages, points durs...',
                    ),
                    const SizedBox(height: 16),
                    const _SectionHeader(
                      icon: Icons.lightbulb_outline,
                      title: 'Solutions apportées',
                    ),
                    const SizedBox(height: 8),
                    _MultilineField(
                      controller: _solutionsController,
                      label: 'Solutions',
                      hint: 'Comment avez-vous résolu ces difficultés ?',
                    ),
                    const SizedBox(height: 16),
                    const _SectionHeader(
                      icon: Icons.school_outlined,
                      title: 'Compétences acquises',
                    ),
                    const SizedBox(height: 8),
                    _MultilineField(
                      controller: _competencesController,
                      label: 'Compétences',
                      hint: 'Nouvelles compétences techniques ou humaines',
                    ),
                    const SizedBox(height: 16),
                    const _SectionHeader(
                      icon: Icons.schedule_outlined,
                      title: 'Heures travaillées',
                    ),
                    const SizedBox(height: 8),
                    AppTextField(
                      controller: _heuresController,
                      label: 'Nombre d\'heures',
                      hintText: 'Ex. 36',
                      icon: Icons.timer_outlined,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) return null;
                        final heures = double.tryParse(
                          value.replaceAll(',', '.'),
                        );
                        if (heures == null) {
                          return 'Veuillez saisir un nombre valide.';
                        }
                        if (heures < 0 || heures > 168) {
                          return 'Les heures doivent être entre 0 et 168.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    const _SectionHeader(
                      icon: Icons.comment_outlined,
                      title: 'Commentaire',
                    ),
                    const SizedBox(height: 8),
                    _MultilineField(
                      controller: _commentaireController,
                      label: 'Commentaire',
                      hint: 'Observations personnelles (optionnel)',
                    ),
                    const SizedBox(height: 24),
                    AppButton(
                      label: 'Enregistrer',
                      loading: _saving,
                      onPressed: (_saving || _submitting)
                          ? null
                          : () => _save(submit: false),
                    ),
                    if (!_isEditing) ...[
                      const SizedBox(height: 8),
                      AppButton(
                        label: 'Enregistrer et soumettre',
                        loading: _submitting,
                        fullWidth: true,
                        onPressed: (_saving || _submitting)
                            ? null
                            : () => _save(submit: true),
                      ),
                    ],
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
    );
  }
}

class _WeekPicker extends StatelessWidget {
  const _WeekPicker({required this.semaine, required this.onTap});

  final DateTime semaine;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final end = semaine.add(const Duration(days: 6));
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            const Icon(Icons.calendar_today_outlined, color: AppColors.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Semaine du ${formatDateFr(semaine)} au ${formatDateFr(end)}',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Touchez pour changer de semaine',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.edit_calendar_outlined, color: AppColors.primary),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.icon,
    required this.title,
    this.required = false,
  });

  final IconData icon;
  final String title;
  final bool required;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            gradient: AppColors.brandGradient,
            borderRadius: BorderRadius.circular(11),
          ),
          child: Icon(icon, size: 18, color: Colors.white),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
        ),
        if (required)
          Text(
            '*',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: AppColors.danger,
              fontWeight: FontWeight.w800,
            ),
          ),
      ],
    );
  }
}

class _MultilineField extends StatelessWidget {
  const _MultilineField({
    required this.controller,
    required this.label,
    this.hint,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      minLines: 3,
      maxLines: 6,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        alignLabelWithHint: true,
        border: const OutlineInputBorder(),
      ),
    );
  }
}
