const noteRepository = require('../repositories/note.repository');
const ApiError = require('../utils/error.util');
const logger = require('../utils/logger');

/**
 * P2-TASK5 — Notes personnelles des stagiaires (carnet privé).
 *
 * Confidentialité : le propriétaire est TOUJOURS dérivé de la session
 * (`user.id`, rôle STAGIAIRE imposé). Un identifiant client ne donne
 * jamais accès aux notes d'autrui ; toute note hors périmètre répond
 * 404 (existence non révélée), jamais 403.
 *
 * Idempotence : `client_key` (UUID v4 généré par le client, conservé
 * entre les reprises) + contrainte unique partielle. En cas de conflit
 * 23505, la note existante est renvoyée (200) au lieu d'un doublon.
 */
const MAX_TITRE_LENGTH = 200;

function mapDatabaseError(err) {
  switch (err && err.code) {
    case '22P02':
      return new ApiError(404, 'Note introuvable.');
    case '23503':
      return new ApiError(422, 'Référence invalide.');
    case '23502':
      return new ApiError(400, 'Un champ obligatoire est manquant.');
    default:
      logger.error('[NOTE] Erreur base de données :', err && err.code, err && err.message);
      return new ApiError(500, 'Opération impossible sur les notes.');
  }
}

async function execute(operation) {
  try {
    return await operation();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw mapDatabaseError(err);
  }
}

class NoteService {
  _assertStagiaire(user) {
    if (!user || user.role !== 'STAGIAIRE') {
      throw new ApiError(403, 'Seul un stagiaire peut gérer ses notes personnelles.');
    }
    return user.id;
  }

  async _getOwnedNote(id, user) {
    if (id === undefined || id === null || id === '') {
      throw new ApiError(400, 'L\'identifiant de la note est requis.');
    }
    const stagiaireId = this._assertStagiaire(user);
    const note = await execute(() => noteRepository.findById(id));
    if (!note || note.stagiaire_id !== stagiaireId) {
      throw new ApiError(404, 'Note introuvable.');
    }
    return note;
  }

  _assertTitre(titre, { required = true } = {}) {
    if (titre === undefined || titre === null) {
      if (required) return '';
      return;
    }
    if (typeof titre !== 'string') {
      throw new ApiError(400, 'Le champ « titre » doit être une chaîne.');
    }
    if (titre.length > MAX_TITRE_LENGTH) {
      throw new ApiError(400, `Le champ « titre » ne doit pas dépasser ${MAX_TITRE_LENGTH} caractères.`);
    }
  }

  _assertContenu(contenu) {
    if (contenu !== undefined && contenu !== null && typeof contenu !== 'string') {
      throw new ApiError(400, 'Le champ « contenu » doit être une chaîne.');
    }
  }

  async listNotes(user) {
    const stagiaireId = this._assertStagiaire(user);
    return execute(() => noteRepository.findByStagiaire(stagiaireId));
  }

  async createNote(data, user) {
    const stagiaireId = this._assertStagiaire(user);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ApiError(400, 'Les données de la note doivent être un objet.');
    }
    const { titre, contenu, pinned, client_key } = data;
    this._assertTitre(titre, { required: false });
    this._assertContenu(contenu);
    if (pinned !== undefined && typeof pinned !== 'boolean') {
      throw new ApiError(400, 'Le champ « pinned » doit être un booléen.');
    }
    if (client_key !== undefined && client_key !== null && typeof client_key !== 'string') {
      throw new ApiError(400, 'Le champ « client_key » doit être une chaîne.');
    }

    let note;
    try {
      note = await noteRepository.create({
        stagiaire_id: stagiaireId,
        titre: titre === undefined || titre === null ? '' : titre,
        contenu: contenu === undefined || contenu === null ? '' : contenu,
        pinned: pinned === undefined ? false : pinned,
        client_key: client_key === undefined ? null : client_key
      });
    } catch (err) {
      if (err && err.code === '23505' && client_key) {
        const existing = await execute(() =>
          noteRepository.findByOwnerAndClientKey(stagiaireId, client_key)
        );
        if (existing) return { note: existing, deduplicated: true };
      }
      throw mapDatabaseError(err);
    }
    return { note, deduplicated: false };
  }

  async updateNote(id, data, user) {
    await this._getOwnedNote(id, user);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ApiError(400, 'Les données de mise à jour doivent être un objet.');
    }
    const { titre, contenu, pinned } = data;
    if (titre === undefined && contenu === undefined && pinned === undefined) {
      throw new ApiError(400, 'Aucun champ modifiable fourni : titre, contenu ou pinned attendu.');
    }
    this._assertTitre(titre, { required: false });
    this._assertContenu(contenu);
    if (pinned !== undefined && typeof pinned !== 'boolean') {
      throw new ApiError(400, 'Le champ « pinned » doit être un booléen.');
    }
    const updated = await execute(() => noteRepository.update(id, { titre, contenu, pinned }));
    if (!updated) throw new ApiError(404, 'Note introuvable.');
    return updated;
  }

  async removeNote(id, user) {
    await this._getOwnedNote(id, user);
    const removed = await execute(() => noteRepository.remove(id));
    if (!removed) throw new ApiError(404, 'Note introuvable.');
    return true;
  }
}

module.exports = new NoteService();
