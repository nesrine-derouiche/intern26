const PDFDocument = require('pdfkit');
const stageRepository = require('../repositories/stage.repository');
const evaluationRepository = require('../repositories/evaluation.repository');
const ApiError = require('../utils/error.util');

const setBold = (doc) => doc.font('Helvetica-Bold');
const setRegular = (doc) => doc.font('Helvetica');

class PdfService {
  async generateConvention(stageId, res) {
    const stage = await this._getStagePdfData(stageId);
    const doc = this._startPdf(res, `convention_stage_${stage.stagiaire_nom}_${stage.stagiaire_prenom}.pdf`);
    this._renderConventionHeader(doc);
    this._renderConventionParties(doc, stage);
    this._renderConventionObjet(doc, stage);
    this._renderConventionDuree(doc, stage);
    this._renderConventionSignatures(doc);
    doc.end();
  }

  async generateAttestation(stageId, res) {
    const stage = await this._getStagePdfData(stageId);
    const doc = this._startPdf(res, `attestation_stage_${stage.stagiaire_nom}_${stage.stagiaire_prenom}.pdf`);
    this._renderAttestationBody(doc, stage);
    doc.end();
  }

  async generateEvaluation(stageId, res) {
    const evaluation = await this._getEvaluationPdfData(stageId);
    const doc = this._startPdf(res, `evaluation_${evaluation.stagiaire_nom}_${evaluation.stagiaire_prenom}.pdf`);
    this._renderEvaluationHeader(doc, evaluation);
    this._renderEvaluationCriteria(doc, evaluation);
    this._renderEvaluationFooter(doc, evaluation);
    doc.end();
  }

  /**
   * P1-3A-6 — Streamme vers la réponse HTTP un contenu déjà rendu par
   * documentTemplateService.renderTemplate(), à travers le mécanisme PDF
   * existant (_startPdf : mêmes headers, même pdfkit, même doc.pipe(res)).
   *
   * Seule méthode ajoutée : generateConvention/generateAttestation/
   * generateEvaluation et tous les helpers de rendu restent strictement
   * inchangés (le chemin historique reste disponible sans template).
   *
   * Le contenu est inséré tel quel (le PDF n'interprète aucune balise) ; les
   * entités HTML issues de l'échappement des variables (P1-3A-3) apparaissent
   * donc en texte brut pour les valeurs contenant &, <, >, " ou '.
   */
  generateRendered(res, filename, rendered) {
    const doc = this._startPdf(res, filename);
    setRegular(doc).fontSize(12).fillColor('#2D3748').text(String(rendered ?? ''));
    doc.end();
  }

  async _getStagePdfData(stageId) {
    const stage = await stageRepository.findPdfData(stageId);
    if (!stage) throw new ApiError(404, 'Stage introuvable.');
    return stage;
  }

  async _getEvaluationPdfData(stageId) {
    const evaluation = await evaluationRepository.findPdfData(stageId);
    if (!evaluation) throw new ApiError(404, 'Aucune évaluation trouvée pour ce stage.');
    return evaluation;
  }

  _startPdf(res, filename) {
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);
    return doc;
  }

  _renderConventionHeader(doc) {
    setBold(doc).fontSize(22).fillColor('#1A365D').text('CONVENTION DE STAGE', { align: 'center' });
    doc.moveDown(0.5);
    setRegular(doc).fontSize(10).fillColor('#4A5568').text("Société Tunisienne de l'Électricité et du Gaz (STEG)", { align: 'center' });
    doc.moveDown(1.5);
    doc.strokeColor('#CBD5E0').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(1.5);
  }

  _renderConventionParties(doc, stage) {
    setBold(doc).fontSize(14).fillColor('#2B6CB0').text('ARTICLE 1 : PARTIES CONTRACTANTES', { underline: true });
    doc.moveDown(0.5);
    setRegular(doc).fontSize(11).fillColor('#2D3748').text("La présente convention régit les relations entre l'organisme d'accueil :", { lineGap: 4 });
    setBold(doc).text("La Société Tunisienne de l'Électricité et du Gaz (STEG)");
    setRegular(doc).text('Encadrant : ').font('Helvetica-Bold').text(`${stage.encadrant_prenom} ${stage.encadrant_nom} (${stage.encadrant_email})`);
    setRegular(doc).text('Stagiaire : ').font('Helvetica-Bold').text(`${stage.stagiaire_prenom} ${stage.stagiaire_nom} (${stage.stagiaire_email})`);
    doc.moveDown(1.5);
  }

  _renderConventionObjet(doc, stage) {
    setBold(doc).fontSize(14).fillColor('#2B6CB0').text('ARTICLE 2 : OBJET ET DÉROULEMENT DU STAGE', { underline: true });
    doc.moveDown(0.5);
    setRegular(doc).fontSize(11).fillColor('#2D3748').text("Le stage s'inscrit dans le cadre du projet professionnel de l'étudiant.", { lineGap: 4 });
    setRegular(doc).text('Sujet : ').font('Helvetica-Bold').text(stage.offre_titre);
    setRegular(doc).text('Description : ').text(stage.offre_desc || 'Aucune description.');
    setRegular(doc).text('Département : ').font('Helvetica-Bold').text(stage.departement_nom);
    doc.moveDown(1.5);
  }

  _renderConventionDuree(doc, stage) {
    setBold(doc).fontSize(14).fillColor('#2B6CB0').text('ARTICLE 3 : DURÉE ET CALENDRIER', { underline: true });
    doc.moveDown(0.5);
    setRegular(doc).fontSize(11).fillColor('#2D3748')
      .text('Du ').font('Helvetica-Bold').text(new Date(stage.date_debut).toLocaleDateString())
      .font('Helvetica').text(' au ').font('Helvetica-Bold').text(new Date(stage.date_fin).toLocaleDateString())
      .font('Helvetica').text('. Statut : ').font('Helvetica-Bold').text(stage.statut);
    doc.moveDown(2);
  }

  _renderConventionSignatures(doc) {
    setBold(doc).fontSize(12).text('Signatures', { align: 'left' });
    doc.moveDown(0.5);
    setRegular(doc).fontSize(10).text('Pour la STEG (Encadrant)                        Le Stagiaire');
    doc.moveDown(2.5);
    doc.text('___________________________                ___________________________');
  }

  _renderAttestationBody(doc, stage) {
    doc.moveDown(2);
    setBold(doc).fontSize(12).fillColor('#718096').text("SOCIÉTÉ TUNISIENNE DE L'ÉLECTRICITÉ ET DU GAZ", { align: 'center' });
    setRegular(doc).fontSize(10).fillColor('#718096').text('Direction des Ressources Humaines', { align: 'center' });
    doc.moveDown(3);
    setBold(doc).fontSize(26).fillColor('#2B6CB0').text('ATTESTATION DE STAGE', { align: 'center', characterSpacing: 1 });
    doc.moveDown(2);
    setRegular(doc).fontSize(12).fillColor('#2D3748').text("Nous soussignés, la STEG, attestons que :", { lineGap: 8 });
    doc.moveDown(0.5);
    setBold(doc).fontSize(14).fillColor('#1A365D').text(`${stage.stagiaire_prenom} ${stage.stagiaire_nom}`, { align: 'center' });
    doc.moveDown(0.5);
    setRegular(doc).fontSize(12).fillColor('#2D3748')
      .text('a effectué un stage au département ').font('Helvetica-Bold').text(stage.departement_nom)
      .font('Helvetica').text(' sous la direction de ').font('Helvetica-Bold').text(`${stage.encadrant_prenom} ${stage.encadrant_nom}`)
      .font('Helvetica').text(' sur le sujet ').moveDown(0.5);
    setBold(doc).fontSize(13).fillColor('#2B6CB0').text(`"${stage.offre_titre}"`, { align: 'center' });
    doc.moveDown(0.5);
    setRegular(doc).fontSize(12).fillColor('#2D3748')
      .text('Du ').font('Helvetica-Bold').text(new Date(stage.date_debut).toLocaleDateString())
      .font('Helvetica').text(' au ').font('Helvetica-Bold').text(new Date(stage.date_fin).toLocaleDateString()).font('Helvetica').text('.');
    doc.moveDown(1.5);
    setRegular(doc).fontSize(12).text('En foi de quoi, la présente attestation lui est délivrée pour valoir ce que de droit.');
    doc.moveDown(3);
    setRegular(doc).fontSize(11).fillColor('#718096').text(`Fait à Tunis, le ${new Date().toLocaleDateString()}`, { align: 'right' });
    doc.moveDown(1.5);
    setBold(doc).fontSize(12).fillColor('#1A365D').text('Le Directeur des Ressources Humaines', { align: 'right' });
  }

  _renderEvaluationHeader(doc, evaluation) {
    setBold(doc).fontSize(20).fillColor('#1A365D').text("FICHE D'ÉVALUATION DE STAGE", { align: 'center' });
    doc.moveDown(0.5);
    setRegular(doc).fontSize(10).fillColor('#718096').text("Société Tunisienne de l'Électricité et du Gaz (STEG)", { align: 'center' });
    doc.moveDown(1.5);
    doc.strokeColor('#CBD5E0').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(1.5);

    setRegular(doc).fontSize(11).fillColor('#2D3748');
    setBold(doc).text('Stagiaire : ', { continued: true }).font('Helvetica').text(`${evaluation.stagiaire_prenom} ${evaluation.stagiaire_nom}`);
    setBold(doc).text('Encadrant : ', { continued: true }).font('Helvetica').text(`${evaluation.encadrant_prenom} ${evaluation.encadrant_nom}`);
    setBold(doc).text('Sujet de Stage : ', { continued: true }).font('Helvetica').text(evaluation.offre_titre);
    setBold(doc).text('Département : ', { continued: true }).font('Helvetica').text(evaluation.departement_nom);
    setBold(doc).text("Date d'évaluation : ", { continued: true }).font('Helvetica').text(new Date(evaluation.date_evaluation).toLocaleDateString());
    doc.moveDown(2);

    setBold(doc).fontSize(14).fillColor('#2B6CB0').text("CRITÈRES D'ÉVALUATION", { underline: true });
    doc.moveDown(0.8);
  }

  _renderEvaluationCriteria(doc, evaluation) {
    const renderCriteria = (name, note) => {
      setBold(doc).fontSize(11).fillColor('#2D3748').text(name, { continued: true })
        .font('Helvetica').fillColor('#4A5568').text(' : ', { continued: true })
        .font('Helvetica-Bold').fillColor('#1A365D').text(`${note} / 20`);
      doc.moveDown(0.4);
    };

    renderCriteria('1. Compétences Techniques', evaluation.technique);
    renderCriteria('2. Communication & Présentation', evaluation.communication);
    renderCriteria('3. Autonomie & Initiative', evaluation.autonomie);
    renderCriteria('4. Ponctualité & Assiduité', evaluation.ponctualite);
    renderCriteria('5. Qualité du travail', evaluation.qualite);
    doc.moveDown(1);
  }

  _renderEvaluationFooter(doc, evaluation) {
    doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(1);
    setBold(doc).fontSize(16).fillColor('#2F855A').text(`Moyenne Générale : ${parseFloat(evaluation.note_finale).toFixed(2)} / 20`, { align: 'center' });
    doc.moveDown(1.5);
    setBold(doc).fontSize(12).fillColor('#2B6CB0').text("COMMENTAIRE DE L'ENCADRANT");
    doc.moveDown(0.5);
    setRegular(doc).fontSize(11).fillColor('#4A5568').text(evaluation.commentaire || 'Aucun commentaire rédigé pour cette évaluation.');
    doc.moveDown(3);
    setBold(doc).fontSize(12).fillColor('#1A365D').text("Signature de l'encadrant", { align: 'right' });
    doc.moveDown(2.5);
    doc.text('___________________________', { align: 'right' });
  }
}

module.exports = new PdfService();
