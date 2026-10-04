const pointageRepository = require('../repositories/pointage.repository');
const horaireRepository = require('../repositories/horaire.repository');
const stageRepository = require('../repositories/stage.repository');
const { buildPaginatedResult } = require('../utils/pagination.util');
const ApiError = require('../utils/error.util');

const TUNIS_TZ = 'Africa/Tunis';

function getTunisNow() {
  return new Date().toLocaleString('en-CA', { timeZone: TUNIS_TZ, hour12: false });
}

function getTunisDate() {
  return getTunisNow().slice(0, 10);
}

function getTunisTime() {
  return getTunisNow().slice(11, 19);
}

function toTunisDate(dateStr) {
  if (!dateStr) return getTunisDate();
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-CA', { timeZone: TUNIS_TZ });
}

function parseTimeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function calculateRetard(heureEntree, horaire) {
  if (!heureEntree || !horaire) return 0;
  const entreeDate = new Date(heureEntree);
  const entreeMinutes = entreeDate.getUTCHours() * 60 + entreeDate.getUTCMinutes();
  const debutMinutes = parseTimeToMinutes(horaire.heure_debut);
  const diff = entreeMinutes - debutMinutes;
  return diff > 0 ? diff : 0;
}

class PointageService {
  async pointerEntree(stageId, user) {
    const stage = await stageRepository.findById(stageId);
    if (!stage) throw new ApiError(404, 'Stage introuvable.');

    if (user.role === 'STAGIAIRE' && stage.stagiaire_id !== user.id) {
      throw new ApiError(403, 'Vous ne pouvez pointer que pour votre propre stage.');
    }

    const now = new Date();
    const tunisDate = toTunisDate(now.toISOString());

    const existing = await pointageRepository.findByStageAndDate(stageId, tunisDate);
    if (existing) {
      throw new ApiError(409, 'Vous avez déjà pointé votre entrée aujourd\'hui.');
    }

    const horaire = await horaireRepository.findByStageId(stageId);
    const retardMinutes = calculateRetard(now.toISOString(), horaire);
    const statut = retardMinutes > 0 ? 'RETARD' : 'PRESENT';

    try {
      return await pointageRepository.create({
        stage_id: stageId,
        date_pointage: tunisDate,
        heure_entree: now.toISOString(),
        retard_minutes: retardMinutes,
        statut
      });
    } catch (err) {
      if (err.code === '23505') {
        throw new ApiError(409, 'Conflit : un pointage existe déjà pour ce stage aujourd\'hui.');
      }
      throw err;
    }
  }

  async pointerSortie(stageId, user) {
    const stage = await stageRepository.findById(stageId);
    if (!stage) throw new ApiError(404, 'Stage introuvable.');

    if (user.role === 'STAGIAIRE' && stage.stagiaire_id !== user.id) {
      throw new ApiError(403, 'Vous ne pouvez pointer que pour votre propre stage.');
    }

    const now = new Date();
    const tunisDate = toTunisDate(now.toISOString());

    const existing = await pointageRepository.findByStageAndDate(stageId, tunisDate);
    if (!existing) {
      throw new ApiError(400, 'Aucune entrée enregistrée pour aujourd\'hui. Veuillez d\'abord pointer votre entrée.');
    }
    if (existing.heure_sortie) {
      throw new ApiError(409, 'La sortie a déjà été enregistrée pour aujourd\'hui.');
    }

    return await pointageRepository.setSortie(existing.id, now.toISOString());
  }

  async getMesPresences(stagiaireId, options = null, filters = {}) {
    return await pointageRepository.findByStagiaire(stagiaireId, options, filters);
  }

  async getPresencesByStage(stageId, options = null, scope = null, filters = {}) {
    filters.stage_id = stageId;
    return await pointageRepository.findAll(options, scope, filters);
  }

  async getRetards(scope = null, options = null, filters = {}) {
    filters.statut = 'RETARD';
    return await pointageRepository.findAll(options, scope, filters);
  }

  async corriger(id, data, user) {
    const existing = await pointageRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Pointage introuvable.');

    if (data.heure_entree !== undefined && data.heure_sortie !== undefined) {
      const entree = new Date(data.heure_entree);
      const sortie = new Date(data.heure_sortie);
      if (sortie <= entree) {
        throw new ApiError(400, 'L\'heure de sortie doit être postérieure à l\'heure d\'entrée.');
      }
    }

    const updated = await pointageRepository.update(id, data);
    if (!updated) throw new ApiError(404, 'Pointage introuvable.');
    return updated;
  }

  async getStats(stageId, dateDebut, dateFin) {
    return await pointageRepository.getStatsByStage(stageId, dateDebut, dateFin);
  }

  async getAllPointages(options = null, scope = null, filters = {}) {
    const rows = await pointageRepository.findAll(options, scope, filters);
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows.data;
  }

  async getPointageById(id) {
    const pointage = await pointageRepository.findById(id);
    if (!pointage) throw new ApiError(404, 'Pointage introuvable.');
    return pointage;
  }
}

module.exports = new PointageService();
