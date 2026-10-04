import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/personal_tache.dart';
import '../../providers/personal_tache/personal_tache_providers.dart';

class PersonalTacheFormSheet extends ConsumerStatefulWidget {
  const PersonalTacheFormSheet({super.key, this.existing});

  final PersonalTache? existing;

  @override
  ConsumerState<PersonalTacheFormSheet> createState() => _PersonalTacheFormSheetState();
}

class _PersonalTacheFormSheetState extends ConsumerState<PersonalTacheFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titreCtrl;
  late final TextEditingController _descCtrl;
  String _priorite = 'MOYENNE';
  DateTime? _echeance;
  bool _submitting = false;

  bool get isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _titreCtrl = TextEditingController(text: e?.titre ?? '');
    _descCtrl = TextEditingController(text: e?.description ?? '');
    _priorite = e?.priorite ?? 'MOYENNE';
    if (e?.dateEcheance != null) {
      _echeance = DateTime.tryParse(e!.dateEcheance!);
    }
  }

  @override
  void dispose() {
    _titreCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      final notifier = ref.read(personalTachesProvider.notifier);
      if (isEditing) {
        await notifier.updateTask(
          widget.existing!.id,
          titre: _titreCtrl.text.trim(),
          description: _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
          priorite: _priorite,
          dateEcheance: _echeance?.toIso8601String().split('T').first,
        );
      } else {
        await notifier.create(
          titre: _titreCtrl.text.trim(),
          description: _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
          priorite: _priorite,
          dateEcheance: _echeance?.toIso8601String().split('T').first,
        );
      }
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur : $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _echeance ?? now.add(const Duration(days: 7)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _echeance = picked);
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final navBarHeight = MediaQuery.of(context).viewPadding.bottom + 60;

    return Padding(
      padding: EdgeInsets.fromLTRB(24, 16, 24, bottom + navBarHeight + 16),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              isEditing ? 'Modifier la tâche' : 'Nouvelle tâche',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 20),
            TextFormField(
              controller: _titreCtrl,
              decoration: const InputDecoration(
                labelText: 'Titre *',
                hintText: 'Ex: Préparer ma présentation',
              ),
              textCapitalization: TextCapitalization.sentences,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Titre requis' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descCtrl,
              decoration: const InputDecoration(
                labelText: 'Description',
                hintText: 'Détails optionnels...',
              ),
              textCapitalization: TextCapitalization.sentences,
              maxLines: 2,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _priorite,
                    decoration: const InputDecoration(labelText: 'Priorité'),
                    items: const [
                      DropdownMenuItem(value: 'BASSE', child: Text('Basse')),
                      DropdownMenuItem(value: 'MOYENNE', child: Text('Moyenne')),
                      DropdownMenuItem(value: 'HAUTE', child: Text('Haute')),
                    ],
                    onChanged: (v) => setState(() => _priorite = v ?? 'MOYENNE'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: InkWell(
                    onTap: _pickDate,
                    borderRadius: BorderRadius.circular(12),
                    child: InputDecorator(
                      decoration: InputDecoration(
                        labelText: 'Échéance',
                        suffixIcon: _echeance != null
                            ? IconButton(
                                icon: const Icon(Icons.clear, size: 18),
                                onPressed: () => setState(() => _echeance = null),
                              )
                            : const Icon(Icons.calendar_today_outlined, size: 18),
                      ),
                      child: Text(
                        _echeance != null
                            ? '${_echeance!.day}/${_echeance!.month}/${_echeance!.year}'
                            : 'Choisir',
                        style: TextStyle(
                          color: _echeance != null ? AppColors.textPrimary : AppColors.textTertiary,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            SizedBox(
              height: 48,
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text(isEditing ? 'Enregistrer' : 'Créer'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
