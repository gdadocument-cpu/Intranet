let rapportsPersonnels = [];
let rapportPersonnelNom = "";
let rapportPersonnelGrade = "";
let rapportPersonnelEdition = null;
let rapportsPersonnelsChargement = false;
let rapportsPersonnelsCharges = false;

function ouvrirRapportsPersonnelsGDA() {
  definirModuleGdaActif("rapports-personnels");
  rapportPersonnelEdition = null;
  const zone = document.getElementById("workspace");
  if (!zone) return;

  if (rapportsPersonnelsCharges) {
    afficherRapportsPersonnelsGDA();
    chargerRapportsPersonnelsGDA(true);
    return;
  }

  if (!document.getElementById("rapportsPersonnelsModule")) {
    zone.innerHTML = `
      <section id="rapportsPersonnelsModule" class="rapports-personnels-module">
        <div class="rapports-personnels-message">Chargement de vos rapports…</div>
      </section>
    `;
  }
  chargerRapportsPersonnelsGDA(false);
}

async function chargerRapportsPersonnelsGDA(silencieux) {
  if (rapportsPersonnelsChargement) return;
  rapportsPersonnelsChargement = true;

  if (!silencieux) {
    const module = document.getElementById("rapportsPersonnelsModule");
    if (module) module.classList.add("rapports-personnels-chargement");
  }

  try {
    const reponse = await fetch(
      API_URL + "?action=recupererMesRapports" + (silencieux ? "&_=" + Date.now() : ""),
      { cache: "no-store" }
    );
    const resultat = await reponse.json();
    if (!resultat.success) {
      throw new Error(resultat.message || "Impossible de récupérer vos rapports.");
    }

    appliquerResultatRapportsPersonnelsGDA(resultat);
  } catch (erreur) {
    afficherErreurRapportsPersonnelsGDA(erreur.message);
  } finally {
    rapportsPersonnelsChargement = false;
  }
}

function appliquerResultatRapportsPersonnelsGDA(resultat) {
  rapportsPersonnels = Array.isArray(resultat.rapports)
    ? resultat.rapports
    : [];
  rapportPersonnelNom = resultat.nom ||
    sessionStorage.getItem("nomUtilisateur") || "";
  rapportPersonnelGrade = resultat.grade ||
    sessionStorage.getItem("gradeUtilisateur") || "";
  rapportsPersonnelsCharges = true;
  if (moduleGdaEstActif("rapports-personnels")) {
    afficherRapportsPersonnelsGDA();
  }

  if (resultat.message && moduleGdaEstActif("rapports-personnels")) {
    afficherNotificationGDA(resultat.message, "succes");
  }
}

function afficherRapportsPersonnelsGDA() {
  if (!moduleGdaEstActif("rapports-personnels")) return;
  const zone = document.getElementById("workspace");
  if (!zone) return;

  const rapportsTries = rapportsPersonnels.slice().sort(function (a, b) {
    return convertirDateHeureRapportPersonnel(b.dateEnvoi) -
      convertirDateHeureRapportPersonnel(a.dateEnvoi);
  });
  const enAttente = rapportsPersonnels.filter(function (rapport) {
    return normaliserStatutRapportPersonnel(rapport.statut) === "EN ATTENTE";
  }).length;

  zone.innerHTML = `
    <section id="rapportsPersonnelsModule" class="rapports-personnels-module">
      <header class="rapports-personnels-entete">
        <div>
          <span>Espace GDA</span>
          <h3>📝 Mes rapports</h3>
          <p>Vos rapports personnels et leur état de traitement.</p>
        </div>
        <div class="rapports-personnels-resume">
          <article><strong>${rapportsPersonnels.length}</strong><span>Total</span></article>
          <article><strong>${enAttente}</strong><span>En attente</span></article>
          <button id="rapportsPersonnelsActualiser" type="button">↻ Actualiser</button>
        </div>
      </header>

      <div class="rapports-personnels-colonnes">
        <section class="rapports-personnels-colonne rapports-personnels-formulaire-colonne">
          ${creerFormulaireRapportPersonnelGDA()}
        </section>

        <section class="rapports-personnels-colonne rapports-personnels-historique">
          <header>
            <div><span>Historique personnel</span><h4>Mes rapports envoyés</h4></div>
            <small>Du plus récent au plus ancien</small>
          </header>
          <div class="rapports-personnels-liste">
            ${rapportsTries.length
              ? rapportsTries.map(creerCarteRapportPersonnelGDA).join("")
              : `
                <div class="rapports-personnels-vide">
                  <span>🗂️</span>
                  <strong>Aucun rapport envoyé</strong>
                  <p>Votre premier rapport apparaîtra ici après son envoi.</p>
                </div>
              `}
          </div>
        </section>

      </div>
    </section>
  `;

  brancherRapportsPersonnelsGDA();
}

function creerCarteRapportPersonnelGDA(rapport) {
  const statut = normaliserStatutRapportPersonnel(rapport.statut);
  const modifiable = rapport.modifiable === true && statut === "EN ATTENTE";
  return `
    <article class="rapport-personnel-carte">
      <header>
        <div>
          <span>Rapport du</span>
          <strong>${echapperHTML(formaterDateHeureGDA(rapport.dateRapport, "Date inconnue"))}</strong>
        </div>
        <span class="rapport-personnel-statut ${classeStatutRapportPersonnel(statut)}">
          ${libelleStatutRapportPersonnel(statut)}
        </span>
      </header>

      <section class="rapport-personnel-contenu">
        <h5>Rapport</h5>
        <p>${formaterTexteRapportPersonnel(rapport.rapport)}</p>
      </section>
      ${rapport.commentaire
        ? `<section class="rapport-personnel-contenu secondaire"><h5>Commentaire</h5><p>${formaterTexteRapportPersonnel(rapport.commentaire)}</p></section>`
        : ""}
      ${rapport.conclusion
        ? `<section class="rapport-personnel-contenu conclusion"><h5>Conclusion</h5><p>${formaterTexteRapportPersonnel(rapport.conclusion)}</p></section>`
        : ""}

      <footer>
        <span>Envoyé le ${echapperHTML(formaterDateHeureGDA(rapport.dateEnvoi, "Non renseigné"))}</span>
        ${modifiable
          ? `
            <div>
              <button type="button" data-modifier-rapport-personnel="${Number(rapport.ligne)}" data-rapport-id="${echapperHTML(rapport.id)}">Modifier</button>
              <button class="supprimer" type="button" data-supprimer-rapport-personnel="${Number(rapport.ligne)}" data-rapport-id="${echapperHTML(rapport.id)}">Supprimer</button>
            </div>
          `
          : '<small>Modification verrouillée</small>'}
      </footer>
    </article>
  `;
}

function creerFormulaireRapportPersonnelGDA() {
  const rapport = rapportPersonnelEdition;
  return `
    <div class="rapports-personnels-formulaire-fixe">
      <header>
        <span>${rapport ? "Modification" : "Nouveau rapport"}</span>
        <h4>${rapport ? "Modifier mon rapport" : "Rédiger un rapport"}</h4>
        <p>La date et l’heure d’envoi sont enregistrées automatiquement.</p>
      </header>

      <div class="rapports-personnels-auteur">
        <span class="rapports-personnels-avatar">
          <img src="${echapperHTML(obtenirIconeRapportPersonnel(rapportPersonnelGrade))}" alt="" loading="lazy">
        </span>
        <div><strong>${echapperHTML(rapportPersonnelNom || "Utilisateur")}</strong><span>${echapperHTML(rapportPersonnelGrade || "Grade non renseigné")}</span></div>
      </div>

      <form id="rapportPersonnelFormulaire">
        <label>
          <span>Date du rapport</span>
          <input id="rapportPersonnelDate" type="date" lang="fr-FR" value="${echapperHTML(rapport ? dateRapportPersonnelVersISO(rapport.dateRapport) : dateAujourdhuiRapportPersonnel())}" required>
        </label>
        <label>
          <span>Rapport</span>
          <textarea id="rapportPersonnelTexte" maxlength="10000" placeholder="Rédigez votre rapport…" required>${echapperHTML(rapport ? rapport.rapport : "")}</textarea>
        </label>
        <label>
          <span>Commentaire</span>
          <textarea id="rapportPersonnelCommentaire" maxlength="5000" placeholder="Commentaire complémentaire…">${echapperHTML(rapport ? rapport.commentaire : "")}</textarea>
        </label>
        <label>
          <span>Conclusion</span>
          <textarea id="rapportPersonnelConclusion" maxlength="5000" placeholder="Conclusion du rapport…">${echapperHTML(rapport ? rapport.conclusion : "")}</textarea>
        </label>

        <div class="rapports-personnels-formulaire-actions">
          ${rapport ? '<button id="rapportPersonnelAnnuler" class="secondaire" type="button">Annuler</button>' : ""}
          <button id="rapportPersonnelEnvoyer" type="submit">
            ${rapport ? "Enregistrer les modifications" : "Envoyer le rapport"}
          </button>
        </div>
        <p id="rapportPersonnelMessage" role="status"></p>
      </form>
    </div>
  `;
}

function brancherRapportsPersonnelsGDA() {
  const actualiser = document.getElementById("rapportsPersonnelsActualiser");
  if (actualiser) {
    actualiser.addEventListener("click", function () {
      chargerRapportsPersonnelsGDA(true);
    });
  }

  const formulaire = document.getElementById("rapportPersonnelFormulaire");
  if (formulaire) formulaire.addEventListener("submit", envoyerRapportPersonnelGDA);

  const annuler = document.getElementById("rapportPersonnelAnnuler");
  if (annuler) {
    annuler.addEventListener("click", function () {
      rapportPersonnelEdition = null;
      afficherRapportsPersonnelsGDA();
    });
  }

  document.querySelectorAll("[data-modifier-rapport-personnel]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      const ligne = Number(bouton.dataset.modifierRapportPersonnel);
      const id = bouton.dataset.rapportId;
      rapportPersonnelEdition = rapportsPersonnels.find(function (rapport) {
        return Number(rapport.ligne) === ligne && rapport.id === id;
      }) || null;
      afficherRapportsPersonnelsGDA();
      const formulaireEdition = document.querySelector(".rapports-personnels-formulaire-colonne");
      if (formulaireEdition) formulaireEdition.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll("[data-supprimer-rapport-personnel]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      supprimerRapportPersonnelGDA(
        Number(bouton.dataset.supprimerRapportPersonnel),
        bouton.dataset.rapportId,
        bouton
      );
    });
  });
}

async function envoyerRapportPersonnelGDA(event) {
  event.preventDefault();
  const bouton = document.getElementById("rapportPersonnelEnvoyer");
  const message = document.getElementById("rapportPersonnelMessage");
  const edition = rapportPersonnelEdition;
  const donnees = new URLSearchParams({
    identifiant: sessionStorage.getItem("identifiantUtilisateur") || "",
    dateRapport: document.getElementById("rapportPersonnelDate").value,
    rapport: document.getElementById("rapportPersonnelTexte").value.trim(),
    commentaire: document.getElementById("rapportPersonnelCommentaire").value.trim(),
    conclusion: document.getElementById("rapportPersonnelConclusion").value.trim()
  });
  if (edition) {
    donnees.set("ligne", String(edition.ligne));
    donnees.set("rapportId", edition.id);
  }

  bouton.disabled = true;
  bouton.textContent = edition ? "Enregistrement…" : "Envoi…";
  message.textContent = "";

  try {
    const action = edition ? "modifierMonRapport" : "ajouterMonRapport";
    const reponse = await fetch(API_URL + "?action=" + action, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: donnees.toString()
    });
    const resultat = await reponse.json();
    if (!resultat.success) throw new Error(resultat.message || "Enregistrement impossible.");

    rapportPersonnelEdition = null;
    appliquerResultatRapportsPersonnelsGDA(resultat);
  } catch (erreur) {
    message.textContent = erreur.message || "Enregistrement impossible.";
    message.className = "erreur";
    bouton.disabled = false;
    bouton.textContent = edition ? "Enregistrer les modifications" : "Envoyer le rapport";
  }
}

async function supprimerRapportPersonnelGDA(ligne, rapportId, bouton) {
  if (!window.confirm("Supprimer définitivement ce rapport en attente ?")) return;
  bouton.disabled = true;

  try {
    const donnees = new URLSearchParams({
      identifiant: sessionStorage.getItem("identifiantUtilisateur") || "",
      ligne: String(ligne),
      rapportId: rapportId
    });
    const reponse = await fetch(API_URL + "?action=supprimerMonRapport", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: donnees.toString()
    });
    const resultat = await reponse.json();
    if (!resultat.success) throw new Error(resultat.message || "Suppression impossible.");
    rapportPersonnelEdition = null;
    appliquerResultatRapportsPersonnelsGDA(resultat);
  } catch (erreur) {
    afficherNotificationGDA(erreur.message || "Suppression impossible.", "erreur");
    bouton.disabled = false;
    chargerRapportsPersonnelsGDA(true);
  }
}

function afficherErreurRapportsPersonnelsGDA(message) {
  if (!moduleGdaEstActif("rapports-personnels")) return;
  if (rapportsPersonnelsCharges) {
    afficherNotificationGDA(
      message || "Actualisation des rapports impossible.",
      "erreur"
    );
    return;
  }
  const zone = document.getElementById("workspace");
  if (!zone) return;
  zone.innerHTML = `
    <section id="rapportsPersonnelsModule" class="rapports-personnels-module">
      <div class="rapports-personnels-message erreur">${echapperHTML(message || "Rapports indisponibles.")}</div>
    </section>
  `;
}

function normaliserStatutRapportPersonnel(statut) {
  const valeur = String(statut || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/-/g, " ").trim();
  if (valeur === "LU" || valeur === "VALIDE") return "LU";
  if (valeur === "ARCHIVE") return "ARCHIVE";
  return "EN ATTENTE";
}

function libelleStatutRapportPersonnel(statut) {
  if (statut === "LU") return "✓ Lu et validé";
  if (statut === "ARCHIVE") return "▣ Archivé";
  return "⌛ En attente";
}

function classeStatutRapportPersonnel(statut) {
  if (statut === "LU") return "lu";
  if (statut === "ARCHIVE") return "archive";
  return "attente";
}

function formaterTexteRapportPersonnel(texte) {
  return echapperHTML(texte || "").replace(/\r?\n/g, "<br>");
}

function dateAujourdhuiRapportPersonnel() {
  const date = new Date();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + mois + "-" + jour;
}

function dateRapportPersonnelVersISO(date) {
  const correspondance = String(date || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return correspondance
    ? correspondance[3] + "-" + correspondance[2] + "-" + correspondance[1]
    : dateAujourdhuiRapportPersonnel();
}

function convertirDateHeureRapportPersonnel(date) {
  const correspondance = String(date || "").match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!correspondance) return 0;
  return new Date(
    Number(correspondance[3]),
    Number(correspondance[2]) - 1,
    Number(correspondance[1]),
    Number(correspondance[4] || 0),
    Number(correspondance[5] || 0),
    Number(correspondance[6] || 0)
  ).getTime();
}

function obtenirIconeRapportPersonnel(grade) {
  return typeof obtenirIconeGradeEffectif === "function"
    ? obtenirIconeGradeEffectif(grade)
    : "images/logo.png";
}

window.ouvrirRapportsPersonnelsGDA = ouvrirRapportsPersonnelsGDA;
