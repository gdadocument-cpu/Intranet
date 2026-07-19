const gestionPersonnelButton =
  document.getElementById(
    "gestionPersonnelButton"
  );

const gestionPersonnelWorkspace =
  document.getElementById("workspace");

const GESTION_PERSONNEL_API_URL = API_URL;

let gestionMembres = [];
let gestionLogs = [];
let gestionGrades = [];
let gestionSanctions = [];
let gestionDureesBlacklist = [];
let gestionMedailles = [];
let gestionVue = "action";
let gestionRecherche = "";
let gestionFiltreType = "";
let gestionPersonnelChargee = false;
let gestionPeutModifierHistorique = false;
let gestionPeutSupprimerHistorique = false;
let gestionLogEnEdition = null;

gestionPersonnelButton.addEventListener(
  "click",
  function () {
    if (gestionPersonnelChargee) {
      afficherGestionPersonnel();
    } else {
      chargerGestionPersonnel();
    }
  }
);

async function chargerGestionPersonnel() {
  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";

  if (!(typeof gdaReponseEnCache === "function" && gdaReponseEnCache("recupererGestionPersonnel"))) {
    gestionPersonnelWorkspace.innerHTML = `
      <section id="gestionPersonnelModule">
        <div class="gestion-message">
          Chargement de la gestion du personnel...
        </div>
      </section>
    `;
  }

  if (!identifiant) {
    afficherErreurGestion(
      "Votre session n’est plus valide. Rechargez la page et reconnectez-vous."
    );
    return;
  }

  try {
    const url =
      GESTION_PERSONNEL_API_URL +
      "?action=recupererGestionPersonnel" +
      "&hierarchie=3" +
      "&identifiant=" +
      encodeURIComponent(identifiant);

    const reponse = await fetch(url);
    if (!reponse.ok) {
      throw new Error(
        "Erreur serveur : " + reponse.status
      );
    }

    const resultat = await reponse.json();
    if (!resultat.success) {
      afficherErreurGestion(
        resultat.message ||
        "Impossible de récupérer les données du personnel."
      );
      return;
    }

    appliquerDonneesGestionPersonnel(resultat, true);

    afficherGestionPersonnel();
  } catch (erreur) {
    console.error(erreur);
    afficherErreurGestion(
      erreur.message || "Impossible de contacter le serveur GDA."
    );
  }
}

function appliquerDonneesGestionPersonnel(resultat, complet) {
  if (Array.isArray(resultat.membres)) {
    gestionMembres = resultat.membres;
  }
  if (Array.isArray(resultat.logs)) {
    gestionLogs = resultat.logs;
  }
  if (complet && Array.isArray(resultat.grades)) {
    gestionGrades = resultat.grades;
  }
  if (complet && Array.isArray(resultat.sanctions)) {
    gestionSanctions = resultat.sanctions;
  }
  if (complet && Array.isArray(resultat.dureesBlacklist)) {
    gestionDureesBlacklist = resultat.dureesBlacklist;
  }
  if (complet && Array.isArray(resultat.medailles)) {
    gestionMedailles = resultat.medailles;
  }
  if (typeof resultat.peutModifierHistorique === "boolean") {
    gestionPeutModifierHistorique = resultat.peutModifierHistorique;
  }
  if (typeof resultat.peutSupprimerHistorique === "boolean") {
    gestionPeutSupprimerHistorique = resultat.peutSupprimerHistorique;
  }
  gestionPersonnelChargee = true;
}

function afficherGestionPersonnel() {
  gestionPersonnelWorkspace.innerHTML = `
    <section id="gestionPersonnelModule">
      <header class="gestion-header">
        <div>
          <h3>👥 GESTION DU PERSONNEL</h3>
          <p>
            Promotions, rétrogradations, sanctions, départs et médailles
          </p>
        </div>

        <button
          id="gestionActualiser"
          class="gestion-bouton-secondaire"
          type="button"
        >
          ↻ Actualiser
        </button>
      </header>

      <nav class="gestion-onglets" aria-label="Gestion du personnel">
        <button
          class="gestion-onglet ${gestionVue === "action" ? "actif" : ""}"
          data-vue="action"
          type="button"
        >
          ＋ Nouvelle action
        </button>

        <button
          class="gestion-onglet ${gestionVue === "historique" ? "actif" : ""}"
          data-vue="historique"
          type="button"
        >
          ◷ Historique
          <span>${gestionLogs.length}</span>
        </button>
      </nav>

      <div id="gestionContenu">
        ${gestionVue === "historique"
          ? creerHistoriqueGestion()
          : creerFormulaireGestion()}
      </div>
    </section>
  `;

  brancherEvenementsGestion();

  if (gestionVue === "historique") {
    afficherListeHistoriqueGestion();
  }
}

function creerFormulaireGestion() {
  const membres = [...gestionMembres]
    .sort(trierMembresGestion);

  const options = membres.map(membre => `
    <option value="${echapperHTMLGestion(membre.nom)}">
      ${echapperHTMLGestion(membre.grade)}
      — ${echapperHTMLGestion(membre.nom)}
    </option>
  `).join("");

  const auteur =
    sessionStorage.getItem(
      "nomUtilisateur"
    ) ||
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) ||
    "Non renseigné";

  return `
    <section class="gestion-action-bloc">
      <div class="gestion-bloc-titre">
        <h4>Enregistrer une action administrative</h4>
        <p>
          Les modifications seront appliquées à l’effectif et enregistrées dans les logs.
        </p>
      </div>

      <form id="gestionFormulaire" class="gestion-formulaire">
        <label class="gestion-champ">
          <span>Personne concernée</span>
          <select id="gestionPersonne" required>
            <option value="">Sélectionner une personne</option>
            ${options}
          </select>
        </label>

        <div id="gestionFicheMembre" class="gestion-fiche-vide">
          Sélectionnez une personne pour afficher sa fiche.
        </div>

        <label class="gestion-champ">
          <span>Action à effectuer</span>
          <select id="gestionType" required disabled>
            <option value="">Sélectionner une action</option>
            <option value="Promotion">Promotion</option>
            <option value="Rétrogradation">Rétrogradation</option>
            <option value="Sanction">Sanction</option>
            <option value="Départ">Départ</option>
            <option value="Licenciement">Licenciement</option>
            <option value="Blacklist">Blacklist</option>
            <option value="Médaille">Médaille</option>
          </select>
        </label>

        <div id="gestionChoixZone" class="gestion-choix-zone gestion-cache"></div>

        <label class="gestion-champ gestion-champ-large">
          <span>Raison</span>
          <textarea
            id="gestionRaison"
            maxlength="2000"
            placeholder="Expliquez précisément la raison de cette action..."
            required
          ></textarea>
        </label>

        <label class="gestion-champ">
          <span>Rempli par</span>
          <input
            type="text"
            value="${echapperHTMLGestion(auteur)}"
            readonly
          >
        </label>

        <div class="gestion-formulaire-actions">
          <button
            id="gestionValider"
            class="gestion-bouton-principal"
            type="submit"
            disabled
          >
            Enregistrer l’action
          </button>
        </div>
      </form>
    </section>
  `;
}

function creerHistoriqueGestion() {
  return `
    <section class="gestion-historique">
      <div class="gestion-filtres">
        <label class="gestion-champ">
          <span>Rechercher une personne</span>
          <input
            id="gestionRecherche"
            type="search"
            value="${echapperHTMLGestion(gestionRecherche)}"
            placeholder="Saisir un matricule..."
            autocomplete="off"
          >
        </label>

        <label class="gestion-champ">
          <span>Filtrer par type</span>
          <select id="gestionFiltreType">
            <option value="">Toutes les actions</option>
            ${[
              "Promotion",
              "Rétrogradation",
              "Sanction",
              "Départ",
              "Licenciement",
              "Blacklist",
              "Médaille"
            ].map(type => `
              <option
                value="${type}"
                ${gestionFiltreType === type ? "selected" : ""}
              >${type}</option>
            `).join("")}
          </select>
        </label>

        <div class="gestion-resultat-compteur">
          <span>Résultats</span>
          <strong id="gestionNombreResultats">0</strong>
        </div>
      </div>

      <div id="gestionHistoriqueListe"></div>

      ${gestionPeutModifierHistorique ? `
        <dialog id="gestionEditionLog" class="gestion-dialogue-log">
          <form id="gestionEditionLogFormulaire" class="gestion-formulaire-log">
            <header>
              <div>
                <h4>Modifier une ligne de l’historique</h4>
                <p>Cette correction modifie uniquement la feuille Logs.</p>
              </div>
              <button id="gestionFermerEditionLog" type="button" aria-label="Fermer">×</button>
            </header>

            <div class="gestion-formulaire-log-grille">
              <label class="gestion-champ">
                <span>Date et heure</span>
                <input id="gestionLogDate" type="datetime-local" step="1" required>
              </label>
              <label class="gestion-champ">
                <span>Personne concernée</span>
                <input id="gestionLogPersonne" type="text" maxlength="120" required>
              </label>
              <label class="gestion-champ">
                <span>Grade au moment de l’action</span>
                <select id="gestionLogGrade" required>
                  ${gestionGrades.map(grade => `
                    <option value="${echapperHTMLGestion(grade)}">${echapperHTMLGestion(grade)}</option>
                  `).join("")}
                </select>
              </label>
              <label class="gestion-champ">
                <span>Type d’action</span>
                <select id="gestionLogType" required>
                  ${["Promotion", "Rétrogradation", "Sanction", "Départ", "Licenciement", "Blacklist", "Médaille"].map(type => `
                    <option value="${type}">${type}</option>
                  `).join("")}
                </select>
              </label>
              <label class="gestion-champ gestion-champ-large">
                <span>Décision</span>
                <input id="gestionLogChoix" type="text" maxlength="500" required>
              </label>
              <label class="gestion-champ gestion-champ-large">
                <span>Raison</span>
                <textarea id="gestionLogRaison" maxlength="2000" required></textarea>
              </label>
              <label class="gestion-champ gestion-champ-large">
                <span>Rempli par</span>
                <input id="gestionLogAuteur" type="text" maxlength="120" required>
              </label>
            </div>

            <div class="gestion-dialogue-actions">
              <button id="gestionAnnulerEditionLog" class="gestion-bouton-secondaire" type="button">Annuler</button>
              <button id="gestionEnregistrerEditionLog" class="gestion-bouton-principal" type="submit">Enregistrer</button>
            </div>
          </form>
        </dialog>
      ` : ""}
    </section>
  `;
}

function brancherEvenementsGestion() {
  document
    .querySelectorAll(".gestion-onglet")
    .forEach(function (bouton) {
      bouton.addEventListener(
        "click",
        function () {
          gestionVue = bouton.dataset.vue;
          afficherGestionPersonnel();
        }
      );
    });

  const actualiser =
    document.getElementById(
      "gestionActualiser"
    );
  if (actualiser) {
    actualiser.addEventListener(
      "click",
      function() {
        if (typeof gdaForcerActualisation === "function") {
          gdaForcerActualisation("recupererGestionPersonnel");
        }
        chargerGestionPersonnel();
      }
    );
  }

  if (gestionVue === "historique") {
    brancherHistoriqueGestion();
    return;
  }

  const personne =
    document.getElementById(
      "gestionPersonne"
    );
  const type =
    document.getElementById(
      "gestionType"
    );
  const formulaire =
    document.getElementById(
      "gestionFormulaire"
    );

  personne.addEventListener(
    "change",
    function () {
      afficherFicheMembreGestion();
      type.disabled = !personne.value;
      type.value = "";
      afficherChoixGestion();
    }
  );

  type.addEventListener(
    "change",
    afficherChoixGestion
  );

  formulaire.addEventListener(
    "submit",
    envoyerActionGestion
  );
}

function brancherHistoriqueGestion() {
  const recherche =
    document.getElementById(
      "gestionRecherche"
    );
  const type =
    document.getElementById(
      "gestionFiltreType"
    );

  recherche.addEventListener(
    "input",
    function () {
      gestionRecherche = recherche.value;
      afficherListeHistoriqueGestion();
    }
  );

  type.addEventListener(
    "change",
    function () {
      gestionFiltreType = type.value;
      afficherListeHistoriqueGestion();
    }
  );

  const dialogue = document.getElementById("gestionEditionLog");
  if (dialogue) {
    document
      .getElementById("gestionEditionLogFormulaire")
      .addEventListener("submit", enregistrerEditionLogGestion);
    document
      .getElementById("gestionFermerEditionLog")
      .addEventListener("click", fermerEditionLogGestion);
    document
      .getElementById("gestionAnnulerEditionLog")
      .addEventListener("click", fermerEditionLogGestion);
    dialogue.addEventListener("cancel", function (event) {
      event.preventDefault();
      fermerEditionLogGestion();
    });
  }
}

function trouverMembreGestion() {
  const selection =
    document.getElementById(
      "gestionPersonne"
    );
  if (!selection) return null;
  const cible = normaliserTexteGestion(
    selection.value
  );
  return gestionMembres.find(
    membre =>
      normaliserTexteGestion(membre.nom) === cible
  ) || null;
}

function afficherFicheMembreGestion() {
  const zone =
    document.getElementById(
      "gestionFicheMembre"
    );
  const membre = trouverMembreGestion();

  if (!membre) {
    zone.className = "gestion-fiche-vide";
    zone.textContent =
      "Sélectionnez une personne pour afficher sa fiche.";
    return;
  }

  const medailles =
    Array.isArray(membre.medailles)
      ? membre.medailles
      : [];

  zone.className = "gestion-fiche-membre";
  zone.innerHTML = `
    <div>
      <span>Grade actuel</span>
      <strong>${echapperHTMLGestion(membre.grade)}</strong>
    </div>
    <div>
      <span>Sanctions</span>
      <strong>${echapperHTMLGestion(membre.sanction || "Aucune")}</strong>
    </div>
    <div class="gestion-fiche-large">
      <span>Médailles déjà obtenues</span>
      <div class="gestion-medailles-actuelles">
        ${medailles.length
          ? medailles.map(m => `<em>${echapperHTMLGestion(m)}</em>`).join("")
          : "<em>Aucune médaille</em>"}
      </div>
    </div>
  `;
}

function formaterDateISOGestion(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function obtenirDatesDepartGestionParDefaut() {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(debut.getTime());
  fin.setDate(fin.getDate() + 7);
  return {
    debut: formaterDateISOGestion(debut),
    fin: formaterDateISOGestion(fin)
  };
}

function afficherChoixGestion() {
  const zone =
    document.getElementById(
      "gestionChoixZone"
    );
  const type =
    document.getElementById(
      "gestionType"
    ).value;
  const membre = trouverMembreGestion();
  const valider =
    document.getElementById(
      "gestionValider"
    );

  zone.innerHTML = "";
  zone.classList.add("gestion-cache");
  valider.disabled = true;

  if (!membre || !type) return;

  let valeurs = [];
  let libelle = "";

  if (type === "Promotion") {
    const rang = obtenirRangGradeGestion(
      membre.grade
    );
    valeurs = rang > 0
      ? gestionGrades.slice(0, rang)
      : [];
    libelle = "Nouveau grade supérieur";
  } else if (type === "Rétrogradation") {
    const rang = obtenirRangGradeGestion(
      membre.grade
    );
    valeurs = rang >= 0
      ? gestionGrades.slice(rang + 1)
      : [];
    libelle = "Nouveau grade inférieur";
  } else if (type === "Sanction") {
    valeurs = [...gestionSanctions];
    libelle = "Sanction à appliquer";
  } else if (type === "Médaille") {
    const possedees =
      Array.isArray(membre.medailles)
        ? membre.medailles
        : [];
    valeurs = gestionMedailles.filter(
      medaille => !possedees.some(
        actuelle =>
          cleMedailleGestion(actuelle) ===
          cleMedailleGestion(medaille)
      )
    );
    libelle = "Médaille à attribuer";
  } else if (type === "Départ" || type === "Licenciement") {
    const datesDepart = obtenirDatesDepartGestionParDefaut();
    zone.classList.remove("gestion-cache");
    zone.innerHTML = `
      <div class="gestion-dates-depart">
        <label class="gestion-champ">
          <span>Date de départ</span>
          <input id="gestionDateDepart" type="date" value="${datesDepart.debut}" required>
        </label>
        <label class="gestion-champ">
          <span>Date de retour</span>
          <input id="gestionDateRetour" type="date" value="${datesDepart.fin}" required>
        </label>
      </div>
      <div class="gestion-alerte-depart">
        🚪 Le ${type.toLowerCase()} sera ajouté automatiquement dans la feuille
        <strong>Départ GDA</strong> avec le grade, les identifiants,
        les médailles, les dates et l’auteur de l’enregistrement.
      </div>
    `;
    const champDepart = document.getElementById("gestionDateDepart");
    const champRetour = document.getElementById("gestionDateRetour");
    champDepart.addEventListener("change", function() {
      const debut = new Date(champDepart.value + "T00:00:00");
      if (Number.isNaN(debut.getTime())) return;
      debut.setDate(debut.getDate() + 7);
      champRetour.value = formaterDateISOGestion(debut);
      champRetour.min = champRetour.value;
    });
    champRetour.min = datesDepart.fin;
    valider.disabled = false;
    return;
  } else if (type === "Blacklist") {
    valeurs = gestionDureesBlacklist.length
      ? [...gestionDureesBlacklist]
      : ["1 semaine", "2 semaines", "3 semaines", "1 mois", "2 mois", "3 mois", "6 mois", "Permanent"];
    libelle = "Durée de la blacklist";
  }

  zone.classList.remove("gestion-cache");

  if (!valeurs.length) {
    zone.innerHTML = `
      <div class="gestion-aucun-choix">
        Aucune possibilité disponible pour cette action.
      </div>
    `;
    return;
  }

  zone.innerHTML = `
    <label class="gestion-champ">
      <span>${libelle}</span>
      <select id="gestionChoix" required>
        <option value="">Sélectionner une possibilité</option>
        ${valeurs.map(valeur => `
          <option value="${echapperHTMLGestion(valeur)}">
            ${echapperHTMLGestion(valeur)}
          </option>
        `).join("")}
      </select>
    </label>
  `;

  document
    .getElementById("gestionChoix")
    .addEventListener(
      "change",
      function (event) {
        valider.disabled = !event.target.value;
      }
    );
}

async function envoyerActionGestion(
  evenement
) {
  evenement.preventDefault();

  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";
  const personne =
    document.getElementById(
      "gestionPersonne"
    ).value;
  const type =
    document.getElementById(
      "gestionType"
    ).value;
  const choixElement =
    document.getElementById(
      "gestionChoix"
    );
  const choix = choixElement
    ? choixElement.value
    : "";
  const raison =
    document.getElementById(
      "gestionRaison"
    ).value.trim();
  const dateDepartElement = document.getElementById("gestionDateDepart");
  const dateRetourElement = document.getElementById("gestionDateRetour");
  const dateDepart = dateDepartElement ? dateDepartElement.value : "";
  const dateRetour = dateRetourElement ? dateRetourElement.value : "";

  if (!personne || !type || !raison) {
    window.alert(
      "La personne, l’action et la raison sont obligatoires."
    );
    return;
  }

  const estSortieAvecRetour = type === "Départ" || type === "Licenciement";

  if (!estSortieAvecRetour && !choix) {
    window.alert(
      "Sélectionnez une possibilité."
    );
    return;
  }

  if (estSortieAvecRetour && (!dateDepart || !dateRetour)) {
    window.alert("La date de départ et la date de retour sont obligatoires.");
    return;
  }

  if (estSortieAvecRetour) {
    const retourMinimum = new Date(dateDepart + "T00:00:00");
    retourMinimum.setDate(retourMinimum.getDate() + 7);
    if (dateRetour < formaterDateISOGestion(retourMinimum)) {
      window.alert("La date de retour doit être située au moins 7 jours après la date de départ.");
      return;
    }
  }

  const confirmation = window.confirm(
    "Confirmer l’action « " +
    type +
    " » pour " +
    personne +
    " ?"
  );
  if (!confirmation) return;

  const bouton =
    document.getElementById(
      "gestionValider"
    );
  bouton.disabled = true;
  bouton.textContent = "Enregistrement...";

  try {
    const url =
      GESTION_PERSONNEL_API_URL +
      "?action=appliquerGestionPersonnel" +
      "&identifiant=" +
      encodeURIComponent(identifiant) +
      "&personne=" +
      encodeURIComponent(personne) +
      "&type=" +
      encodeURIComponent(type) +
      "&choix=" +
      encodeURIComponent(choix) +
      "&dateDepart=" +
      encodeURIComponent(dateDepart) +
      "&dateRetour=" +
      encodeURIComponent(dateRetour) +
      "&raison=" +
      encodeURIComponent(raison);

    const reponse = await fetch(url);
    const resultat = await reponse.json();
    if (!resultat.success) {
      throw new Error(
        resultat.message ||
        "Impossible d’enregistrer l’action."
      );
    }

    appliquerDonneesGestionPersonnel(resultat, false);
    if (typeof synchroniserCacheEffectifGDA === "function") {
      synchroniserCacheEffectifGDA(resultat.effectif);
    }
    if (typeof appliquerDonneesDeparts === "function") {
      appliquerDonneesDeparts(resultat, false);
    }
    afficherGestionPersonnel();
    afficherNotificationGDA(
      resultat.message || "Action enregistrée.",
      "succes"
    );
  } catch (erreur) {
    console.error(erreur);
    window.alert(
      erreur.message ||
      "Impossible de contacter le serveur GDA."
    );
    bouton.disabled = false;
    bouton.textContent = "Enregistrer l’action";
  }
}

function afficherListeHistoriqueGestion() {
  const zone =
    document.getElementById(
      "gestionHistoriqueListe"
    );
  if (!zone) return;

  const recherche =
    normaliserTexteGestion(
      gestionRecherche
    );
  const filtre =
    normaliserTexteGestion(
      gestionFiltreType
    );

  const logs = [...gestionLogs]
    .filter(function (log) {
      const correspondNom =
        !recherche ||
        normaliserTexteGestion(
          log.personne
        ).includes(recherche);
      const correspondType =
        !filtre ||
        normaliserTypeHistoriqueGestion(
          log.type
        ) ===
        normaliserTypeHistoriqueGestion(
          gestionFiltreType
        );
      return correspondNom && correspondType;
    })
    .sort(function (a, b) {
      const dateA = convertirDateHeureGestion(a.date);
      const dateB = convertirDateHeureGestion(b.date);
      if (dateA && dateB) return dateB - dateA;
      return Number(b.ligne || 0) - Number(a.ligne || 0);
    });

  const compteur =
    document.getElementById(
      "gestionNombreResultats"
    );
  if (compteur) compteur.textContent = logs.length;

  if (!logs.length) {
    zone.innerHTML = `
      <div class="gestion-vide">
        Aucun événement ne correspond aux filtres.
      </div>
    `;
    return;
  }

  zone.innerHTML = `
    <div class="gestion-logs-liste">
      ${logs.map(creerCarteLogGestion).join("")}
    </div>
  `;
  brancherActionsHistoriqueGestion();
}

function creerCarteLogGestion(log) {
  const typeAffiche =
    libelleTypeHistoriqueGestion(
      log.type
    );

  const classe =
    "gestion-log-" +
    normaliserTypeHistoriqueGestion(
      log.type
    )
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

  const actions = [
    gestionPeutModifierHistorique
      ? `<button class="gestion-log-action" type="button" data-modifier-log="${Number(log.ligne)}">✎ Modifier</button>`
      : "",
    gestionPeutSupprimerHistorique
      ? `<button class="gestion-log-action gestion-log-supprimer" type="button" data-supprimer-log="${Number(log.ligne)}">🗑 Supprimer</button>`
      : ""
  ].filter(Boolean).join("");

  return `
    <article class="gestion-log ${classe}">
      <header>
        <div>
          <span class="gestion-log-type">
            ${iconeTypeGestion(typeAffiche)}
            ${echapperHTMLGestion(typeAffiche)}
          </span>
          <strong>${echapperHTMLGestion(log.personne)}</strong>
          <em>${echapperHTMLGestion(log.grade || "Grade non renseigné")}</em>
        </div>
        <div class="gestion-log-entete-droite">
          <time>${formaterDateHeureGestion(log.date)}</time>
          ${actions ? `<div class="gestion-log-actions">${actions}</div>` : ""}
        </div>
      </header>

      <div class="gestion-log-details">
        <div>
          <span>Décision</span>
          <strong>${echapperHTMLGestion(log.choix || "Non renseignée")}</strong>
        </div>
        <div>
          <span>Rempli par</span>
          <strong>${echapperHTMLGestion(log.auteur || "Non renseigné")}</strong>
        </div>
        <div class="gestion-log-raison">
          <span>Raison</span>
          <p>${formaterTexteGestion(log.raison)}</p>
        </div>
      </div>
    </article>
  `;
}

function brancherActionsHistoriqueGestion() {
  document.querySelectorAll("[data-modifier-log]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      ouvrirEditionLogGestion(Number(bouton.dataset.modifierLog));
    });
  });

  document.querySelectorAll("[data-supprimer-log]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      supprimerLogGestion(Number(bouton.dataset.supprimerLog), bouton);
    });
  });
}

function ouvrirEditionLogGestion(ligne) {
  const log = gestionLogs.find(function (entree) {
    return Number(entree.ligne) === Number(ligne);
  });
  const dialogue = document.getElementById("gestionEditionLog");
  if (!log || !dialogue) return;

  gestionLogEnEdition = log;
  document.getElementById("gestionLogDate").value = String(log.date || "").slice(0, 19);
  document.getElementById("gestionLogPersonne").value = log.personne || "";
  document.getElementById("gestionLogGrade").value = log.grade || "";
  document.getElementById("gestionLogType").value = libelleTypeHistoriqueGestion(log.type);
  document.getElementById("gestionLogChoix").value = log.choix || "";
  document.getElementById("gestionLogRaison").value = log.raison || "";
  document.getElementById("gestionLogAuteur").value = log.auteur || "";
  dialogue.showModal();
}

function fermerEditionLogGestion() {
  const dialogue = document.getElementById("gestionEditionLog");
  gestionLogEnEdition = null;
  if (dialogue && dialogue.open) dialogue.close();
}

async function enregistrerEditionLogGestion(event) {
  event.preventDefault();
  if (!gestionLogEnEdition) return;

  const bouton = document.getElementById("gestionEnregistrerEditionLog");
  bouton.disabled = true;
  bouton.textContent = "Enregistrement...";

  try {
    await envoyerMutationHistoriqueGestion("modifierLogGestionPersonnel", {
      ligne: gestionLogEnEdition.ligne,
      date: document.getElementById("gestionLogDate").value,
      personne: document.getElementById("gestionLogPersonne").value.trim(),
      grade: document.getElementById("gestionLogGrade").value,
      type: document.getElementById("gestionLogType").value,
      choix: document.getElementById("gestionLogChoix").value.trim(),
      raison: document.getElementById("gestionLogRaison").value.trim(),
      auteur: document.getElementById("gestionLogAuteur").value.trim()
    });
    fermerEditionLogGestion();
    afficherListeHistoriqueGestion();
  } catch (erreur) {
    window.alert(erreur.message || "Impossible de modifier cette ligne.");
  } finally {
    bouton.disabled = false;
    bouton.textContent = "Enregistrer";
  }
}

async function supprimerLogGestion(ligne, bouton) {
  const log = gestionLogs.find(function (entree) {
    return Number(entree.ligne) === Number(ligne);
  });
  if (!log) return;
  if (!window.confirm(
    "Supprimer définitivement la ligne « " +
    libelleTypeHistoriqueGestion(log.type) + " — " + log.personne + " » ?"
  )) return;

  bouton.disabled = true;
  try {
    await envoyerMutationHistoriqueGestion("supprimerLogGestionPersonnel", {
      ligne: ligne
    });
    afficherListeHistoriqueGestion();
  } catch (erreur) {
    window.alert(erreur.message || "Impossible de supprimer cette ligne.");
    bouton.disabled = false;
  }
}

async function envoyerMutationHistoriqueGestion(action, donnees) {
  const parametres = new URLSearchParams({
    action: action,
    identifiant: sessionStorage.getItem("identifiantUtilisateur") || ""
  });
  Object.keys(donnees || {}).forEach(function (cle) {
    parametres.set(cle, donnees[cle] == null ? "" : String(donnees[cle]));
  });

  const reponse = await fetch(
    GESTION_PERSONNEL_API_URL + "?" + parametres.toString()
  );
  const resultat = await reponse.json();
  if (!resultat.success) {
    throw new Error(resultat.message || "Modification de l’historique refusée.");
  }
  appliquerDonneesGestionPersonnel(resultat, false);
  afficherNotificationGDA(resultat.message || "Historique mis à jour.", "succes");
  return resultat;
}

function trierMembresGestion(a, b) {
  const rangA = obtenirRangGradeGestion(a.grade);
  const rangB = obtenirRangGradeGestion(b.grade);
  if (rangA !== rangB) return rangA - rangB;
  return String(a.nom || "")
    .localeCompare(String(b.nom || ""), "fr");
}

function obtenirRangGradeGestion(grade) {
  const cible = normaliserTexteGestion(grade);
  const position = gestionGrades.findIndex(
    valeur => normaliserTexteGestion(valeur) === cible
  );
  return position === -1 ? 999 : position;
}

function convertirDateHeureGestion(texte) {
  const match = String(texte || "").match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/
  );
  if (!match) return null;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6])
  );
}

function formaterDateHeureGestion(texte) {
  return formaterDateHeureGDA(texte, "Date non renseignée");
}

function iconeTypeGestion(type) {
  const n =
    normaliserTypeHistoriqueGestion(type);
  if (n === "PROMOTION") return "⬆";
  if (n === "RETROGRADATION") return "⬇";
  if (n === "SANCTION") return "⚠";
  if (n === "DEPART") return "🚪";
  if (n === "MEDAILLE") return "🏅";
  return "•";
}

function normaliserTypeHistoriqueGestion(type) {
  const n = normaliserTexteGestion(type);

  if (
    n === "PROMO" ||
    n === "PROMOTION" ||
    n.startsWith("PROMO ")
  ) {
    return "PROMOTION";
  }

  if (
    n === "RETRO" ||
    n === "RETROGRADATION" ||
    n.startsWith("RETRO ")
  ) {
    return "RETROGRADATION";
  }

  if (n.includes("SANCTION")) {
    return "SANCTION";
  }

  if (n.includes("DEPART")) {
    return "DEPART";
  }

  if (n.includes("LICENCIEMENT")) {
    return "LICENCIEMENT";
  }

  if (n.includes("BLACKLIST") || n.startsWith("BL ")) {
    return "BLACKLIST";
  }

  if (n.includes("MEDAILLE")) {
    return "MEDAILLE";
  }

  return n;
}

function libelleTypeHistoriqueGestion(type) {
  const n =
    normaliserTypeHistoriqueGestion(type);

  if (n === "PROMOTION") return "Promotion";
  if (n === "RETROGRADATION") {
    return "Rétrogradation";
  }
  if (n === "SANCTION") return "Sanction";
  if (n === "DEPART") return "Départ";
  if (n === "LICENCIEMENT") return "Licenciement";
  if (n === "BLACKLIST") return "Blacklist";
  if (n === "MEDAILLE") return "Médaille";

  return String(type || "Non renseigné");
}

function normaliserTexteGestion(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function cleMedailleGestion(texte) {
  const normalise =
    normaliserTexteGestion(texte);
  if (
    normalise.includes("ANCIEN") &&
    normalise.includes("GERANT")
  ) {
    return "ANCIEN GERANT";
  }
  const categories = [
    "BRAVOURE",
    "MERITE",
    "ACTIVITE",
    "ANCIENNETE",
    "VETERAN",
    "DEFENSE",
    "MEDECIN",
    "GSPR",
    "INSTRUCTEUR",
    "HONNEUR"
  ];
  return categories.find(
    categorie => normalise.includes(categorie)
  ) || normalise;
}

function echapperHTMLGestion(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formaterTexteGestion(texte) {
  return echapperHTMLGestion(texte)
    .replace(/\n/g, "<br>");
}

function afficherErreurGestion(message) {
  gestionPersonnelWorkspace.innerHTML = `
    <section id="gestionPersonnelModule">
      <div class="gestion-message gestion-erreur">
        ${echapperHTMLGestion(message)}
      </div>
    </section>
  `;
}
