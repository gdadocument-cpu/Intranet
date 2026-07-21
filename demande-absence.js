let demandesAbsenceMembre = [];
let demandesAbsenceNom = "";
let demandesAbsenceGrade = "";
let demandeAbsenceEdition = null;
let demandesAbsenceChargees = false;
let demandesAbsenceChargement = false;

function ouvrirDemandesAbsenceGDA() {
  definirModuleGdaActif("demandes-absence");
  demandeAbsenceEdition = null;
  if (demandesAbsenceChargees) {
    afficherDemandesAbsenceGDA();
    chargerDemandesAbsenceGDA(true);
    return;
  }
  const zone = document.getElementById("workspace");
  if (!zone) return;
  zone.innerHTML = `
    <section id="demandesAbsenceModule" class="demandes-absence-module">
      <div class="demandes-absence-message">Chargement de vos demandes…</div>
    </section>
  `;
  chargerDemandesAbsenceGDA(false);
}

async function chargerDemandesAbsenceGDA(silencieux) {
  if (demandesAbsenceChargement) return;
  demandesAbsenceChargement = true;
  try {
    const reponse = await fetch(
      API_URL + "?action=recupererMesDemandesAbsence" +
      (silencieux ? "&_=" + Date.now() : ""),
      { cache: "no-store" }
    );
    const resultat = await reponse.json();
    if (!resultat.success) throw new Error(resultat.message || "Demandes indisponibles.");
    appliquerDemandesAbsenceGDA(resultat);
  } catch (erreur) {
    if (!moduleGdaEstActif("demandes-absence")) return;
    if (demandesAbsenceChargees) {
      afficherNotificationGDA(erreur.message || "Actualisation impossible.", "erreur");
    } else {
      document.getElementById("workspace").innerHTML = `
        <section id="demandesAbsenceModule" class="demandes-absence-module">
          <div class="demandes-absence-message erreur">${echapperHTML(erreur.message)}</div>
        </section>
      `;
    }
  } finally {
    demandesAbsenceChargement = false;
  }
}

function appliquerDemandesAbsenceGDA(resultat) {
  demandesAbsenceMembre = Array.isArray(resultat.demandes) ? resultat.demandes : [];
  demandesAbsenceNom = resultat.nom || sessionStorage.getItem("nomUtilisateur") || "";
  demandesAbsenceGrade = resultat.grade || sessionStorage.getItem("gradeUtilisateur") || "";
  demandesAbsenceChargees = true;
  if (moduleGdaEstActif("demandes-absence")) afficherDemandesAbsenceGDA();
  if (resultat.message && moduleGdaEstActif("demandes-absence")) {
    afficherNotificationGDA(resultat.message, "succes");
  }
  if (typeof actualiserNotificationsAbsenceGDA === "function") {
    actualiserNotificationsAbsenceGDA(true);
  }
}

function afficherDemandesAbsenceGDA() {
  if (!moduleGdaEstActif("demandes-absence")) return;
  const zone = document.getElementById("workspace");
  if (!zone) return;
  const demandes = demandesAbsenceMembre.slice().sort(function (a, b) {
    return convertirDateHeureDemandeAbsence(b.dateCreation) -
      convertirDateHeureDemandeAbsence(a.dateCreation);
  });
  const enAttente = demandes.filter(function (demande) {
    return normaliserStatutDemandeAbsence(demande.statut) === "EN ATTENTE";
  }).length;

  zone.innerHTML = `
    <section id="demandesAbsenceModule" class="demandes-absence-module">
      <header class="demandes-absence-entete">
        <div><span>Espace GDA</span><h3>📅 Demande d’absence</h3><p>Envoyez et suivez vos demandes personnelles.</p></div>
        <div class="demandes-absence-resume">
          <article><strong>${demandes.length}</strong><span>Total</span></article>
          <article><strong>${enAttente}</strong><span>En attente</span></article>
          <button id="demandesAbsenceActualiser" type="button">↻ Actualiser</button>
        </div>
      </header>
      <div class="demandes-absence-colonnes">
        <section class="demandes-absence-colonne">${creerFormulaireDemandeAbsenceGDA()}</section>
        <section class="demandes-absence-colonne demandes-absence-historique">
          <header><div><span>Historique personnel</span><h4>Mes demandes</h4></div><small>Du plus récent au plus ancien</small></header>
          <div class="demandes-absence-liste">
            ${demandes.length
              ? demandes.map(creerCarteDemandeAbsenceGDA).join("")
              : '<div class="demandes-absence-vide"><span>📭</span><strong>Aucune demande</strong><p>Votre première demande apparaîtra ici.</p></div>'}
          </div>
        </section>
      </div>
    </section>
  `;
  brancherDemandesAbsenceGDA();
}

function creerFormulaireDemandeAbsenceGDA() {
  const edition = demandeAbsenceEdition;
  const aujourdHui = dateAujourdhuiDemandeAbsence();
  return `
    <div class="demandes-absence-formulaire-fixe">
      <header><span>${edition ? "Modification" : "Nouvelle demande"}</span><h4>${edition ? "Modifier ma demande" : "Faire une demande"}</h4><p>La demande restera modifiable jusqu’à la décision d’un officier.</p></header>
      <div class="demandes-absence-auteur"><strong>${echapperHTML(demandesAbsenceNom || "Utilisateur")}</strong><span>${echapperHTML(demandesAbsenceGrade || "Grade non renseigné")}</span></div>
      <form id="demandeAbsenceFormulaire">
        <label><span>Date de début</span><input id="demandeAbsenceDebut" type="date" lang="fr-FR" value="${echapperHTML(edition ? edition.dateDebut : aujourdHui)}" required></label>
        <label><span>Date de fin</span><input id="demandeAbsenceFin" type="date" lang="fr-FR" min="${echapperHTML(edition ? edition.dateDebut : aujourdHui)}" max="${echapperHTML(dateLimiteDemandeAbsence(edition ? edition.dateDebut : aujourdHui))}" value="${echapperHTML(edition ? edition.dateFin : "")}" required></label>
        <label><span>Raison</span><textarea id="demandeAbsenceRaison" maxlength="1500" required placeholder="Expliquez la raison de votre absence…">${echapperHTML(edition ? edition.raison : "")}</textarea></label>
        <div class="demandes-absence-formulaire-actions">
          ${edition ? '<button id="demandeAbsenceAnnuler" class="secondaire" type="button">Annuler</button>' : ""}
          <button id="demandeAbsenceEnvoyer" type="submit">${edition ? "Enregistrer" : "Envoyer la demande"}</button>
        </div>
        <p id="demandeAbsenceMessage" role="status"></p>
      </form>
    </div>
  `;
}

function creerCarteDemandeAbsenceGDA(demande) {
  const statut = normaliserStatutDemandeAbsence(demande.statut);
  return `
    <article class="demande-absence-carte statut-${statut.toLowerCase().replace(/\s+/g, "-")}">
      <header>
        <div><span>Du ${echapperHTML(formaterDateHeureGDA(demande.dateDebut))}</span><strong>Au ${echapperHTML(formaterDateHeureGDA(demande.dateFin))}</strong></div>
        <span class="demande-absence-statut">${libelleStatutDemandeAbsence(statut)}</span>
      </header>
      <div class="demande-absence-raison"><span>Raison</span><p>${echapperHTML(demande.raison || "Non renseignée")}</p></div>
      ${statut === "REFUSEE"
        ? `<div class="demande-absence-refus"><strong>Motif du refus</strong><p>${echapperHTML(demande.motifRefus || "Non renseigné")}</p><small>Décision de ${echapperHTML(demande.decidePar || "Officier")}</small></div>`
        : demande.decidePar
          ? `<small class="demande-absence-decision">Décision de ${echapperHTML(demande.decidePar)} le ${echapperHTML(formaterDateHeureGDA(demande.dateDecision))}</small>`
          : ""}
      <footer>
        <span>Envoyée le ${echapperHTML(formaterDateHeureGDA(demande.dateCreation))}</span>
        ${demande.modifiable
          ? `<div><button type="button" data-modifier-demande-absence="${echapperHTML(demande.id)}">Modifier</button><button class="danger" type="button" data-supprimer-demande-absence="${echapperHTML(demande.id)}">Supprimer</button></div>`
          : demande.peutTerminer
            ? `<button class="terminer" type="button" data-terminer-demande-absence="${echapperHTML(demande.id)}">Fin d’absence</button>`
            : demande.supprimableHistorique
              ? `<button class="danger" type="button" data-supprimer-demande-absence="${echapperHTML(demande.id)}" data-suppression-historique="true">Supprimer de mon historique</button>`
              : ""}
      </footer>
    </article>
  `;
}

function brancherDemandesAbsenceGDA() {
  document.getElementById("demandesAbsenceActualiser")?.addEventListener("click", function () { chargerDemandesAbsenceGDA(true); });
  const debut = document.getElementById("demandeAbsenceDebut");
  const fin = document.getElementById("demandeAbsenceFin");
  if (debut && fin) debut.addEventListener("change", function () {
    fin.min = debut.value;
    fin.max = dateLimiteDemandeAbsence(debut.value);
    if (fin.value < debut.value || fin.value > fin.max) fin.value = "";
  });
  document.getElementById("demandeAbsenceFormulaire")?.addEventListener("submit", envoyerDemandeAbsenceGDA);
  document.getElementById("demandeAbsenceAnnuler")?.addEventListener("click", function () { demandeAbsenceEdition = null; afficherDemandesAbsenceGDA(); });
  document.querySelectorAll("[data-modifier-demande-absence]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      demandeAbsenceEdition = demandesAbsenceMembre.find(function (demande) { return demande.id === bouton.dataset.modifierDemandeAbsence; }) || null;
      afficherDemandesAbsenceGDA();
    });
  });
  document.querySelectorAll("[data-supprimer-demande-absence]").forEach(function (bouton) {
    bouton.addEventListener("click", function () { supprimerDemandeAbsenceGDA(bouton.dataset.supprimerDemandeAbsence, bouton); });
  });
  document.querySelectorAll("[data-terminer-demande-absence]").forEach(function (bouton) {
    bouton.addEventListener("click", function () { terminerDemandeAbsenceGDA(bouton.dataset.terminerDemandeAbsence, bouton); });
  });
}

async function envoyerDemandeAbsenceGDA(event) {
  event.preventDefault();
  const edition = demandeAbsenceEdition;
  const bouton = document.getElementById("demandeAbsenceEnvoyer");
  const debut = document.getElementById("demandeAbsenceDebut").value;
  const fin = document.getElementById("demandeAbsenceFin").value;
  const raison = document.getElementById("demandeAbsenceRaison").value.trim();
  const message = document.getElementById("demandeAbsenceMessage");
  if (!debut || !fin || !raison) {
    if (message) message.textContent = "La date de début, la date de fin et la raison sont obligatoires.";
    return;
  }
  if (fin < debut || fin > dateLimiteDemandeAbsence(debut)) {
    if (message) message.textContent = "La période doit être valide et ne pas dépasser deux mois.";
    return;
  }
  const donnees = new URLSearchParams({
    identifiant: sessionStorage.getItem("identifiantUtilisateur") || "",
    dateDebut: debut,
    dateFin: fin,
    raison: raison
  });
  if (edition) donnees.set("demandeId", edition.id);
  bouton.disabled = true;
  try {
    const reponse = await fetch(API_URL + "?action=" + (edition ? "modifierDemandeAbsence" : "ajouterDemandeAbsence"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: donnees.toString() });
    const resultat = await reponse.json();
    if (!resultat.success) throw new Error(resultat.message || "Enregistrement impossible.");
    demandeAbsenceEdition = null;
    appliquerDemandesAbsenceGDA(resultat);
  } catch (erreur) {
    const message = document.getElementById("demandeAbsenceMessage");
    if (message) message.textContent = erreur.message;
    bouton.disabled = false;
  }
}

async function supprimerDemandeAbsenceGDA(id, bouton) {
  const historique = bouton.dataset.suppressionHistorique === "true";
  if (!confirm(
    historique
      ? "Supprimer cette demande de votre historique personnel ? Le registre officiel ne sera pas modifié."
      : "Supprimer cette demande en attente ?"
  )) return;
  bouton.disabled = true;
  await executerActionDemandeAbsenceGDA("supprimerDemandeAbsence", id, bouton);
}

async function terminerDemandeAbsenceGDA(id, bouton) {
  if (!confirm("Confirmer votre retour et terminer cette absence maintenant ?")) return;
  bouton.disabled = true;
  await executerActionDemandeAbsenceGDA("terminerDemandeAbsence", id, bouton);
}

async function executerActionDemandeAbsenceGDA(action, id, bouton) {
  try {
    const donnees = new URLSearchParams({ identifiant: sessionStorage.getItem("identifiantUtilisateur") || "", demandeId: id });
    const reponse = await fetch(API_URL + "?action=" + action, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: donnees.toString() });
    const resultat = await reponse.json();
    if (!resultat.success) throw new Error(resultat.message || "Action impossible.");
    appliquerDemandesAbsenceGDA(resultat);
  } catch (erreur) {
    afficherNotificationGDA(erreur.message, "erreur");
    bouton.disabled = false;
  }
}

function normaliserStatutDemandeAbsence(statut) {
  const valeur = String(statut || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (valeur === "VALIDEE") return "VALIDEE";
  if (valeur === "REFUSEE") return "REFUSEE";
  if (valeur === "TERMINEE") return "TERMINEE";
  return "EN ATTENTE";
}

function libelleStatutDemandeAbsence(statut) {
  if (statut === "VALIDEE") return "✓ Validée";
  if (statut === "REFUSEE") return "✕ Refusée";
  if (statut === "TERMINEE") return "■ Finie";
  return "⌛ En attente";
}

function dateAujourdhuiDemandeAbsence() {
  const date = new Date();
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function dateLimiteDemandeAbsence(dateISO) {
  const morceaux = String(dateISO || "").split("-").map(Number);
  if (morceaux.length !== 3 || morceaux.some(Number.isNaN)) return "";
  const premierJour = new Date(morceaux[0], morceaux[1] - 1 + 2, 1);
  const dernierJour = new Date(
    premierJour.getFullYear(),
    premierJour.getMonth() + 1,
    0
  ).getDate();
  const limite = new Date(
    premierJour.getFullYear(),
    premierJour.getMonth(),
    Math.min(morceaux[2], dernierJour)
  );
  return limite.getFullYear() + "-" +
    String(limite.getMonth() + 1).padStart(2, "0") + "-" +
    String(limite.getDate()).padStart(2, "0");
}

function convertirDateHeureDemandeAbsence(valeur) {
  const texte = String(valeur || "");
  const iso = texte.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?$/);
  return iso ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), Number(iso[4] || 0), Number(iso[5] || 0), Number(iso[6] || 0)).getTime() : 0;
}

window.ouvrirDemandesAbsenceGDA = ouvrirDemandesAbsenceGDA;
