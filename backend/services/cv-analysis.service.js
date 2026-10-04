const logger = require('../utils/logger');
const cvAnalyseRepository = require('../repositories/cv_analyse.repository');

const AI_PROVIDER = 'moteur-regles-v1';

/**
 * Service d'analyse de CV.
 *
 * Moteur d'analyse local, déterministe et sans appel externe : il compare le
 * profil du candidat (compétences, niveau d'études, langues) aux exigences de
 * l'offre (compétences, technologies, niveau) et produit le contrat
 * `AnalyseCvResult` attendu par le frontend (POST /offres/:id/analyse-cv).
 *
 * Le résultat est persisté dans `cv_analyse` (statut « TERMINEE », `resultat`
 * JSONB, `ai_provider`) pour rester consultable via `getMe`.
 */

const NIVEAU_RANK = {
  bac: 1,
  baccalaureat: 1,
  technicien: 2,
  bts: 2,
  licence: 3,
  master: 4,
  ingenieur: 5
};

/** Normalisation insensible à la casse et aux accents. */
const normalize = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const splitList = (value, keepCase = false) =>
  String(value || '')
    .split(/[,;/\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (keepCase ? s : normalize(s)));

const niveauRank = (niveau) => NIVEAU_RANK[normalize(niveau).replace(/\d+\s*$/, '').trim()] ?? 0;

/** Compétences dédupliquées (sur forme normalisée) en conservant la casse d'origine. */
const collectOfferSkills = (offre) => {
  const skills = [...splitList(offre.competences_demandees, true), ...splitList(offre.technologies, true)];
  const seen = new Set();
  return skills.filter((skill) => {
    const key = normalize(skill);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Une compétence du candidat « couvre » une compétence demandée par l'offre. */
const matches = (offerSkill, candidateSkills) =>
  candidateSkills.some((cs) => {
    if (cs === offerSkill) return true;
    if (offerSkill.length >= 3 && (cs.includes(offerSkill) || offerSkill.includes(cs))) return true;
    const tokens = offerSkill.split(/[\s/+\-]+/).filter((t) => t.length >= 3);
    return tokens.some((t) => cs.includes(t) || t.includes(cs));
  });

class CvAnalysisService {
  /** Enregistre (ou réenregistre) l'attente d'analyse d'un CV fraîchement déposé. */
  async register(candidatId, cvFilename) {
    try {
      await cvAnalyseRepository.clearByCandidat(candidatId);
      await cvAnalyseRepository.create(candidatId, cvFilename);
    } catch (err) {
      logger.error('Impossible d’enregistrer le CV pour analyse', err.message);
    }
  }

  /** Purge des analyses (suppression du CV). */
  async clear(candidatId) {
    await cvAnalyseRepository.clearByCandidat(candidatId);
  }

  /** État d'analyse courant d'un candidat (ou `null`). */
  async getStatus(candidatId) {
    return cvAnalyseRepository.findByCandidat(candidatId);
  }

  /** Moteur de correspondance CV / offre (déterministe, sans IA externe). */
  analyser({ candidat, offre }) {
    const offerSkills = collectOfferSkills(offre);
    const candidateSkills = splitList(candidat.competences);
    const strengths = offerSkills.filter((skill) => matches(normalize(skill), candidateSkills));
    const weaknesses = offerSkills.filter((skill) => !strengths.includes(skill));

    const coverage = offerSkills.length ? strengths.length / offerSkills.length : 0.7;
    const skillScore = Math.round(coverage * 100);
    const educationMatch = this._educationMatch(candidat.niveau, offre.niveau);
    const languages = splitList(candidat.langues, true);
    const languageScore = languages.length >= 3 ? 95 : languages.length === 2 ? 80 : languages.length === 1 ? 60 : 35;
    const experienceMatch = Math.min(95, Math.round(30 + 0.65 * skillScore + this._sectorBoost(candidat, offre)));
    const score = Math.round(
      0.55 * skillScore + 0.2 * educationMatch + 0.15 * languageScore + 0.1 * experienceMatch
    );

    return {
      score,
      level: this._level(score),
      strengths,
      weaknesses,
      languages,
      experienceMatch,
      educationMatch,
      interviewChance: Math.min(92, Math.max(12, Math.round(score * 0.9))),
      recommendation: this._recommendation({ offre, strengths, weaknesses, offerSkills })
    };
  }

  /**
   * Analyse le CV du candidat contre une offre puis persiste le résultat
   * dans `cv_analyse` (statut « TERMINEE »).
   */
  async runAnalysis(candidatId, offre, candidat) {
    const resultat = this.analyser({ candidat, offre });
    try {
      await cvAnalyseRepository.clearByCandidat(candidatId);
      const row = await cvAnalyseRepository.create(candidatId, candidat.cv_original_name || null);
      await cvAnalyseRepository.updateResult(row.id, 'TERMINEE', resultat, AI_PROVIDER);
    } catch (err) {
      logger.error('Impossible de persister l’analyse de CV', err.message);
    }
    return resultat;
  }

  /** Correspondance niveau d'études du candidat / niveau demandé (%). */
  _educationMatch(candidatNiveau, offreNiveau) {
    const c = niveauRank(candidatNiveau);
    const o = niveauRank(offreNiveau);
    if (!c || !o) return 75;
    if (c >= o) return 100;
    return o - c === 1 ? 65 : 40;
  }

  /** Bonus secteur si la spécialité du candidat colle au département de l'offre. */
  _sectorBoost(candidat, offre) {
    const dept = splitList(offre.departement_nom);
    const spec = splitList(candidat.specialite);
    if (!dept.length || !spec.length) return 0;
    return dept.some((t) => spec.some((s) => s.includes(t) || t.includes(s))) ? 15 : 0;
  }

  _level(score) {
    if (score >= 85) return 'EXCELLENT';
    if (score >= 70) return 'GOOD';
    if (score >= 55) return 'AVERAGE';
    return 'LOW';
  }

  _recommendation({ offre, strengths, weaknesses, offerSkills }) {
    if (!offerSkills.length) {
      return 'Cette offre ne précise pas de compétences techniques : le score repose sur votre niveau d\'études et vos langues.';
    }
    if (!weaknesses.length) {
      return `Excellent alignement : votre profil couvre toutes les compétences attendues pour « ${offre.titre} ». Vous êtes idéalement positionné pour être présélectionné.`;
    }
    return `Votre profil couvre ${strengths.length} compétence(s) requise(s) sur ${offerSkills.length}. Pour maximiser vos chances, mettez en avant : ${weaknesses.join(', ')}.`;
  }
}

module.exports = new CvAnalysisService();
