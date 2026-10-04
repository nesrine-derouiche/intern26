const journalRepository = require('../repositories/journal.repository');
const stageRepository = require('../repositories/stage.repository');
const notificationService = require('./notification.service');
const { buildPaginatedResult } = require('../utils/pagination.util');
const ApiError = require('../utils/error.util');

const WEEK_START = { statut: ['BROUILLON', 'REJETE'] };

class JournalService {
  async getAllJournals(options = null, scope = null) {
    const result = await journalRepository.findAll(options, scope);
    if (options && options.enabled) {
      const data = result.data.map((row) => this._normalizeRow(row));
      return buildPaginatedResult(data, result.total, options.page, options.limit);
    }
    return result.map((row) => this._normalizeRow(row));
  }

  async createJournal(body, currentUser) {
    const { stage_id, travaux, difficultes, solutions, competences, commentaire } = body;
    const heures = parseFloat(body.heures) || 0;
    const semaine = this._normalizeWeek(body.semaine);

    const stage = await stageRepository.findJournalContext(stage_id);
    if (!stage) throw new ApiError(404, 'Stage introuvable.');
    if (stage.stagiaire_id !== currentUser.id) {
      throw new ApiError(403, 'Vous ne pouvez pas remplir un journal pour un stage qui ne vous appartient pas.');
    }
    if (stage.statut !== 'EN_COURS') {
      throw new ApiError(400, 'Le journal ne peut être rempli que pendant un stage en cours.');
    }

    this._assertWeekInStage(semaine, stage);

    const existing = await journalRepository.findByStageAndWeek(stage_id, semaine);
    if (existing) {
      throw new ApiError(400, 'Un journal existe déjà pour cette semaine.');
    }

    const journal = await journalRepository.create({
      stage_id,
      semaine,
      travaux,
      difficultes,
      solutions,
      competences,
      heures,
      commentaire
    });

    return this._normalizeRow(journal);
  }

  async updateJournal(id, body, currentUser) {
    const journal = await journalRepository.findById(id);
    if (!journal) throw new ApiError(404, 'Journal hebdomadaire introuvable.');
    if (!WEEK_START.statut.includes(journal.statut)) {
      throw new ApiError(400, 'Un journal soumis ou validé ne peut plus être modifié.');
    }

    const stage = await stageRepository.findJournalContext(journal.stage_id);
    if (!stage || stage.stagiaire_id !== currentUser.id) {
      throw new ApiError(403, 'Vous ne pouvez modifier que votre propre journal.');
    }

    const updated = await journalRepository.update(id, {
      travaux: body.travaux ?? journal.travaux,
      difficultes: body.difficultes ?? journal.difficultes,
      solutions: body.solutions ?? journal.solutions,
      competences: body.competences ?? journal.competences,
      heures: body.heures !== undefined ? parseFloat(body.heures) : parseFloat(journal.heures),
      commentaire: body.commentaire ?? journal.commentaire
    });

    return this._normalizeRow(updated);
  }

  async submitJournal(id, currentUser) {
    const journal = await journalRepository.findById(id);
    if (!journal) throw new ApiError(404, 'Journal hebdomadaire introuvable.');
    if (journal.statut === 'SOUMIS') throw new ApiError(400, 'Ce journal est déjà soumis.');
    if (journal.statut === 'VALIDE') throw new ApiError(400, 'Ce journal est déjà validé.');

    const stage = await stageRepository.findJournalContext(journal.stage_id);
    if (!stage || stage.stagiaire_id !== currentUser.id) {
      throw new ApiError(403, 'Vous ne pouvez soumettre que votre propre journal.');
    }

    const submitted = await journalRepository.submit(id);

    await notificationService.notifyBestEffort(
      stage.encadrant_id,
      'Journal hebdomadaire soumis',
      `Le stagiaire a soumis son journal de la semaine du ${this._formatSemaine(journal.semaine)} pour validation.`,
      'JOURNAL'
    );

    return this._normalizeRow(submitted);
  }

  async validateJournal(id, commentaire, currentUser) {
    const journal = await journalRepository.findById(id);
    if (!journal) throw new ApiError(404, 'Journal hebdomadaire introuvable.');
    if (journal.statut !== 'SOUMIS') {
      throw new ApiError(400, 'Seul un journal soumis peut être validé.');
    }

    const stage = await stageRepository.findJournalContext(journal.stage_id);
    if (!stage || stage.encadrant_id !== currentUser.id) {
      throw new ApiError(403, 'Seul l\'encadrant assigné à ce stage peut valider le journal.');
    }

    const validated = await journalRepository.validate(id, commentaire || '');

    await notificationService.notifyBestEffort(
      stage.stagiaire_id,
      'Journal hebdomadaire validé',
      `Votre journal de la semaine du ${this._formatSemaine(journal.semaine)} a été validé par votre encadrant.`,
      'JOURNAL'
    );

    return this._normalizeRow(validated);
  }

  async rejectJournal(id, commentaire, currentUser) {
    const journal = await journalRepository.findById(id);
    if (!journal) throw new ApiError(404, 'Journal hebdomadaire introuvable.');
    if (journal.statut !== 'SOUMIS') {
      throw new ApiError(400, 'Seul un journal soumis peut être rejeté.');
    }

    const stage = await stageRepository.findJournalContext(journal.stage_id);
    if (!stage || stage.encadrant_id !== currentUser.id) {
      throw new ApiError(403, 'Seul l\'encadrant assigné à ce stage peut rejeter le journal.');
    }

    const rejected = await journalRepository.reject(id, commentaire || '');

    await notificationService.notifyBestEffort(
      stage.stagiaire_id,
      'Journal hebdomadaire à corriger',
      `Votre journal de la semaine du ${this._formatSemaine(journal.semaine)} a été rejeté : ${commentaire || 'à reprendre'}.`,
      'JOURNAL'
    );

    return this._normalizeRow(rejected);
  }

  async deleteJournal(id, currentUser) {
    const journal = await journalRepository.findById(id);
    if (!journal) throw new ApiError(404, 'Journal hebdomadaire introuvable.');
    if (journal.statut !== 'BROUILLON') {
      throw new ApiError(400, 'Seul un journal en brouillon peut être supprimé.');
    }
    const stage = await stageRepository.findJournalContext(journal.stage_id);
    if (!stage || stage.stagiaire_id !== currentUser.id) {
      throw new ApiError(403, 'Vous ne pouvez supprimer que votre propre journal.');
    }
    await journalRepository.delete(id);
  }

  _normalizeWeek(value) {
    const iso = this._toIsoDate(value);
    const parts = iso.split('-');
    if (parts.length !== 3) throw new ApiError(400, 'La date de la semaine est invalide.');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) {
      throw new ApiError(400, 'La date de la semaine est invalide.');
    }
    const date = new Date(Date.UTC(y, m - 1, d));
    const day = date.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    return new Date(Date.UTC(y, m - 1, d + diff)).toISOString().slice(0, 10);
  }

  _toIsoDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const two = (n) => String(n).padStart(2, '0');
      return `${value.getFullYear()}-${two(value.getMonth() + 1)}-${two(value.getDate())}`;
    }
    return String(value).slice(0, 10);
  }

  _assertWeekInStage(semaine, stage) {
    if (!stage.date_debut || !stage.date_fin) {
      throw new ApiError(400, 'Les dates du stage sont incomplètes.');
    }
    const start = this._normalizeWeek(stage.date_debut);
    const end = this._normalizeWeek(stage.date_fin);
    if (semaine < start || semaine > end) {
      throw new ApiError(400, 'La semaine demandée est en dehors de la période du stage.');
    }
  }

  _formatSemaine(value) {
    const date = new Date(value);
    const two = (n) => String(n).padStart(2, '0');
    return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  _normalizeRow(row) {
    if (!row) return row;
    return { ...row, semaine: this._toIsoDate(row.semaine), heures: parseFloat(row.heures) };
  }
}

module.exports = new JournalService();
