const INSTRUCTEUR_RAPPORTS_API_URL = API_URL;

let rapportsHistoriqueInstructeur = [];
let typeHistoriqueInstructeur = "TEST";
let rapportsHistoriqueInstructeurCharges = false;
let matriculeTestInstructeurVerifie = "";
let rapportsInstructeurPeutAdministrer = false;
let candidatsFormationInstructeur = [];
const CACHE_RAPPORTS_INSTRUCTEUR = "gdaRapportsInstructeur:";
const DUREE_CACHE_RAPPORTS_INSTRUCTEUR = 5 * 60 * 1000;
let rapportsHistoriqueInstructeurChargesLe = 0;

window.invaliderCacheRapportsInstructeurGDA = function() {
  try { localStorage.removeItem(cleCacheRapportsInstructeur()); } catch (erreur) { /* Facultatif. */ }
  rapportsHistoriqueInstructeurChargesLe = 0;
};

function sessionPeutAdministrerRapportsInstructeur() {
  const specialisation = normaliserValeurRapportInstructeur(
    sessionStorage.getItem("specialisationUtilisateur") || ""
  );
  return sessionStorage.getItem("proprietaireUtilisateur") === "true" ||
    sessionStorage.getItem("coproprietaireUtilisateur") === "true" ||
    specialisation.includes("RESPONSABLE INST");
}

function cleCacheRapportsInstructeur() {
  return CACHE_RAPPORTS_INSTRUCTEUR + normaliserValeurRapportInstructeur(
    sessionStorage.getItem("identifiantUtilisateur") || ""
  );
}

function lireCacheRapportsInstructeur() {
  try {
    const cache = JSON.parse(localStorage.getItem(cleCacheRapportsInstructeur()) || "null");
    if (!cache || !Array.isArray(cache.rapports) || Date.now() - Number(cache.date || 0) > DUREE_CACHE_RAPPORTS_INSTRUCTEUR) return null;
    return cache;
  } catch (erreur) {
    return null;
  }
}

function enregistrerCacheRapportsInstructeur() {
  try {
    localStorage.setItem(cleCacheRapportsInstructeur(), JSON.stringify({
      date: Date.now(),
      rapports: rapportsHistoriqueInstructeur,
      peutAdministrer: rapportsInstructeurPeutAdministrer
    }));
  } catch (erreur) {
    /* Le cache local reste facultatif. */
  }
}

function ouvrirEspaceRapportsInstructeur() {
  definirModuleGdaActif("instructeur-rapports-accueil");
  const workspace = document.getElementById("workspace");
  if (!workspace) return;
  workspace.innerHTML = `
    <section class="rapports-instructeur-module rapports-instructeur-accueil">
      <header class="rapports-instructeur-entete">
        <span>Spécialisation Instructeur</span>
        <h3>📝 Rapports Instructeur</h3>
        <p>Sélectionnez le type de rapport ou consultez l’historique.</p>
      </header>

      <div class="rapports-instructeur-triangle" aria-label="Choix du module Rapport Instructeur">
        <button type="button" class="rapport-instructeur-choix test" data-rapport-instructeur="test">
          <span>🧠</span>
          <strong>Rapport Test</strong>
          <small>Rédiger un rapport concernant un test.</small>
        </button>
        <button type="button" class="rapport-instructeur-choix formation" data-rapport-instructeur="formation">
          <span>🎓</span>
          <strong>Rapport Formation</strong>
          <small>Rédiger un rapport concernant une formation.</small>
        </button>
        <button type="button" class="rapport-instructeur-choix historique" data-rapport-instructeur="historique">
          <span>📋</span>
          <strong>Historique des rapports</strong>
          <small>Retrouver les rapports Test et Formation.</small>
        </button>
      </div>
    </section>
  `;
  document.querySelectorAll("[data-rapport-instructeur]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      const choix = bouton.dataset.rapportInstructeur;
      if (choix === "test") ouvrirRedactionRapportInstructeur("TEST");
      if (choix === "formation") ouvrirRedactionRapportInstructeur("FORMATION");
      if (choix === "historique") ouvrirHistoriqueRapportsInstructeur();
    });
  });
}

function ouvrirRedactionRapportInstructeur(type) {
  const estTest = type === "TEST";
  definirModuleGdaActif(estTest
    ? "instructeur-rapport-test"
    : "instructeur-rapport-formation");
  const workspace = document.getElementById("workspace");
  if (!workspace) return;
  if (!estTest) {
    ouvrirFormulaireRapportFormationInstructeur();
    return;
  }
  matriculeTestInstructeurVerifie = "";
  const instructeur = sessionStorage.getItem("identifiantUtilisateur") || "Non renseigné";
  workspace.innerHTML = `
    <section class="rapports-instructeur-module">
      ${creerRetourRapportsInstructeur()}
      <header class="rapports-instructeur-entete historique">
        <span>Évaluation d’aptitude</span>
        <h3>🧠 Rapport Test</h3>
        <p>La décision est calculée automatiquement à partir de la note.</p>
      </header>

      <form id="formulaireRapportTestInstructeur" class="rapport-test-instructeur-formulaire">
        <div class="rapport-test-instructeur-grille">
          <label>
            <span>Rapport rempli par</span>
            <input type="text" value="${echapperRapportInstructeur(instructeur)}" readonly>
          </label>
          <label>
            <span>Date du test *</span>
            <input id="rapportTestDate" name="dateTest" type="date" value="${dateLocaleRapportInstructeur()}" required>
          </label>
          <label class="large">
            <span>Personne formée *</span>
            <input id="rapportTestPersonne" name="personneFormee" type="text" placeholder="Nom de la personne ayant passé le test" required>
          </label>
          <label class="large">
            <span>Matricule définitif *</span>
            <div class="rapport-test-matricule-controle">
              <input id="rapportTestMatricule" name="matricule" type="text" placeholder="Matricule du nouveau GDA" required>
              <button id="rapportTestVerifierMatricule" type="button" title="Vérifier la disponibilité" aria-label="Vérifier la disponibilité du matricule">✓</button>
            </div>
            <small id="rapportTestMatriculeStatut" class="rapport-test-statut"></small>
          </label>
          <label>
            <span>Steam ID *</span>
            <input id="rapportTestSteam" name="steamId" type="text" placeholder="Steam ID" required>
          </label>
          <label>
            <span>Discord ID *</span>
            <input id="rapportTestDiscord" name="discordId" type="text" inputmode="numeric" placeholder="Discord ID" required>
          </label>
          <label>
            <span>Note sur 20 *</span>
            <input id="rapportTestNote" name="note" type="number" min="0" max="20" step="0.5" placeholder="14" required>
          </label>
          <div class="rapport-test-decision" id="rapportTestDecision">
            <span>Décision automatique</span>
            <strong>En attente de la note</strong>
            <small>14/20 minimum pour être accepté</small>
          </div>
          <label class="large">
            <span>Remarque</span>
            <textarea id="rapportTestRemarque" name="remarque" rows="4" placeholder="Remarque concernant le déroulement du test"></textarea>
          </label>
          <label class="large">
            <span>Commentaire</span>
            <textarea id="rapportTestCommentaire" name="commentaire" rows="4" placeholder="Commentaire complémentaire"></textarea>
          </label>
        </div>
        <div id="rapportTestRetour" class="rapport-test-retour" aria-live="polite"></div>
        <button id="rapportTestEnregistrer" class="rapport-test-enregistrer" type="submit">Enregistrer le rapport Test</button>
      </form>
    </section>
  `;
  installerRetourRapportsInstructeur();
  installerFormulaireRapportTestInstructeur();
}

async function ouvrirFormulaireRapportFormationInstructeur() {
  definirModuleGdaActif("instructeur-rapport-formation");
  const workspace = document.getElementById("workspace");
  if (!workspace) return;
  workspace.innerHTML = `
    <section class="rapports-instructeur-module">
      ${creerRetourRapportsInstructeur()}
      <div class="rapports-instructeur-vide">Chargement des personnes en attente…</div>
    </section>
  `;
  installerRetourRapportsInstructeur();
  try {
    const resultat = await requeteRapportInstructeur(
      "recupererCandidatsRapportFormationInstructeur",
      {},
      "GET"
    );
    if (!moduleGdaEstActif("instructeur-rapport-formation")) return;
    candidatsFormationInstructeur = Array.isArray(resultat.candidats)
      ? resultat.candidats
      : [];
    afficherFormulaireRapportFormationInstructeur();
  } catch (erreur) {
    if (!moduleGdaEstActif("instructeur-rapport-formation")) return;
    workspace.innerHTML = `
      <section class="rapports-instructeur-module">
        ${creerRetourRapportsInstructeur()}
        <div class="rapports-instructeur-vide rapports-instructeur-erreur">
          ${echapperRapportInstructeur(erreur.message || "Impossible de charger les personnes en attente.")}
        </div>
      </section>
    `;
    installerRetourRapportsInstructeur();
  }
}

function afficherFormulaireRapportFormationInstructeur() {
  const workspace = document.getElementById("workspace");
  if (!workspace || !moduleGdaEstActif("instructeur-rapport-formation")) return;
  const auteur = sessionStorage.getItem("identifiantUtilisateur") || "Non renseigné";
  const options = candidatsFormationInstructeur.map(function (personne) {
    return `<option value="${echapperRapportInstructeur(personne.matricule)}">${echapperRapportInstructeur(personne.matricule)}</option>`;
  }).join("");
  workspace.innerHTML = `
    <section class="rapports-instructeur-module">
      ${creerRetourRapportsInstructeur()}
      <header class="rapports-instructeur-entete historique">
        <span>Validation de la formation</span>
        <h3>🎓 Rapport Formation</h3>
        <p>Retapez les identifiants observés pendant la formation. Leur comparaison sera traitée lors de la prise en charge.</p>
      </header>
      <form id="formulaireRapportFormationInstructeur" class="rapport-test-instructeur-formulaire">
        <div class="rapport-test-instructeur-grille">
          <label><span>Rapport rempli par</span><input type="text" value="${echapperRapportInstructeur(auteur)}" readonly></label>
          <label><span>Date de la formation *</span><input name="dateFormation" type="date" value="${dateLocaleRapportInstructeur()}" required></label>
          <label class="large"><span>Personne en attente *</span><select id="rapportFormationPersonne" name="matricule" required ${candidatsFormationInstructeur.length ? "" : "disabled"}><option value="">Sélectionner une personne</option>${options}</select></label>
          <label><span>Steam ID du rapport Test</span><input id="rapportFormationSteamTest" type="text" value="" readonly></label>
          <label><span>Discord ID du rapport Test</span><input id="rapportFormationDiscordTest" type="text" value="" readonly></label>
          <label><span>Retapez le Steam ID *</span><input id="rapportFormationSteam" name="steamId" type="text" autocomplete="off" required disabled></label>
          <label><span>Retapez le Discord ID *</span><input id="rapportFormationDiscord" name="discordId" type="text" inputmode="numeric" autocomplete="off" required disabled></label>
          <label class="large"><span>Commentaire</span><textarea name="commentaire" rows="5" placeholder="Commentaire concernant la formation"></textarea></label>
        </div>
        ${candidatsFormationInstructeur.length ? "" : '<div class="rapport-formation-aucun">Aucune personne n’attend actuellement son rapport Formation.</div>'}
        <div id="rapportFormationRetour" class="rapport-test-retour" aria-live="polite"></div>
        <button id="rapportFormationEnregistrer" class="rapport-test-enregistrer" type="submit" ${candidatsFormationInstructeur.length ? "" : "disabled"}>Enregistrer le rapport Formation</button>
      </form>
    </section>
  `;
  installerRetourRapportsInstructeur();
  document.getElementById("rapportFormationPersonne")
    ?.addEventListener("change", actualiserPersonneRapportFormationInstructeur);
  document.getElementById("formulaireRapportFormationInstructeur")
    ?.addEventListener("submit", enregistrerFormulaireRapportFormationInstructeur);
}

function actualiserPersonneRapportFormationInstructeur(evenement) {
  const matricule = evenement.target.value;
  const personne = candidatsFormationInstructeur.find(function (element) {
    return normaliserValeurRapportInstructeur(element.matricule) ===
      normaliserValeurRapportInstructeur(matricule);
  });
  const steamTest = document.getElementById("rapportFormationSteamTest");
  const discordTest = document.getElementById("rapportFormationDiscordTest");
  const steam = document.getElementById("rapportFormationSteam");
  const discord = document.getElementById("rapportFormationDiscord");
  if (steamTest) steamTest.value = personne ? personne.steamId || "" : "";
  if (discordTest) discordTest.value = personne ? personne.discordId || "" : "";
  [steam, discord].forEach(function (champ) {
    if (!champ) return;
    champ.value = "";
    champ.disabled = !personne;
  });
}

async function enregistrerFormulaireRapportFormationInstructeur(evenement) {
  evenement.preventDefault();
  const formulaire = evenement.currentTarget;
  if (!formulaire.reportValidity()) return;
  const bouton = document.getElementById("rapportFormationEnregistrer");
  const retour = document.getElementById("rapportFormationRetour");
  bouton.disabled = true;
  bouton.textContent = "Enregistrement…";
  try {
    const resultat = await requeteRapportInstructeur(
      "enregistrerRapportFormationInstructeur",
      Object.fromEntries(new FormData(formulaire).entries()),
      "POST"
    );
    if (resultat.rapport) rapportsHistoriqueInstructeur.unshift(resultat.rapport);
    rapportsHistoriqueInstructeurCharges = true;
    enregistrerCacheRapportsInstructeur();
    if (typeof cleCacheSuivisFormationInstructeur === "function") {
      localStorage.removeItem(cleCacheSuivisFormationInstructeur());
    }
    typeHistoriqueInstructeur = "FORMATION";
    if (typeof afficherNotificationGDA === "function") {
      afficherNotificationGDA(resultat.message || "Rapport Formation enregistré.", "succes");
    }
    ouvrirHistoriqueRapportsInstructeur();
  } catch (erreur) {
    retour.textContent = erreur.message || "Impossible d’enregistrer le rapport Formation.";
    retour.className = "rapport-test-retour erreur";
    bouton.disabled = false;
    bouton.textContent = "Enregistrer le rapport Formation";
  }
}

async function ouvrirHistoriqueRapportsInstructeur(forcer) {
  definirModuleGdaActif("instructeur-historique-rapports");
  if (!rapportsHistoriqueInstructeurCharges && !forcer) {
    const cache = lireCacheRapportsInstructeur();
    if (cache) {
      rapportsHistoriqueInstructeur = cache.rapports;
      rapportsInstructeurPeutAdministrer =
        cache.peutAdministrer === true || sessionPeutAdministrerRapportsInstructeur();
      rapportsHistoriqueInstructeurCharges = true;
      rapportsHistoriqueInstructeurChargesLe = Date.now();
    }
  }
  if (rapportsHistoriqueInstructeurCharges) {
    afficherHistoriqueRapportsInstructeur();
    if (!forcer && Date.now() - rapportsHistoriqueInstructeurChargesLe < DUREE_CACHE_RAPPORTS_INSTRUCTEUR) {
      return;
    }
    chargerHistoriqueRapportsInstructeur(forcer, true);
    return;
  }
  await chargerHistoriqueRapportsInstructeur(forcer, false);
}

async function chargerHistoriqueRapportsInstructeur(forcer, silencieux) {
  const workspace = document.getElementById("workspace");
  if (!workspace) return;
  if (!silencieux) {
    workspace.innerHTML = `
      <section class="rapports-instructeur-module">
        ${creerRetourRapportsInstructeur()}
        <div class="rapports-instructeur-vide">Chargement de l’historique…</div>
      </section>
    `;
    installerRetourRapportsInstructeur();
  }
  try {
    if (forcer && typeof gdaForcerActualisation === "function") {
      gdaForcerActualisation("recupererRapportsInstructeur");
    }
    const resultat = await requeteRapportInstructeur(
      "recupererRapportsInstructeur",
      {},
      "GET"
    );
    rapportsHistoriqueInstructeur = Array.isArray(resultat.rapports)
      ? resultat.rapports
      : [];
    rapportsInstructeurPeutAdministrer =
      resultat.peutAdministrer === true || sessionPeutAdministrerRapportsInstructeur();
    rapportsHistoriqueInstructeurCharges = true;
    rapportsHistoriqueInstructeurChargesLe = Date.now();
    enregistrerCacheRapportsInstructeur();
    afficherHistoriqueRapportsInstructeur();
  } catch (erreur) {
    if (silencieux) {
      if (typeof afficherNotificationGDA === "function") {
        afficherNotificationGDA("Actualisation des rapports Instructeur indisponible.", "erreur");
      }
      return;
    }
    workspace.innerHTML = `
      <section class="rapports-instructeur-module">
        ${creerRetourRapportsInstructeur()}
        <div class="rapports-instructeur-vide rapports-instructeur-erreur">
          ${echapperRapportInstructeur(erreur.message || "Impossible de charger l’historique.")}
        </div>
      </section>
    `;
    installerRetourRapportsInstructeur();
  }
}

function installerFormulaireRapportTestInstructeur() {
  const formulaire = document.getElementById("formulaireRapportTestInstructeur");
  const matricule = document.getElementById("rapportTestMatricule");
  const verifier = document.getElementById("rapportTestVerifierMatricule");
  const note = document.getElementById("rapportTestNote");
  if (matricule) matricule.addEventListener("input", function () {
    matriculeTestInstructeurVerifie = "";
    afficherStatutMatriculeTestInstructeur("", "");
  });
  if (verifier) verifier.addEventListener("click", verifierMatriculeTestInstructeur);
  if (note) note.addEventListener("input", actualiserDecisionRapportTestInstructeur);
  if (formulaire) formulaire.addEventListener("submit", enregistrerFormulaireRapportTestInstructeur);
}

async function verifierMatriculeTestInstructeur() {
  const champ = document.getElementById("rapportTestMatricule");
  const bouton = document.getElementById("rapportTestVerifierMatricule");
  const matricule = champ ? champ.value.trim() : "";
  if (!matricule) {
    afficherStatutMatriculeTestInstructeur("Indiquez d’abord un matricule.", "erreur");
    return false;
  }
  if (bouton) bouton.disabled = true;
  afficherStatutMatriculeTestInstructeur("Vérification en cours…", "attente");
  try {
    const resultat = await requeteRapportInstructeur(
      "verifierMatriculeRapportTestInstructeur",
      { matricule: matricule },
      "GET"
    );
    if (!resultat.disponible) {
      matriculeTestInstructeurVerifie = "";
      afficherStatutMatriculeTestInstructeur(
        resultat.message || "Ce matricule est déjà utilisé.",
        "erreur"
      );
      return false;
    }
    matriculeTestInstructeurVerifie = normaliserValeurRapportInstructeur(matricule);
    afficherStatutMatriculeTestInstructeur(
      resultat.message || "Matricule disponible.",
      "succes"
    );
    return true;
  } catch (erreur) {
    matriculeTestInstructeurVerifie = "";
    afficherStatutMatriculeTestInstructeur(erreur.message, "erreur");
    return false;
  } finally {
    if (bouton) bouton.disabled = false;
  }
}

function afficherStatutMatriculeTestInstructeur(message, type) {
  const statut = document.getElementById("rapportTestMatriculeStatut");
  if (!statut) return;
  statut.textContent = message || "";
  statut.className = "rapport-test-statut" + (type ? " " + type : "");
}

function actualiserDecisionRapportTestInstructeur() {
  const champNote = document.getElementById("rapportTestNote");
  const valeurNote = champNote ? champNote.value.trim() : "";
  const note = valeurNote === "" ? NaN : Number(valeurNote);
  const decision = document.getElementById("rapportTestDecision");
  if (!decision) return;
  if (!Number.isFinite(note) || note < 0 || note > 20) {
    decision.className = "rapport-test-decision";
    decision.innerHTML = `
      <span>Décision automatique</span>
      <strong>En attente de la note</strong>
      <small>14/20 minimum pour être accepté</small>
    `;
    return;
  }
  const accepte = note >= 14;
  decision.className = "rapport-test-decision " + (accepte ? "accepte" : "refuse");
  decision.innerHTML = `
    <span>Décision automatique</span>
    <strong>${accepte ? "✓ Accepté" : "✕ Refusé"}</strong>
    <small>${note.toLocaleString("fr-FR")}/20 — seuil requis : 14/20</small>
  `;
}

async function enregistrerFormulaireRapportTestInstructeur(evenement) {
  evenement.preventDefault();
  const formulaire = evenement.currentTarget;
  if (!formulaire.reportValidity()) return;
  const matricule = document.getElementById("rapportTestMatricule").value.trim();
  if (matriculeTestInstructeurVerifie !== normaliserValeurRapportInstructeur(matricule)) {
    const disponible = await verifierMatriculeTestInstructeur();
    if (!disponible) return;
  }
  const bouton = document.getElementById("rapportTestEnregistrer");
  const retour = document.getElementById("rapportTestRetour");
  if (bouton) {
    bouton.disabled = true;
    bouton.textContent = "Enregistrement…";
  }
  if (retour) retour.textContent = "";
  const donnees = Object.fromEntries(new FormData(formulaire).entries());
  try {
    const resultat = await requeteRapportInstructeur(
      "enregistrerRapportTestInstructeur",
      donnees,
      "POST"
    );
    if (resultat.rapport) {
      rapportsHistoriqueInstructeur.unshift(resultat.rapport);
    }
    rapportsHistoriqueInstructeurCharges = true;
    enregistrerCacheRapportsInstructeur();
    if (typeof cleCacheSuivisFormationInstructeur === "function") {
      localStorage.removeItem(cleCacheSuivisFormationInstructeur());
    }
    typeHistoriqueInstructeur = "TEST";
    if (typeof afficherNotificationGDA === "function") {
      afficherNotificationGDA(resultat.message || "Rapport Test enregistré.", "succes");
    }
    ouvrirHistoriqueRapportsInstructeur();
  } catch (erreur) {
    if (retour) {
      retour.textContent = erreur.message || "Impossible d’enregistrer le rapport.";
      retour.className = "rapport-test-retour erreur";
    }
  } finally {
    if (bouton && document.body.contains(bouton)) {
      bouton.disabled = false;
      bouton.textContent = "Enregistrer le rapport Test";
    }
  }
}

async function requeteRapportInstructeur(action, donnees, methode) {
  const parametres = new URLSearchParams(donnees || {});
  const identifiant = sessionStorage.getItem("identifiantUtilisateur") || "";
  parametres.set("identifiant", identifiant);
  const options = methode === "POST"
    ? {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: parametres.toString()
      }
    : undefined;
  const url = INSTRUCTEUR_RAPPORTS_API_URL + "?action=" +
    encodeURIComponent(action) +
    (methode === "POST" ? "" : "&" + parametres.toString());
  const reponse = await fetch(url, options);
  const resultat = await reponse.json();
  if (!reponse.ok || !resultat.success) {
    throw new Error(resultat.message || "Erreur du serveur GDA.");
  }
  return resultat;
}

function dateLocaleRapportInstructeur() {
  const date = new Date();
  const deux = function (nombre) { return String(nombre).padStart(2, "0"); };
  return date.getFullYear() + "-" + deux(date.getMonth() + 1) + "-" + deux(date.getDate());
}

function normaliserValeurRapportInstructeur(valeur) {
  return String(valeur || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function afficherHistoriqueRapportsInstructeur() {
  const workspace = document.getElementById("workspace");
  if (!workspace || !moduleGdaEstActif("instructeur-historique-rapports")) return;
  rapportsInstructeurPeutAdministrer =
    rapportsInstructeurPeutAdministrer || sessionPeutAdministrerRapportsInstructeur();
  const tests = trierRapportsHistoriqueInstructeur(
    rapportsHistoriqueInstructeur.filter(function (rapport) {
      return normaliserTypeRapportInstructeur(rapport.type) === "TEST";
    })
  );
  const formations = trierRapportsHistoriqueInstructeur(
    rapportsHistoriqueInstructeur.filter(function (rapport) {
      return normaliserTypeRapportInstructeur(rapport.type) === "FORMATION";
    })
  );
  const selection = typeHistoriqueInstructeur === "FORMATION" ? formations : tests;

  workspace.innerHTML = `
    <section class="rapports-instructeur-module">
      ${creerRetourRapportsInstructeur()}
      <header class="rapports-instructeur-entete historique">
        <span>Rapports Instructeur</span>
        <h3>📋 Historique des rapports</h3>
        <p>Les rapports sont classés du plus récent au plus ancien.</p>
      </header>

      <div class="rapports-instructeur-filtres" role="tablist" aria-label="Type de rapport">
        ${creerFiltreHistoriqueInstructeur("TEST", "🧠", "Tests", tests.length)}
        ${creerFiltreHistoriqueInstructeur("FORMATION", "🎓", "Formations", formations.length)}
      </div>

      <div class="rapports-instructeur-historique-liste">
        ${selection.length
          ? selection.map(creerCarteHistoriqueRapportInstructeur).join("")
          : `<div class="rapports-instructeur-vide">
              Aucun rapport ${typeHistoriqueInstructeur === "FORMATION" ? "Formation" : "Test"} enregistré pour le moment.
            </div>`}
      </div>
    </section>
  `;
  installerRetourRapportsInstructeur();
  document.querySelectorAll("[data-type-historique-instructeur]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      typeHistoriqueInstructeur = bouton.dataset.typeHistoriqueInstructeur;
      afficherHistoriqueRapportsInstructeur();
    });
  });
  document.querySelectorAll("[data-modifier-rapport-instructeur]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      const rapport = rapportsHistoriqueInstructeur.find(function (element) {
        return element.id === bouton.dataset.modifierRapportInstructeur;
      });
      if (rapport) afficherModificationRapportInstructeur(rapport);
    });
  });
  document.querySelectorAll("[data-supprimer-rapport-instructeur]").forEach(function (bouton) {
    bouton.addEventListener("click", supprimerRapportHistoriqueInstructeur);
  });
}

function creerFiltreHistoriqueInstructeur(type, icone, libelle, total) {
  const actif = typeHistoriqueInstructeur === type;
  return `
    <button
      type="button"
      role="tab"
      aria-selected="${actif}"
      class="rapport-instructeur-filtre ${actif ? "actif" : ""}"
      data-type-historique-instructeur="${type}"
    >
      <span>${icone}</span>
      <strong>${libelle}</strong>
      <b>${total}</b>
    </button>
  `;
}

function creerCarteHistoriqueRapportInstructeur(rapport) {
  const accepte = rapport.resultat === "ACCEPTE";
  return `
    <article class="rapport-instructeur-historique-carte ${accepte ? "accepte" : "refuse"}">
      <div class="rapport-instructeur-historique-entete">
        <div>
          <strong>${echapperRapportInstructeur(rapport.personneFormee || "Personne non renseignée")}</strong>
          <span>${echapperRapportInstructeur(rapport.matricule || "Matricule non renseigné")}</span>
        </div>
        <time>${echapperRapportInstructeur(rapport.date || "Date non renseignée")}</time>
        <b>${accepte ? "✓ Accepté" : "✕ Refusé"}${rapport.type === "TEST" ? " — " + Number(rapport.note || 0) + "/20" : ""}</b>
      </div>
      <div class="rapport-instructeur-historique-infos">
        <span><small>Instructeur</small>${echapperRapportInstructeur(rapport.auteur || "Non renseigné")}</span>
        <span><small>Steam ID</small>${echapperRapportInstructeur(rapport.steamId || "Non renseigné")}</span>
        <span><small>Discord ID</small>${echapperRapportInstructeur(rapport.discordId || "Non renseigné")}</span>
      </div>
      ${rapport.remarque ? `<p><strong>Remarque :</strong> ${echapperRapportInstructeur(rapport.remarque)}</p>` : ""}
      ${rapport.commentaire ? `<p><strong>Commentaire :</strong> ${echapperRapportInstructeur(rapport.commentaire)}</p>` : ""}
      ${rapportsInstructeurPeutAdministrer ? `
        <div class="rapport-instructeur-historique-actions">
          <button type="button" class="modifier" data-modifier-rapport-instructeur="${echapperRapportInstructeur(rapport.id)}">✎ Modifier</button>
          <button type="button" class="supprimer" data-supprimer-rapport-instructeur="${echapperRapportInstructeur(rapport.id)}">🗑 Supprimer</button>
        </div>` : ""}
    </article>
  `;
}

function afficherModificationRapportInstructeur(rapport) {
  definirModuleGdaActif("instructeur-modification-rapport");
  const workspace = document.getElementById("workspace");
  if (!workspace) return;
  const estTest = normaliserTypeRapportInstructeur(rapport.type) === "TEST";
  workspace.innerHTML = `
    <section class="rapports-instructeur-module">
      <button id="retourHistoriqueModificationRapport" class="retour-rapports-instructeur" type="button">← Retour à l’historique</button>
      <header class="rapports-instructeur-entete historique">
        <span>Administration Instructeur</span>
        <h3>✎ Modifier le rapport ${estTest ? "Test" : "Formation"}</h3>
        <p>La date d’envoi et l’auteur d’origine restent conservés.</p>
      </header>
      <form id="formulaireModificationRapportInstructeur" class="rapport-test-instructeur-formulaire">
        <input type="hidden" name="rapportId" value="${echapperRapportInstructeur(rapport.id)}">
        <div class="rapport-test-instructeur-grille">
          <label><span>Auteur d’origine</span><input type="text" value="${echapperRapportInstructeur(rapport.auteur)}" readonly></label>
          <label><span>Date du rapport *</span><input name="date" type="date" value="${dateRapportInstructeurEnISO(rapport.date)}" required></label>
          <label><span>Personne formée *</span><input name="personneFormee" type="text" value="${echapperRapportInstructeur(rapport.personneFormee)}" required></label>
          <label><span>Matricule *</span><input name="matricule" type="text" value="${echapperRapportInstructeur(rapport.matricule)}" required></label>
          <label><span>Steam ID</span><input name="steamId" type="text" value="${echapperRapportInstructeur(rapport.steamId)}"></label>
          <label><span>Discord ID</span><input name="discordId" type="text" inputmode="numeric" value="${echapperRapportInstructeur(rapport.discordId)}"></label>
          ${estTest ? `<label><span>Note sur 20 *</span><input name="note" type="number" min="0" max="20" step="0.5" value="${Number(rapport.note || 0)}" required></label>` : ""}
          <label class="large"><span>Remarque</span><textarea name="remarque" rows="4">${echapperRapportInstructeur(rapport.remarque || "")}</textarea></label>
          <label class="large"><span>Commentaire</span><textarea name="commentaire" rows="5">${echapperRapportInstructeur(rapport.commentaire || "")}</textarea></label>
        </div>
        <div id="retourModificationRapportInstructeur" class="rapport-test-retour" aria-live="polite"></div>
        <button class="rapport-test-enregistrer" type="submit">Enregistrer les modifications</button>
      </form>
    </section>
  `;
  document.getElementById("retourHistoriqueModificationRapport")
    ?.addEventListener("click", function () { ouvrirHistoriqueRapportsInstructeur(); });
  document.getElementById("formulaireModificationRapportInstructeur")
    ?.addEventListener("submit", enregistrerModificationRapportInstructeur);
}

async function enregistrerModificationRapportInstructeur(evenement) {
  evenement.preventDefault();
  const formulaire = evenement.currentTarget;
  if (!formulaire.reportValidity()) return;
  const bouton = formulaire.querySelector("button[type=submit]");
  const retour = document.getElementById("retourModificationRapportInstructeur");
  bouton.disabled = true;
  bouton.textContent = "Enregistrement…";
  try {
    const resultat = await requeteRapportInstructeur(
      "modifierRapportInstructeur",
      Object.fromEntries(new FormData(formulaire).entries()),
      "POST"
    );
    const position = rapportsHistoriqueInstructeur.findIndex(function (rapport) {
      return rapport.id === resultat.rapport.id;
    });
    if (position >= 0) rapportsHistoriqueInstructeur[position] = resultat.rapport;
    enregistrerCacheRapportsInstructeur();
    if (typeof cleCacheSuivisFormationInstructeur === "function") {
      localStorage.removeItem(cleCacheSuivisFormationInstructeur());
    }
    if (typeof afficherNotificationGDA === "function") {
      afficherNotificationGDA(resultat.message || "Rapport modifié.", "succes");
    }
    ouvrirHistoriqueRapportsInstructeur();
  } catch (erreur) {
    retour.textContent = erreur.message || "Modification impossible.";
    retour.className = "rapport-test-retour erreur";
    bouton.disabled = false;
    bouton.textContent = "Enregistrer les modifications";
  }
}

async function supprimerRapportHistoriqueInstructeur(evenement) {
  const bouton = evenement.currentTarget;
  const rapportId = bouton.dataset.supprimerRapportInstructeur;
  const rapport = rapportsHistoriqueInstructeur.find(function (element) {
    return element.id === rapportId;
  });
  if (!rapport || !window.confirm(
    "Supprimer définitivement le rapport concernant " + rapport.personneFormee + " ?"
  )) return;
  bouton.disabled = true;
  bouton.textContent = "Suppression…";
  try {
    const resultat = await requeteRapportInstructeur(
      "supprimerRapportInstructeur",
      { rapportId: rapportId },
      "POST"
    );
    rapportsHistoriqueInstructeur = rapportsHistoriqueInstructeur.filter(function (element) {
      return element.id !== rapportId;
    });
    enregistrerCacheRapportsInstructeur();
    if (typeof cleCacheSuivisFormationInstructeur === "function") {
      localStorage.removeItem(cleCacheSuivisFormationInstructeur());
    }
    afficherHistoriqueRapportsInstructeur();
    if (typeof afficherNotificationGDA === "function") {
      afficherNotificationGDA(resultat.message || "Rapport supprimé.", "succes");
    }
  } catch (erreur) {
    bouton.disabled = false;
    bouton.textContent = "🗑 Supprimer";
    if (typeof afficherNotificationGDA === "function") {
      afficherNotificationGDA(erreur.message || "Suppression impossible.", "erreur");
    }
  }
}

function dateRapportInstructeurEnISO(valeur) {
  const morceaux = String(valeur || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return morceaux ? morceaux[3] + "-" + morceaux[2] + "-" + morceaux[1] : "";
}

function trierRapportsHistoriqueInstructeur(rapports) {
  return rapports.slice().sort(function (a, b) {
    return dateRapportHistoriqueInstructeur(b.date) -
      dateRapportHistoriqueInstructeur(a.date);
  });
}

function dateRapportHistoriqueInstructeur(valeur) {
  const dateFrancaise = String(valeur || "").match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!dateFrancaise) return 0;
  return new Date(
    Number(dateFrancaise[3]),
    Number(dateFrancaise[2]) - 1,
    Number(dateFrancaise[1]),
    Number(dateFrancaise[4] || 0),
    Number(dateFrancaise[5] || 0),
    Number(dateFrancaise[6] || 0)
  ).getTime();
}

function normaliserTypeRapportInstructeur(valeur) {
  const texte = String(valeur || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (texte.includes("FORMATION")) return "FORMATION";
  if (texte.includes("TEST")) return "TEST";
  return "";
}

function creerRetourRapportsInstructeur() {
  return `<button id="retourAccueilRapportsInstructeur" class="retour-rapports-instructeur" type="button">← Retour aux rapports</button>`;
}

function installerRetourRapportsInstructeur() {
  const bouton = document.getElementById("retourAccueilRapportsInstructeur");
  if (bouton) bouton.addEventListener("click", ouvrirEspaceRapportsInstructeur);
}

function echapperRapportInstructeur(valeur) {
  return String(valeur === null || valeur === undefined ? "" : valeur)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
