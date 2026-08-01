const rapportsButton =
  document.getElementById("rapportsButton");

const rapportsWorkspace =
  document.getElementById("workspace");

const RAPPORTS_API_URL = API_URL;

let rapportsRegistre = [];
let rapportsMembres = [];
let rechercheRapport = "";
let formulaireRapportOuvert = false;
let formulaireRapportDiscordOuvert = false;
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
          ${rapportsPeutValider
            ? `
              <button
                id="rapportsDiscord"
                class="rapports-bouton-discord"
                type="button"
                aria-expanded="${formulaireRapportDiscordOuvert}"
              >
                ${creerIconeDiscordRapports()}
                Rapport Discord
              </button>
            `
            : ""}
          <button
            id="rapportsActualiser"
            class="rapports-bouton-secondaire"
            type="button"
          >
            ↻ Actualiser
          </button>

        </div>
      </header>

      ${formulaireRapportDiscordOuvert
        ? creerFormulaireRapportDiscord()
        : ""}

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

function creerIconeDiscordRapports() {
  return `
    <svg
      class="rapports-icone-discord"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M19.6 5.3A17.4 17.4 0 0 0 15.4 4l-.5 1a15.7 15.7 0 0 0-5.8 0l-.5-1a17.4 17.4 0 0 0-4.2 1.3C1.7 9.3 1 13.2 1.4 17a17 17 0 0 0 5.1 2.6l1.2-1.7c-.7-.3-1.4-.7-2-1.2l.5-.4c3.8 1.8 7.9 1.8 11.6 0l.6.4c-.7.5-1.4.9-2.1 1.2l1.2 1.7a17 17 0 0 0 5.1-2.6c.5-4.4-.8-8.3-3-11.7ZM8.5 14.6c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm7 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z"/>
    </svg>
  `;
}

function creerFormulaireRapportDiscord() {
  const membres = [...rapportsMembres].sort(function (a, b) {
    const rangA = obtenirRangGradeRapports(
      a.gradeEffectifOfficier || a.grade
    );
    const rangB = obtenirRangGradeRapports(
      b.gradeEffectifOfficier || b.grade
    );
    if (rangA !== rangB) return rangA - rangB;
    return String(a.nom || "").localeCompare(String(b.nom || ""), "fr");
  });

  const options = membres.map(function (membre) {
    const gradeOfficier = membre.gradeEffectifOfficier || membre.grade || "Grade non renseigné";
    return `
      <button
        class="rapports-discord-personne-option"
        type="button"
        role="option"
        data-rapport-discord-personne="${echapperHTMLRapports(membre.nom)}"
        data-rapport-discord-libelle="${echapperHTMLRapports(gradeOfficier)} — ${echapperHTMLRapports(membre.nom)}"
      >
        <strong>${echapperHTMLRapports(gradeOfficier)}</strong>
        <span>— ${echapperHTMLRapports(membre.nom)}</span>
      </button>
    `;
  }).join("");

  return `
    <section class="rapports-formulaire-discord-bloc">
      <div class="rapports-discord-introduction">
        ${creerIconeDiscordRapports()}
        <div>
          <strong>Ajouter un rapport reçu sur Discord</strong>
          <span>Le grade GDA actuel sera enregistré et restera ensuite figé.</span>
        </div>
      </div>
      <form id="rapportsFormulaireDiscord" class="rapports-formulaire-discord">
        <div class="rapports-discord-personne-champ">
          <span class="rapports-label-visuel">GDA concerné</span>
          <input id="rapportDiscordPersonne" type="hidden" value="">
          <button
            id="rapportDiscordPersonneBouton"
            class="rapports-discord-personne-bouton"
            type="button"
            aria-haspopup="listbox"
            aria-expanded="false"
          >
            <span>Sélectionner un GDA</span>
            <em aria-hidden="true">⌄</em>
          </button>
          <div
            id="rapportDiscordPersonneListe"
            class="rapports-discord-personne-liste"
            role="listbox"
            hidden
          >
            ${options}
          </div>
        </div>
        <label class="rapports-discord-lien-champ">
          <span class="rapports-label-visuel">Lien du message</span>
          <input
            id="rapportDiscordLien"
            type="url"
            inputmode="url"
            maxlength="500"
            placeholder="Coller le lien du rapport Discord"
            autocomplete="off"
            required
          >
        </label>
        <button id="rapportDiscordEnvoyer" type="submit">
          Ajouter dans « Lus et validés »
        </button>
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

  const discord = document.getElementById("rapportsDiscord");
  if (discord) {
    discord.addEventListener("click", function () {
      formulaireRapportDiscordOuvert = !formulaireRapportDiscordOuvert;
      afficherRapports();
    });
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


  const formulaireDiscord = document.getElementById("rapportsFormulaireDiscord");
  if (formulaireDiscord) {
    formulaireDiscord.addEventListener("submit", envoyerRapportDiscord);
    brancherListePersonnesRapportDiscord();
  }
}

function brancherListePersonnesRapportDiscord() {
  const bouton = document.getElementById("rapportDiscordPersonneBouton");
  const liste = document.getElementById("rapportDiscordPersonneListe");
  const valeur = document.getElementById("rapportDiscordPersonne");
  if (!bouton || !liste || !valeur) return;

  function fermerListe() {
    liste.hidden = true;
    bouton.setAttribute("aria-expanded", "false");
  }

  bouton.addEventListener("click", function () {
    const doitOuvrir = liste.hidden;
    liste.hidden = !doitOuvrir;
    bouton.setAttribute("aria-expanded", String(doitOuvrir));
    if (doitOuvrir) {
      const premiereOption = liste.querySelector("[data-rapport-discord-personne]");
      if (premiereOption) premiereOption.focus();
    }
  });

  liste.querySelectorAll("[data-rapport-discord-personne]").forEach(function (option) {
    option.addEventListener("click", function () {
      valeur.value = option.dataset.rapportDiscordPersonne || "";
      bouton.querySelector("span").textContent =
        option.dataset.rapportDiscordLibelle || "Sélectionner un GDA";
      liste.querySelectorAll("[data-rapport-discord-personne]").forEach(function (element) {
        element.setAttribute("aria-selected", String(element === option));
      });
      fermerListe();
      bouton.focus();
    });
  });

  formulaireRapportDiscordFermerListe = fermerListe;
}

let formulaireRapportDiscordFermerListe = null;

document.addEventListener("click", function (evenement) {
  const champ = document.querySelector(".rapports-discord-personne-champ");
  if (
    champ &&
    !champ.contains(evenement.target) &&
    typeof formulaireRapportDiscordFermerListe === "function"
  ) {
    formulaireRapportDiscordFermerListe();
  }
});

document.addEventListener("keydown", function (evenement) {
  if (
    evenement.key === "Escape" &&
    typeof formulaireRapportDiscordFermerListe === "function"
  ) {
    formulaireRapportDiscordFermerListe();
  }
});

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

      ${creerContenuCarteRapport(rapport)}

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

function extraireLienRapportDiscord(texte) {
  const correspondance = String(texte || "").match(
    /^(?:\[RAPPORT DISCORD\]|Rapport Discord)\s*\n(https:\/\/discord\.com\/channels\/(?:\d+|@me)\/\d+\/\d+)\s*$/i
  );
  return correspondance ? correspondance[1] : "";
}

function creerContenuCarteRapport(rapport) {
  const lienDiscord = extraireLienRapportDiscord(rapport.rapport);
  if (!lienDiscord) {
    return `
      <section class="rapport-contenu">
        <h5>Rapport</h5>
        <p>${formaterTexteRapport(rapport.rapport)}</p>
      </section>
    `;
  }

  const lienSecurise = echapperHTMLRapports(lienDiscord);
  return `
    <section class="rapport-contenu rapport-contenu-discord">
      <h5>Rapport Discord</h5>
      <a
        class="rapport-discord-carte-lien"
        href="${lienSecurise}"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="rapport-discord-carte-icone">
          ${creerIconeDiscordRapports()}
        </span>
        <span>
          <strong>Ouvrir le message sur Discord</strong>
          <small>${lienSecurise}</small>
        </span>
        <span class="rapport-discord-carte-fleche" aria-hidden="true">↗</span>
      </a>
    </section>
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

async function envoyerRapportDiscord(evenement) {
  evenement.preventDefault();

  const identifiant = sessionStorage.getItem("identifiantUtilisateur") || "";
  const personne = document.getElementById("rapportDiscordPersonne").value.trim();
  const lienDiscord = document.getElementById("rapportDiscordLien").value.trim();
  const bouton = document.getElementById("rapportDiscordEnvoyer");

  if (!personne || !lienDiscord) {
    window.alert("Sélectionnez un GDA et collez le lien direct du message Discord.");
    return;
  }

  bouton.disabled = true;
  bouton.textContent = "Ajout en cours...";

  try {
    const url = RAPPORTS_API_URL +
      "?action=ajouterRapportDiscord" +
      "&identifiant=" + encodeURIComponent(identifiant) +
      "&personne=" + encodeURIComponent(personne) +
      "&lienDiscord=" + encodeURIComponent(lienDiscord);
    const reponse = await fetch(url);
    const resultat = await reponse.json();

    if (!resultat.success) {
      throw new Error(
        resultat.message || "Impossible d’ajouter le rapport Discord."
      );
    }

    synchroniserEffectifDepuisRapports(resultat);
    rapportsRegistre = Array.isArray(resultat.rapports)
      ? resultat.rapports
      : rapportsRegistre;
    rapportsCharges = true;
    formulaireRapportDiscordOuvert = false;
    categorieRapportsActive = "LU";
    afficherRapports();
    afficherNotificationGDA(
      resultat.message || "Rapport Discord ajouté.",
      "succes"
    );
  } catch (erreur) {
    console.error(erreur);
    window.alert(
      erreur.message || "Impossible de contacter le serveur GDA."
    );
    bouton.disabled = false;
    bouton.textContent = "Ajouter dans « Lus et validés »";
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
