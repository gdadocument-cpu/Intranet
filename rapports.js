const rapportsButton =
  document.getElementById("rapportsButton");

const rapportsWorkspace =
  document.getElementById("workspace");

const RAPPORTS_API_URL = API_URL;

let rapportsRegistre = [];
let rapportsMembres = [];
let rechercheRapport = "";
let formulaireRapportOuvert = false;
let categorieRapportsActive = "EN ATTENTE";
let rapportsPeutValider = false;
let rapportsPeutArchiver = false;
let rapportsPeutSupprimer = false;
let rapportsCharges = false;

rapportsButton.addEventListener(
  "click",
  function () {
    definirModuleGdaActif("rapports-officier");
    if (rapportsCharges) {
      afficherRapports();
    } else {
      chargerRapports(false);
    }
  }
);

async function chargerRapports(silencieux) {
  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";

  if (
    !silencieux &&
    !(typeof gdaReponseEnCache === "function" && gdaReponseEnCache("recupererRapports"))
  ) {
    rapportsWorkspace.innerHTML = `
      <section id="rapportsModule">
        <div class="rapports-message">
          Chargement des rapports...
        </div>
      </section>
    `;
  }

  if (!identifiant) {
    afficherErreurRapports(
      "Votre session n’est plus valide. Rechargez la page et reconnectez-vous."
    );
    return;
  }

  try {
    const url =
      RAPPORTS_API_URL +
      "?action=recupererRapports" +
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
      afficherErreurRapports(
        resultat.message ||
        "Impossible de récupérer les rapports."
      );
      return;
    }

    rapportsRegistre =
      Array.isArray(resultat.rapports)
        ? resultat.rapports
        : [];

    rapportsMembres =
      Array.isArray(resultat.membres)
        ? resultat.membres
        : [];
    rapportsPeutValider =
      resultat.peutValider === true;
    rapportsPeutArchiver =
      resultat.peutArchiver === true;
    rapportsPeutSupprimer =
      resultat.peutSupprimer === true;
    rapportsCharges = true;

    afficherRapports();
  } catch (erreur) {
    console.error(erreur);
    afficherErreurRapports(
      erreur.message || "Impossible de contacter le serveur GDA."
    );
  }
}

function afficherRapports() {
  if (!moduleGdaEstActif("rapports-officier")) return;
  rapportsWorkspace.innerHTML = `
    <section id="rapportsModule">
      <header class="rapports-header">
        <div>
          <h3>📝 RAPPORTS</h3>
          <p>
            Boîte de réception, validation et archivage des rapports
          </p>
        </div>

        <div class="rapports-header-actions">
          <button
            id="rapportsActualiser"
            class="rapports-bouton-secondaire"
            type="button"
          >
            ↻ Actualiser
          </button>

        </div>
      </header>

      <section class="rapports-resume">
        <article class="rapports-indicateur">
          <span>Total enregistré</span>
          <strong id="rapportsTotalEnregistres">${rapportsRegistre.length}</strong>
        </article>

        <article class="rapports-indicateur">
          <span>Rapports lus et validés</span>
          <strong id="rapportsTotalLus">${compterRapportsStatut("LU")}</strong>
        </article>

        <article class="rapports-indicateur">
          <span>Résultats affichés</span>
          <strong id="rapportsTotalFiltres">0</strong>
        </article>
      </section>

      <nav class="rapports-categories" aria-label="Catégories des rapports">
        ${creerBoutonCategorieRapports(
          "EN ATTENTE",
          "⏳",
          "Rapports en attente"
        )}
        ${creerBoutonCategorieRapports(
          "LU",
          "✓",
          "Lus et validés"
        )}
        ${creerBoutonCategorieRapports(
          "ARCHIVE",
          "▣",
          "Rapports archivés"
        )}
      </nav>

      ${categorieRapportsActive === "LU" &&
        rapportsPeutArchiver &&
        compterRapportsStatut("LU") > 0
        ? `
          <section class="rapports-actions-categorie">
            <div>
              <strong>Traitement groupé</strong>
              <span>
                Archiver les ${compterRapportsStatut("LU")} rapports lus et validés
              </span>
            </div>
            <button
              id="rapportsToutArchiver"
              type="button"
            >
              ▣ Tout archiver
            </button>
          </section>
        `
        : ""}

      <section class="rapports-barre-recherche">
        <label for="rapportsRecherche">
          Rechercher les rapports d’une personne
        </label>

        <div class="rapports-recherche-zone">
          <span aria-hidden="true">⌕</span>
          <input
            id="rapportsRecherche"
            type="search"
            value="${echapperHTMLRapports(rechercheRapport)}"
            placeholder="Saisir un matricule..."
            autocomplete="off"
          >
        </div>
      </section>

      <section id="rapportsListe"></section>
    </section>
  `;

  brancherEvenementsRapports();
  afficherListeRapports();
}

function compterRapportsStatut(statut) {
  return rapportsRegistre.filter(function (rapport) {
    return normaliserStatutRapportClient(
      rapport.statut
    ) === statut;
  }).length;
}

function creerBoutonCategorieRapports(
  statut,
  icone,
  libelle
) {
  const actif =
    categorieRapportsActive === statut;

  return `
    <button
      class="rapports-categorie${actif ? " active" : ""}"
      type="button"
      data-rapport-categorie="${statut}"
      aria-pressed="${actif}"
    >
      <span aria-hidden="true">${icone}</span>
      <strong>${echapperHTMLRapports(libelle)}</strong>
      <em>${compterRapportsStatut(statut)}</em>
    </button>
  `;
}

function creerFormulaireRapport() {
  const membres = [...rapportsMembres]
    .sort(function (a, b) {
      const rangA =
        obtenirRangGradeRapports(
          a.grade
        );

      const rangB =
        obtenirRangGradeRapports(
          b.grade
        );

      if (rangA !== rangB) {
        return rangA - rangB;
      }

      return String(a.nom || "")
        .localeCompare(
          String(b.nom || ""),
          "fr"
        );
    });

  const options = membres
    .map(function (membre) {
      return `
        <option value="${echapperHTMLRapports(membre.nom)}">
          ${echapperHTMLRapports(membre.grade)}
          — ${echapperHTMLRapports(membre.nom)}
        </option>
      `;
    })
    .join("");

  return `
    <section class="rapports-formulaire-bloc">
      <div class="rapports-bloc-titre">
        <div>
          <h4>Poster un nouveau rapport</h4>
          <p>
            La date et l’heure d’envoi seront enregistrées automatiquement.
          </p>
        </div>
      </div>

      <form id="rapportsFormulaire" class="rapports-formulaire">
        <label class="rapports-champ">
          <span>Personne ayant fourni le rapport</span>
          <select id="rapportPersonne" required>
            <option value="">Sélectionner une personne</option>
            ${options}
          </select>
        </label>

        <label class="rapports-champ">
          <span>Date du rapport</span>
          <input
            id="rapportDate"
            type="date"
            lang="fr-FR"
            value="${obtenirDateRapportAujourdhui()}"
            required
          >
        </label>

        <label class="rapports-champ rapports-champ-large">
          <span>Rapport</span>
          <textarea
            id="rapportTexte"
            maxlength="10000"
            placeholder="Rédigez le contenu du rapport..."
            required
          ></textarea>
        </label>

        <label class="rapports-champ rapports-champ-large">
          <span>Commentaire</span>
          <textarea
            id="rapportCommentaire"
            maxlength="5000"
            placeholder="Commentaire complémentaire (facultatif)..."
          ></textarea>
        </label>

        <label class="rapports-champ rapports-champ-large">
          <span>Conclusion</span>
          <textarea
            id="rapportConclusion"
            maxlength="5000"
            placeholder="Conclusion du rapport (facultative)..."
          ></textarea>
        </label>

        <div class="rapports-formulaire-actions">
          <button
            id="rapportEnvoyer"
            class="rapports-bouton-principal"
            type="submit"
          >
            Enregistrer le rapport
          </button>
        </div>
      </form>
    </section>
  `;
}

function brancherEvenementsRapports() {
  document
    .querySelectorAll("[data-rapport-categorie]")
    .forEach(function (bouton) {
      bouton.addEventListener("click", function () {
        categorieRapportsActive =
          bouton.dataset.rapportCategorie;
        afficherRapports();
      });
    });

  const toutArchiver = document.getElementById(
    "rapportsToutArchiver"
  );
  if (toutArchiver) {
    toutArchiver.addEventListener(
      "click",
      function () {
        archiverTousRapportsLus(toutArchiver);
      }
    );
  }

  const actualiser =
    document.getElementById(
      "rapportsActualiser"
    );

  if (actualiser) {
    actualiser.addEventListener(
      "click",
      function () {
        if (typeof gdaForcerActualisation === "function") {
          gdaForcerActualisation("recupererRapports");
        }
        chargerRapports(true);
      }
    );
  }

  const nouveau =
    document.getElementById(
      "rapportsNouveau"
    );

  if (nouveau) {
    nouveau.addEventListener(
      "click",
      function () {
        formulaireRapportOuvert =
          !formulaireRapportOuvert;
        afficherRapports();
      }
    );
  }

  const recherche =
    document.getElementById(
      "rapportsRecherche"
    );

  if (recherche) {
    recherche.addEventListener(
      "input",
      function () {
        rechercheRapport =
          recherche.value;
        afficherListeRapports();
      }
    );
  }

  const formulaire =
    document.getElementById(
      "rapportsFormulaire"
    );

  if (formulaire) {
    formulaire.addEventListener(
      "submit",
      envoyerNouveauRapport
    );
  }
}

function afficherListeRapports() {
  const zone =
    document.getElementById(
      "rapportsListe"
    );

  if (!zone) return;

  const recherche =
    normaliserTexteRapports(
      rechercheRapport
    );

  const rapports = [...rapportsRegistre]
    .filter(function (rapport) {
      if (
        normaliserStatutRapportClient(
          rapport.statut
        ) !== categorieRapportsActive
      ) {
        return false;
      }

      if (!recherche) return true;
      return normaliserTexteRapports(
        rapport.nom
      ).includes(recherche);
    })
    .sort(trierRapportsRecents);

  const compteur =
    document.getElementById(
      "rapportsTotalFiltres"
    );

  if (compteur) {
    compteur.textContent =
      String(rapports.length);
  }

  if (!rapports.length) {
    zone.innerHTML = `
      <div class="rapports-vide">
        <strong>Aucun rapport dans cette catégorie</strong>
        <span>
          Modifiez la recherche ou postez un nouveau rapport.
        </span>
      </div>
    `;
    return;
  }

  zone.innerHTML = `
    <div class="rapports-liste-entete">
      <h4>${obtenirLibelleCategorieRapports()}</h4>
      <span>Du plus récent au plus ancien</span>
    </div>

    <div class="rapports-liste">
      ${rapports.map(creerCarteRapport).join("")}
    </div>
  `;

  brancherActionsStatutRapports();
}

function creerCarteRapport(rapport) {
  const iconeGrade = obtenirIconeGradeRapport(
    rapport.grade
  );

  return `
    <article class="rapport-carte">
      <header class="rapport-carte-header">
        <div class="rapport-identite">
          <span class="rapport-avatar">
            <img
              src="${iconeGrade}"
              alt="Insigne ${echapperHTMLRapports(
                rapport.grade || "grade inconnu"
              )}"
              loading="lazy"
            >
          </span>
          <div>
            <strong>${echapperHTMLRapports(rapport.nom)}</strong>
            <span>${echapperHTMLRapports(rapport.grade || "Grade non renseigné")}</span>
          </div>
        </div>

        <div class="rapport-dates">
          ${creerBadgeStatutRapport(rapport.statut)}
          <strong>
            Rapport du ${formaterDateRapport(rapport.dateRapport)}
          </strong>
          <span>
            Envoyé le ${formaterDateHeureRapport(rapport.dateEnvoi)}
          </span>
        </div>
      </header>

      <section class="rapport-contenu">
        <h5>Rapport</h5>
        <p>${formaterTexteRapport(rapport.rapport)}</p>
      </section>

      ${rapport.commentaire
        ? `
          <section class="rapport-contenu rapport-commentaire">
            <h5>Commentaire</h5>
            <p>${formaterTexteRapport(rapport.commentaire)}</p>
          </section>
        `
        : ""}

      ${rapport.conclusion
        ? `
          <section class="rapport-contenu rapport-conclusion">
            <h5>Conclusion</h5>
            <p>${formaterTexteRapport(rapport.conclusion)}</p>
          </section>
        `
        : ""}

      ${creerPiedCarteRapport(rapport)}
    </article>
  `;
}

function creerBadgeStatutRapport(statut) {
  const normalise =
    normaliserStatutRapportClient(statut);
  const libelles = {
    "EN ATTENTE": "En attente",
    LU: "Lu et validé",
    ARCHIVE: "Archivé"
  };

  return `
    <span class="rapport-statut rapport-statut-${normalise.toLowerCase().replace(/ /g, "-")}">
      ${echapperHTMLRapports(libelles[normalise])}
    </span>
  `;
}

function creerPiedCarteRapport(rapport) {
  const statut =
    normaliserStatutRapportClient(rapport.statut);
  let action = "";
  let libelle = "";

  if (statut === "EN ATTENTE") {
    action = "LU";
    libelle = "✓ Valider comme lu";
  } else if (statut === "LU") {
    action = "ARCHIVE";
    libelle = "▣ Archiver";
  } else if (statut === "ARCHIVE") {
    action = "LU";
    libelle = "↩ Restaurer dans les lus et validés";
  }

  const peutEffectuerAction =
    statut === "EN ATTENTE"
      ? rapportsPeutValider
      : rapportsPeutArchiver;

  return `
    <footer class="rapport-carte-pied">
      <span>
        ${rapport.traitePar
          ? `Dernière action par ${echapperHTMLRapports(rapport.traitePar)}${rapport.dateTraitement
              ? ` le ${formaterDateHeureRapport(rapport.dateTraitement)}`
              : ""}`
          : "Aucune validation effectuée"}
      </span>

      ${peutEffectuerAction || rapportsPeutSupprimer
        ? `
          <div class="rapport-carte-actions">
            ${peutEffectuerAction && action
              ? `
                <button
                  type="button"
                  data-rapport-ligne="${Number(rapport.ligne)}"
                  data-rapport-id="${echapperHTMLRapports(rapport.id || "")}"
                  data-rapport-statut="${action}"
                >
                  ${libelle}
                </button>
              `
              : ""}

            ${rapportsPeutSupprimer
              ? `
                <button
                  class="rapport-supprimer"
                  type="button"
                  data-rapport-supprimer="${Number(rapport.ligne)}"
                  data-rapport-id="${echapperHTMLRapports(rapport.id || "")}"
                >
                  🗑 Supprimer
                </button>
              `
              : ""}
          </div>
        `
        : ""}
    </footer>
  `;
}

function obtenirIconeGradeRapport(grade) {
  const gradeNormalise =
    normaliserTexteRapports(grade)
      .replace(/\./g, "")
      .replace(/_/g, "-")
      .replace(/[’']/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

  const alias = {
    CPL: "caporal",
    CAPORAL: "caporal",
    "CPL-C": "caporal-chef",
    "CAPORAL-CHEF": "caporal-chef",
    SGT: "sergent",
    SERGENT: "sergent",
    "SGT-C": "sergent-chef",
    "SERGENT-CHEF": "sergent-chef",
    ADJ: "adjudant",
    ADJUDANT: "adjudant",
    "ADJ-C": "adjudant-chef",
    "ADJUDANT-CHEF": "adjudant-chef",
    MJR: "major",
    MAJOR: "major",
    ASP: "aspirant",
    ASPIRANT: "aspirant",
    "S-LTN": "sous-lieutenant",
    "SOUS-LIEUTENANT": "sous-lieutenant",
    LTN: "lieutenant",
    LIEUTENANT: "lieutenant",
    CPT: "capitaine",
    CAPITAINE: "capitaine",
    "V-CMD": "vice-commandant",
    "VICE-COMMANDANT": "vice-commandant",
    CMD: "commandant",
    COMMANDANT: "commandant",
    "LTN-CLN": "lieutenant-colonel",
    "LIEUTENANT-COLONEL": "lieutenant-colonel"
  };

  const fichier = alias[gradeNormalise];

  return fichier
    ? `images/grades/${fichier}.png`
    : "images/logo.png";
}

async function envoyerNouveauRapport(
  evenement
) {
  evenement.preventDefault();

  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";

  const personne =
    document.getElementById(
      "rapportPersonne"
    ).value.trim();

  const dateRapport =
    document.getElementById(
      "rapportDate"
    ).value;

  const rapport =
    document.getElementById(
      "rapportTexte"
    ).value.trim();

  const commentaire =
    document.getElementById(
      "rapportCommentaire"
    ).value.trim();

  const conclusion =
    document.getElementById(
      "rapportConclusion"
    ).value.trim();

  if (!personne || !dateRapport || !rapport) {
    window.alert(
      "La personne, la date et le rapport sont obligatoires."
    );
    return;
  }

  const bouton =
    document.getElementById(
      "rapportEnvoyer"
    );

  bouton.disabled = true;
  bouton.textContent =
    "Enregistrement...";

  try {
    const url =
      RAPPORTS_API_URL +
      "?action=ajouterRapport" +
      "&identifiant=" +
      encodeURIComponent(identifiant) +
      "&personne=" +
      encodeURIComponent(personne) +
      "&dateRapport=" +
      encodeURIComponent(dateRapport) +
      "&rapport=" +
      encodeURIComponent(rapport) +
      "&commentaire=" +
      encodeURIComponent(commentaire) +
      "&conclusion=" +
      encodeURIComponent(conclusion);

    const reponse = await fetch(url);
    const resultat = await reponse.json();

    if (!resultat.success) {
      throw new Error(
        resultat.message ||
        "Impossible d’enregistrer le rapport."
      );
    }

    synchroniserEffectifDepuisRapports(resultat);
    formulaireRapportOuvert = false;
    rapportsRegistre = Array.isArray(resultat.rapports)
      ? resultat.rapports
      : rapportsRegistre;
    rapportsCharges = true;
    afficherRapports();
    afficherNotificationGDA(
      resultat.message || "Rapport enregistré.",
      "succes"
    );
  } catch (erreur) {
    console.error(erreur);
    window.alert(
      erreur.message ||
      "Impossible de contacter le serveur GDA."
    );
    bouton.disabled = false;
    bouton.textContent =
      "Enregistrer le rapport";
  }
}

function brancherActionsStatutRapports() {
  document
    .querySelectorAll(
      "[data-rapport-ligne][data-rapport-statut]"
    )
    .forEach(function (bouton) {
      bouton.addEventListener("click", function () {
        changerStatutRapport(
          Number(bouton.dataset.rapportLigne),
          bouton.dataset.rapportId || "",
          bouton.dataset.rapportStatut,
          bouton
        );
      });
    });

  document
    .querySelectorAll("[data-rapport-supprimer]")
    .forEach(function (bouton) {
      bouton.addEventListener("click", function () {
        supprimerRapport(
          Number(bouton.dataset.rapportSupprimer),
          bouton.dataset.rapportId || "",
          bouton
        );
      });
    });
}

async function changerStatutRapport(
  ligne,
  rapportId,
  statut,
  bouton
) {
  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";

  bouton.disabled = true;
  const ancienTexte = bouton.textContent;
  bouton.textContent = "Mise à jour...";

  try {
    const url = RAPPORTS_API_URL +
      "?action=changerStatutRapport" +
      "&identifiant=" + encodeURIComponent(identifiant) +
      "&ligne=" + encodeURIComponent(ligne) +
      "&rapportId=" + encodeURIComponent(rapportId) +
      "&statut=" + encodeURIComponent(statut);
    const reponse = await fetch(url);
    const resultat = await reponse.json();

    if (!resultat.success) {
      throw new Error(
        resultat.message ||
        "Impossible de modifier le statut du rapport."
      );
    }

    synchroniserEffectifDepuisRapports(resultat);
    const rapport = rapportsRegistre.find(
      element => rapportId
        ? element.id === rapportId
        : Number(element.ligne) === Number(ligne)
    );
    if (rapport) {
      rapport.statut = resultat.statut || statut;
      rapport.traitePar =
        sessionStorage.getItem("nomUtilisateur") ||
        identifiant;
      rapport.dateTraitement =
        obtenirDateHeureRapportMaintenant();
    }

    rafraichirRapportsLocalement();
  } catch (erreur) {
    console.error(erreur);
    window.alert(erreur.message);
    bouton.disabled = false;
    bouton.textContent = ancienTexte;
  }
}

async function supprimerRapport(ligne, rapportId, bouton) {
  const rapport = rapportsRegistre.find(
    element => rapportId
      ? element.id === rapportId
      : Number(element.ligne) === Number(ligne)
  );
  const confirmation = window.confirm(
    "Supprimer définitivement ce rapport" +
    (rapport && rapport.nom
      ? " de " + rapport.nom
      : "") +
    " ?\n\nCette action supprimera aussi la ligne dans Rapport GDA et ne pourra pas être annulée."
  );
  if (!confirmation) return;

  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";
  const ancienTexte = bouton.textContent;
  bouton.disabled = true;
  bouton.textContent = "Suppression...";

  try {
    const url = RAPPORTS_API_URL +
      "?action=supprimerRapport" +
      "&identifiant=" + encodeURIComponent(identifiant) +
      "&ligne=" + encodeURIComponent(ligne) +
      "&rapportId=" + encodeURIComponent(rapportId);
    const reponse = await fetch(url);
    const resultat = await reponse.json();

    if (!resultat.success) {
      throw new Error(
        resultat.message ||
        "Impossible de supprimer le rapport."
      );
    }

    synchroniserEffectifDepuisRapports(resultat);
    const ligneSupprimee = Number(resultat.ligne || ligne);
    rapportsRegistre = rapportsRegistre
      .filter(
        element => rapportId
          ? element.id !== rapportId
          : Number(element.ligne) !== Number(ligne)
      )
      .map(function (element) {
        if (Number(element.ligne) > ligneSupprimee) {
          element.ligne = Number(element.ligne) - 1;
        }
        return element;
      });

    rafraichirRapportsLocalement();
  } catch (erreur) {
    console.error(erreur);
    window.alert(erreur.message);
    bouton.disabled = false;
    bouton.textContent = ancienTexte;
  }
}

async function archiverTousRapportsLus(bouton) {
  const total = compterRapportsStatut("LU");
  if (!total) return;

  const confirmation = window.confirm(
    "Archiver les " + total +
    " rapports lus et validés ?\n\n" +
    "Ils resteront consultables dans la catégorie Archivés."
  );
  if (!confirmation) return;

  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";
  const ancienTexte = bouton.textContent;
  bouton.disabled = true;
  bouton.textContent = "Archivage en cours...";

  try {
    const url = RAPPORTS_API_URL +
      "?action=archiverTousRapportsLus" +
      "&identifiant=" + encodeURIComponent(identifiant);
    const reponse = await fetch(url);
    const resultat = await reponse.json();

    if (!resultat.success) {
      throw new Error(
        resultat.message ||
        "Impossible d’archiver les rapports."
      );
    }

    synchroniserEffectifDepuisRapports(resultat);
    const auteur =
      sessionStorage.getItem("nomUtilisateur") ||
      identifiant;
    const dateTraitement =
      obtenirDateHeureRapportMaintenant();

    rapportsRegistre.forEach(function (rapport) {
      if (
        normaliserStatutRapportClient(rapport.statut) ===
        "LU"
      ) {
        rapport.statut = "ARCHIVE";
        rapport.traitePar = auteur;
        rapport.dateTraitement = dateTraitement;
      }
    });

    rafraichirRapportsLocalement();
  } catch (erreur) {
    console.error(erreur);
    window.alert(erreur.message);
    bouton.disabled = false;
    bouton.textContent = ancienTexte;
  }
}

function synchroniserEffectifDepuisRapports(resultat) {
  if (
    Array.isArray(resultat && resultat.effectif) &&
    typeof synchroniserCacheEffectifGDA === "function"
  ) {
    synchroniserCacheEffectifGDA(resultat.effectif);
  }
}

function rafraichirRapportsLocalement() {
  document
    .querySelectorAll("[data-rapport-categorie]")
    .forEach(function (bouton) {
      const statut = bouton.dataset.rapportCategorie;
      const compteur = bouton.querySelector("em");
      if (compteur) {
        compteur.textContent = String(
          compterRapportsStatut(statut)
        );
      }
    });

  const totalLus = document.getElementById(
    "rapportsTotalLus"
  );
  if (totalLus) {
    totalLus.textContent = String(
      compterRapportsStatut("LU")
    );
  }

  const totalEnregistres = document.getElementById(
    "rapportsTotalEnregistres"
  );
  if (totalEnregistres) {
    totalEnregistres.textContent = String(
      rapportsRegistre.length
    );
  }

  const actionGroupee = document.querySelector(
    ".rapports-actions-categorie"
  );
  if (
    actionGroupee &&
    compterRapportsStatut("LU") === 0
  ) {
    actionGroupee.remove();
  } else if (actionGroupee) {
    const description = actionGroupee.querySelector(
      "div span"
    );
    if (description) {
      description.textContent =
        "Archiver les " +
        compterRapportsStatut("LU") +
        " rapports lus et validés";
    }
  }

  afficherListeRapports();
}

function obtenirDateHeureRapportMaintenant() {
  const date = new Date();
  const deuxChiffres = valeur =>
    String(valeur).padStart(2, "0");

  return date.getFullYear() + "-" +
    deuxChiffres(date.getMonth() + 1) + "-" +
    deuxChiffres(date.getDate()) + "T" +
    deuxChiffres(date.getHours()) + ":" +
    deuxChiffres(date.getMinutes()) + ":" +
    deuxChiffres(date.getSeconds());
}

function normaliserStatutRapportClient(statut) {
  const normalise =
    normaliserTexteRapports(statut)
      .replace(/-/g, " ");

  if (
    normalise === "EN ATTENTE" ||
    normalise === "ATTENTE"
  ) return "EN ATTENTE";

  if (
    normalise === "LU" ||
    normalise === "LUS" ||
    normalise === "VALIDE"
  ) return "LU";

  if (
    normalise === "ARCHIVE" ||
    normalise === "ARCHIVES"
  ) return "ARCHIVE";

  return "EN ATTENTE";
}

function obtenirLibelleCategorieRapports() {
  const libelles = {
    "EN ATTENTE": "Rapports en attente",
    LU: "Rapports lus et validés",
    ARCHIVE: "Rapports archivés"
  };

  return libelles[categorieRapportsActive] ||
    "Rapports";
}

function trierRapportsRecents(a, b) {
  const envoiA =
    convertirDateHeureRapport(
      a.dateEnvoi
    );

  const envoiB =
    convertirDateHeureRapport(
      b.dateEnvoi
    );

  if (envoiA && envoiB) {
    return envoiB - envoiA;
  }

  const dateA =
    convertirDateRapport(
      a.dateRapport
    );

  const dateB =
    convertirDateRapport(
      b.dateRapport
    );

  if (dateA && dateB) {
    return dateB - dateA;
  }

  return Number(b.ligne || 0) -
    Number(a.ligne || 0);
}

function compterAuteursRapports() {
  return new Set(
    rapportsRegistre
      .map(r => normaliserTexteRapports(r.nom))
      .filter(Boolean)
  ).size;
}

function convertirDateRapport(texte) {
  const match = String(texte || "")
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  date.setHours(0, 0, 0, 0);
  return date;
}

function convertirDateHeureRapport(texte) {
  const match = String(texte || "")
    .match(
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

function formaterDateRapport(texte) {
  return formaterDateHeureGDA(texte, "Non renseignée");
}

function formaterDateHeureRapport(texte) {
  return formaterDateHeureGDA(texte, "Non renseigné");
}

function obtenirDateRapportAujourdhui() {
  const date = new Date();
  const annee = date.getFullYear();
  const mois = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const jour = String(
    date.getDate()
  ).padStart(2, "0");
  return annee + "-" + mois + "-" + jour;
}

function normaliserTexteRapports(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function obtenirRangGradeRapports(grade) {
  const ordreGrades = [
    "LIEUTENANT-COLONEL",
    "COMMANDANT",
    "VICE-COMMANDANT",
    "CAPITAINE",
    "LIEUTENANT",
    "SOUS-LIEUTENANT",
    "ASPIRANT",
    "MAJOR",
    "ADJUDANT-CHEF",
    "ADJUDANT",
    "SERGENT-CHEF",
    "SERGENT",
    "CAPORAL-CHEF",
    "CAPORAL",
    "ANCIEN GDA"
  ];

  const position = ordreGrades.indexOf(
    normaliserTexteRapports(grade)
  );

  return position === -1
    ? 999
    : position;
}

function echapperHTMLRapports(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formaterTexteRapport(texte) {
  return echapperHTMLRapports(texte)
    .replace(/\n/g, "<br>");
}

function afficherErreurRapports(message) {
  if (!moduleGdaEstActif("rapports-officier")) return;
  rapportsWorkspace.innerHTML = `
    <section id="rapportsModule">
      <div class="rapports-message rapports-message-erreur">
        ${echapperHTMLRapports(message)}
      </div>
    </section>
  `;
}
