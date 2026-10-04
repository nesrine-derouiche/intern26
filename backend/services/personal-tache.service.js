const personalTacheRepo = require('../repositories/personal-tache.repository');
const ApiError = require('../utils/error.util');

class PersonalTacheService {
  async getMyTaches(user) {
    const stagiaireId = await this._assertStagiaire(user);
    return personalTacheRepo.findByStagiaire(stagiaireId);
  }

  async getTacheById(id, user) {
    const task = await personalTacheRepo.findById(id);
    if (!task) throw new ApiError(404, 'Tâche personnelle introuvable.');
    this._assertOwner(task, user);
    return task;
  }

  async create(body, user) {
    const stagiaireId = await this._assertStagiaire(user);
    return personalTacheRepo.create({
      stagiaire_id: stagiaireId,
      titre: body.titre,
      description: body.description,
      priorite: body.priorite,
      date_echeance: body.date_echeance,
    });
  }

  async update(id, body, user) {
    const task = await personalTacheRepo.findById(id);
    if (!task) throw new ApiError(404, 'Tâche personnelle introuvable.');
    this._assertOwner(task, user);
    return personalTacheRepo.update(id, {
      titre: body.titre,
      description: body.description,
      priorite: body.priorite,
      date_echeance: body.date_echeance,
    });
  }

  async delete(id, user) {
    const task = await personalTacheRepo.findById(id);
    if (!task) throw new ApiError(404, 'Tâche personnelle introuvable.');
    this._assertOwner(task, user);
    return personalTacheRepo.delete(id);
  }

  async move(id, body, user) {
    const task = await personalTacheRepo.findById(id);
    if (!task) throw new ApiError(404, 'Tâche personnelle introuvable.');
    this._assertOwner(task, user);

    const validStatuts = ['A_FAIRE', 'EN_COURS', 'TERMINEE'];
    if (body.statut && !validStatuts.includes(body.statut)) {
      throw new ApiError(400, 'Statut invalide. Valeurs acceptées : A_FAIRE, EN_COURS, TERMINEE.');
    }

    return personalTacheRepo.move(id, {
      statut: body.statut,
      position: body.position,
    });
  }

  async getCounts(user) {
    const stagiaireId = await this._assertStagiaire(user);
    return personalTacheRepo.countByStatut(stagiaireId);
  }

  async _assertStagiaire(user) {
    if (!user || user.role !== 'STAGIAIRE') {
      throw new ApiError(403, 'Seul un stagiaire peut gérer ses tâches personnelles.');
    }
    return user.id;
  }

  _assertOwner(task, user) {
    if (task.stagiaire_id !== user.id) {
      throw new ApiError(403, 'Accès refusé : cette tâche ne vous appartient pas.');
    }
  }
}

module.exports = new PersonalTacheService();
