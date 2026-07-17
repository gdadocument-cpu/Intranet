const departButton =
  document.getElementById("departButton");

const departWorkspace =
  document.getElementById("workspace");

const DEPART_API_URL = API_URL;


/* ==================================================
   DONNÉES DU MODULE
================================================== */

let registreDeparts = [];
let registreLicenciements = [];
let registreBlacklists = [];
let membresDepart = [];
let departPeutGerer = false;
let departsCharges = false;

let categorieDepartOuverte = null;
let personneDepartOuverte = null;

let rechercheDepart = "";


/* ==================================================
   OUVERTURE DU MODULE
================================================== */

if (departButton) {
  departButton.addEventListener(
    "click",
    function () {
      if (departsCharges) {
        afficherAccueilDeparts();
      } else {
        chargerRegistreDeparts();
      }
    }
  );
}


/* ==================================================
   CHARGEMENT DES DONNÉES
================================================== */

async function chargerRegistreDeparts() {
  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";

  if (!(typeof gdaReponseEnCache === "function" && gdaReponseEnCache("recupererDeparts"))) {
    departWorkspace.innerHTML = `
      <section id="departModule">

        <div class="depart-message">
          Chargement du registre des départs...
        </div>

      </section>
    `;
  }

  if (!identifiant) {
    afficherErreurDepart(
      "Votre session n’est plus valide. Rechargez la page et reconnectez-vous."
    );

    return;
  }

  try {
    const url =
      DEPART_API_URL +
      "?action=recupererDeparts" +
      "&horaires=1" +
      "&identifiant=" +
      encodeURIComponent(identifiant);

    const reponse =
      await fetch(url);

    if (!reponse.ok) {
      throw new Error(
        "Erreur serveur : " +
        reponse.status
      );
    }

    const resultat =
      await reponse.json();

    if (!resultat.success) {
      afficherErreurDepart(
        resultat.message ||
        "Impossible de récupérer le registre des départs."
      );

      return;
    }

    appliquerDonneesDeparts(resultat, true);

    categorieDepartOuverte = null;
    personneDepartOuverte = null;

    afficherAccueilDeparts();

  } catch (erreur) {
    console.error(erreur);

    afficherErreurDepart(
      erreur.message || "Impossible de contacter le serveur GDA."
    );
  }
}

function appliquerDonneesDeparts(resultat, avecMembres) {
  if (Array.isArray(resultat.departs)) {
    registreDeparts = resultat.departs;
  }
  if (Array.isArray(resultat.licenciements)) {
    registreLicenciements = resultat.licenciements;
  }
  if (Array.isArray(resultat.blacklists)) {
    registreBlacklists = resultat.blacklists;
  }
  if (avecMembres && Array.isArray(resultat.membres)) {
    membresDepart = resultat.membres;
  }
  if (typeof resultat.peutGerer === "boolean") {
    departPeutGerer = resultat.peutGerer;
  }
  departsCharges = true;
}


/* ==================================================
   ACCUEIL DU MODULE
================================================== */

function afficherAccueilDeparts() {
  const resultatsRecherche =
    obtenirResultatsRechercheDepart();

  departWorkspace.innerHTML = `
    <section id="departModule">

      ${creerEnteteDepart()}

      ${creerRechercheDepart()}

      ${
        rechercheDepart.trim()
          ? creerResultatsRechercheDepart(
              resultatsRecherche
            )
          : creerCartesCategoriesDepart()
      }

    </section>
  `;

  installerEvenementsAccueilDepart();
}


/* ==================================================
   EN-TÊTE
================================================== */

function creerEnteteDepart() {
  const total =
    registreDeparts.length +
    registreLicenciements.length +
    registreBlacklists.length;

  return `
    <header class="depart-header">

      <div class="depart-header-titre">

        <h3>
          🚪 REGISTRE DES DÉPARTS
        </h3>

        <p>
          Départs, licenciements et personnes inscrites sur liste noire
        </p>

      </div>

      <div class="depart-header-actions">
      
      ${departPeutGerer ? `<button
  id="departAjouterDossier"
  class="depart-bouton-principal"
  type="button"
>
  ➕ Ajouter un dossier

</button>` : ""}

        <div class="depart-compteur-global">

          <strong>
            ${total}
          </strong>

          <span>
            dossiers
          </span>

        </div>

        <button
          id="departActualiser"
          class="depart-bouton-secondaire"
          type="button"
        >
          ↻ Actualiser
        </button>

      </div>

    </header>
  `;
}


/* ==================================================
   RECHERCHE GLOBALE
================================================== */

function creerRechercheDepart() {
  return `
    <section class="depart-recherche">

      <div class="depart-recherche-icone">
        🔎
      </div>

      <div class="depart-recherche-contenu">

        <label for="departRechercheChamp">
          Rechercher une personne
        </label>

        <input
          id="departRechercheChamp"
          type="search"
          value="${echapperHTML(
            rechercheDepart
          )}"
          placeholder="Nom, Steam ID ou Discord ID..."
          autocomplete="off"
        >

      </div>

      ${
        rechercheDepart.trim()
          ? `
            <button
              id="departEffacerRecherche"
              class="depart-effacer-recherche"
              type="button"
              aria-label="Effacer la recherche"
            >
              ✕
            </button>
          `
          : ""
      }

    </section>
  `;
}


/* ==================================================
   TROIS CATÉGORIES PRINCIPALES
================================================== */

function creerCartesCategoriesDepart() {
  return `
    <section class="depart-categories">

      ${creerCarteCategorieDepart(
        "depart",
        "🚪",
        "Départs",
        "Départs volontaires ou administratifs",
        registreDeparts.length
      )}

      ${creerCarteCategorieDepart(
        "licenciement",
        "⚖️",
        "Licenciements",
        "Membres licenciés de la GDA",
        registreLicenciements.length
      )}

      ${creerCarteCategorieDepart(
        "blacklist",
        "⛔",
        "Listes noires",
        "Interdictions temporaires ou permanentes",
        registreBlacklists.length
      )}

    </section>
  `;
}


function creerCarteCategorieDepart(
  categorie,
  icone,
  titre,
  description,
  nombre
) {
  return `
    <button
      class="
        depart-carte
        depart-carte-${categorie}
      "
      type="button"
      data-categorie="${categorie}"
    >

      <span class="depart-carte-halo"></span>

      <span class="depart-carte-icone">
        ${icone}
      </span>

      <span class="depart-carte-informations">

        <strong>
          ${echapperHTML(titre)}
        </strong>

        <small>
          ${echapperHTML(description)}
        </small>

      </span>

      <span class="depart-carte-compteur">
        ${nombre}
      </span>

      <span class="depart-carte-fleche">
        →
      </span>

    </button>
  `;
}


/* ==================================================
   RECHERCHE DANS LES TROIS CATÉGORIES
================================================== */

function obtenirResultatsRechercheDepart() {
  const recherche =
    normaliserTexteDepartClient(
      rechercheDepart
    );

  if (!recherche) {
    return [];
  }

  const toutesLesEntrees = [
    ...registreDeparts,
    ...registreLicenciements,
    ...registreBlacklists
  ];

  return toutesLesEntrees
    .filter(function (entree) {
      const nom =
        normaliserTexteDepartClient(
          entree.nom
        );

      const steamId =
        normaliserTexteDepartClient(
          entree.steamId
        );

      const discordId =
        normaliserTexteDepartClient(
          entree.discordId
        );

      return (
        nom.includes(recherche) ||
        steamId.includes(recherche) ||
        discordId.includes(recherche)
      );
    })
    .sort(trierEntreesDepartRecent);
}


/* ==================================================
   AFFICHAGE DES RÉSULTATS
================================================== */

function creerResultatsRechercheDepart(
  resultats
) {
  const contenu =
    resultats.length
      ? resultats
          .map(function (entree) {
            return creerLigneDepart(
              entree,
              obtenirCategorieEntreeDepart(
                entree
              )
            );
          })
          .join("")
      : `
        <div class="depart-vide">

          <strong>
            Aucun résultat
          </strong>

          <span>
            Aucun nom, Steam ID ou Discord ID ne correspond à cette recherche.
          </span>

        </div>
      `;

  return `
    <section class="depart-bloc">

      <div class="depart-bloc-titre">

        <div>
          <h4>
            🔎 Résultats de la recherche
          </h4>

          <p>
            Résultats trouvés dans les trois catégories.
          </p>
        </div>

        <span class="depart-total">
          ${resultats.length}
        </span>

      </div>

      <div class="depart-liste">
        ${contenu}
      </div>

    </section>
  `;
}


/* ==================================================
   ÉVÉNEMENTS DE L’ACCUEIL
================================================== */

function installerEvenementsAccueilDepart() {
  const actualiser =
    document.getElementById(
      "departActualiser"
    );

  if (actualiser) {
    actualiser.addEventListener(
      "click",
      function() {
        if (typeof gdaForcerActualisation === "function") {
          gdaForcerActualisation("recupererDeparts");
        }
        chargerRegistreDeparts();
      }
    );
  }

  const champRecherche =
    document.getElementById(
      "departRechercheChamp"
    );

  if (champRecherche) {
    champRecherche.addEventListener(
      "input",
      function () {
        const position =
          champRecherche.selectionStart;

        rechercheDepart =
          champRecherche.value;

        afficherAccueilDeparts();

        const nouveauChamp =
          document.getElementById(
            "departRechercheChamp"
          );

        if (nouveauChamp) {
          nouveauChamp.focus();

          nouveauChamp.setSelectionRange(
            position,
            position
          );
        }
      }
    );
  }

  const effacerRecherche =
    document.getElementById(
      "departEffacerRecherche"
    );

  if (effacerRecherche) {
    effacerRecherche.addEventListener(
      "click",
      function () {
        rechercheDepart = "";

        afficherAccueilDeparts();
      }
    );
  }

  document
    .querySelectorAll(
      "[data-categorie]"
    )
    .forEach(function (bouton) {
      bouton.addEventListener(
        "click",
        function () {
          const categorie =
            bouton.dataset.categorie;

          ouvrirCategorieDepart(
            categorie
          );
        }
      );
    });

  installerEvenementsLignesDepart();
  installerBoutonAjouterDepart();
}


/* ==================================================
   OUVERTURE D’UNE CATÉGORIE
================================================== */

function ouvrirCategorieDepart(
  categorie
) {
  categorieDepartOuverte =
    categorie;

  personneDepartOuverte =
    null;

  afficherCategorieDepart();
}


/* ==================================================
   OUTILS GÉNÉRAUX
================================================== */

function obtenirCategorieEntreeDepart(
  entree
) {
  const type =
    normaliserTexteDepartClient(
      entree.type
    );

  if (
    type.includes("LICENCIEMENT")
  ) {
    return "licenciement";
  }

  if (
    type.includes("BLACK") ||
    type === "BL"
  ) {
    return "blacklist";
  }

  return "depart";
}


function trierEntreesDepartRecent(
  a,
  b
) {
  const dateA =
    convertirDateDepartClient(
      a.dateDepart
    );

  const dateB =
    convertirDateDepartClient(
      b.dateDepart
    );

  const tempsA =
    dateA
      ? dateA.getTime()
      : 0;

  const tempsB =
    dateB
      ? dateB.getTime()
      : 0;

  if (tempsA !== tempsB) {
    return tempsB - tempsA;
  }

  return (
    Number(b.ligne || 0) -
    Number(a.ligne || 0)
  );
}


function normaliserTexteDepartClient(
  texte
) {
  return String(texte || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[–—]/g,
      "-"
    )
    .replace(
      /\s+/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    );
}
/* ==================================================
   AFFICHAGE D’UNE CATÉGORIE
================================================== */

function afficherCategorieDepart() {
  const configuration =
    obtenirConfigurationCategorieDepart(
      categorieDepartOuverte
    );

  const entrees =
    obtenirEntreesCategorieDepart(
      categorieDepartOuverte
    )
      .slice()
      .sort(trierEntreesDepartRecent);

  departWorkspace.innerHTML = `
    <section id="departModule">

      <header class="depart-header">

        <div class="depart-header-titre">

          <h3>
            ${configuration.icone}
            ${echapperHTML(
              configuration.titre.toUpperCase()
            )}
          </h3>

          <p>
            ${echapperHTML(configuration.description)}
          </p>

        </div>

        <div class="depart-header-actions">

          <button
            id="departRetourAccueil"
            class="depart-bouton-secondaire"
            type="button"
          >
            ← Retour aux catégories
          </button>

          <button
            id="departActualiserCategorie"
            class="depart-bouton-secondaire"
            type="button"
          >
            ↻ Actualiser
          </button>

        </div>

      </header>

      ${creerRechercheCategorieDepart()}

      ${creerListeCategorieDepart(
        entrees,
        configuration
      )}

    </section>
  `;

  installerEvenementsCategorieDepart();
}


/* ==================================================
   CONFIGURATION DES CATÉGORIES
================================================== */

function obtenirConfigurationCategorieDepart(
  categorie
) {
  if (categorie === "licenciement") {
    return {
      icone: "⚖️",
      titre: "Licenciements",
      description:
        "Registre des anciens membres licenciés de la GDA.",
      classe: "licenciement"
    };
  }

  if (categorie === "blacklist") {
    return {
      icone: "⛔",
      titre: "Listes noires",
      description:
        "Interdictions temporaires ou permanentes de réintégration.",
      classe: "blacklist"
    };
  }

  return {
    icone: "🚪",
    titre: "Départs",
    description:
      "Registre des départs volontaires ou administratifs.",
    classe: "depart"
  };
}


function obtenirEntreesCategorieDepart(
  categorie
) {
  if (categorie === "licenciement") {
    return registreLicenciements;
  }

  if (categorie === "blacklist") {
    return registreBlacklists;
  }

  return registreDeparts;
}


/* ==================================================
   RECHERCHE DANS UNE CATÉGORIE
================================================== */

function creerRechercheCategorieDepart() {
  return `
    <section class="depart-recherche">

      <div class="depart-recherche-icone">
        🔎
      </div>

      <div class="depart-recherche-contenu">

        <label for="departRechercheCategorie">
          Rechercher dans cette catégorie
        </label>

        <input
          id="departRechercheCategorie"
          type="search"
          value="${echapperHTML(
            rechercheDepart
          )}"
          placeholder="Nom, Steam ID ou Discord ID..."
          autocomplete="off"
        >

      </div>

      ${
        rechercheDepart.trim()
          ? `
            <button
              id="departEffacerRechercheCategorie"
              class="depart-effacer-recherche"
              type="button"
              aria-label="Effacer la recherche"
            >
              ✕
            </button>
          `
          : ""
      }

    </section>
  `;
}


/* ==================================================
   LISTE D’UNE CATÉGORIE
================================================== */

function creerListeCategorieDepart(
  entrees,
  configuration
) {
  const entreesFiltrees =
    filtrerEntreesDepart(
      entrees,
      rechercheDepart
    );

  const contenu =
    entreesFiltrees.length
      ? entreesFiltrees
          .map(function (entree) {
            return creerLigneDepart(
              entree,
              configuration.classe
            );
          })
          .join("")
      : `
        <div class="depart-vide">

          <strong>
            Aucun dossier
          </strong>

          <span>
            ${
              rechercheDepart.trim()
                ? "Aucune personne ne correspond à cette recherche."
                : "Aucune personne enregistrée dans cette catégorie."
            }
          </span>

        </div>
      `;

  return `
    <section
      class="
        depart-bloc
        depart-bloc-${configuration.classe}
      "
    >

      <div class="depart-bloc-titre">

        <div>
          <h4>
            ${configuration.icone}
            ${echapperHTML(configuration.titre)}
          </h4>

          <p>
            Liste classée de la plus récente à la plus ancienne.
          </p>
        </div>

        <span class="depart-total">
          ${entreesFiltrees.length}
        </span>

      </div>

      <div class="depart-liste">
        ${contenu}
      </div>

    </section>
  `;
}


/* ==================================================
   FILTRE D’UNE CATÉGORIE
================================================== */

function filtrerEntreesDepart(
  entrees,
  rechercheTexte
) {
  const recherche =
    normaliserTexteDepartClient(
      rechercheTexte
    );

  return entrees
    .filter(function (entree) {
      if (!recherche) {
        return true;
      }

      const nom =
        normaliserTexteDepartClient(
          entree.nom
        );

      const steam =
        normaliserTexteDepartClient(
          entree.steamId
        );

      const discord =
        normaliserTexteDepartClient(
          entree.discordId
        );

      return (
        nom.includes(recherche) ||
        steam.includes(recherche) ||
        discord.includes(recherche)
      );
    })
    .sort(trierEntreesDepartRecent);
}


/* ==================================================
   CRÉATION D’UNE LIGNE
================================================== */

function creerLigneDepart(
  entree,
  categorie
) {
  const estOuverte =
    personneDepartOuverte ===
    Number(entree.ligne);

  const statut =
    obtenirStatutRetourDepart(
      entree
    );

  return `
    <article
      class="
        depart-personne
        depart-personne-${categorie}
        ${estOuverte ? "depart-personne-ouverte" : ""}
      "
      data-ligne="${entree.ligne}"
    >

      <button
        class="depart-personne-resume"
        type="button"
        data-action="ouvrir-personne-depart"
        data-ligne="${entree.ligne}"
        data-categorie="${categorie}"
        aria-expanded="${estOuverte}"
      >

        <div class="depart-personne-identite">

          <strong>
            ${echapperHTML(
              entree.nom || "Sans nom"
            )}
          </strong>
        </div>

        <div class="depart-personne-grade">
          <span>Grade</span>
          <strong>
            ${echapperHTML(
              entree.grade ||
              "Grade non renseigné"
            )}
          </strong>
        </div>

        <div class="depart-personne-statut">

          <span
            class="
              depart-statut
              ${statut.classe}
            "
          >
            ${statut.icone}
            ${echapperHTML(statut.texte)}
          </span>

          ${
            statut.compteur
              ? `
                <strong>
                  ${echapperHTML(
                    statut.compteur
                  )}
                </strong>
              `
              : ""
          }

        </div>

        <div class="depart-personne-date">

          <span>
            Date de départ
          </span>

          <strong>
            ${echapperHTML(
              formaterDateDepartFrancaise(
                entree.dateDepart
              )
            )}
          </strong>

        </div>

        <span class="depart-personne-fleche">
          ${estOuverte ? "▲" : "▼"}
        </span>

      </button>

      ${
        estOuverte
          ? creerDetailsPersonneDepart(
              entree,
              categorie
            )
          : ""
      }

    </article>
  `;
}


/* ==================================================
   STATUT ET COMPTEUR DE RETOUR
================================================== */
function obtenirStatutRetourDepart(
  entree
) {
  const estPermanent =
    entree.permanent === true ||
    normaliserTexteDepartClient(
      entree.statut
    ) === "PERMANENT" ||
    normaliserTexteDepartClient(
      entree.dateRetour
    ) === "PERMANENT";

  if (estPermanent) {
    return {
      texte: "Retour interdit définitivement",
      compteur: "Blacklist permanente",
      icone: "⛔",
      classe: "depart-statut-permanent"
    };
  }

  /*
   * Pour tous les dossiers non permanents, le HTML calcule lui-même
   * le retour à partir de la date de fin. La valeur peutRevenir et le
   * statut transmis par le serveur ne peuvent donc plus fausser le
   * compteur.
   */
  const dateRetour =
    convertirDateDepartClient(
      entree.dateRetour
    );

  if (!dateRetour) {
    return {
      texte: "Retour non autorisé",
      compteur: "Date de retour non renseignée",
      icone: "⛔",
      classe: "depart-statut-interdit"
    };
  }

  const aujourdHui =
    obtenirDateDepartAujourdhui();

  const difference =
    Math.ceil(
      (
        dateRetour.getTime() -
        aujourdHui.getTime()
      ) /
      86400000
    );

  if (difference <= 0) {
    return {
      texte: "Retour autorisé",
      compteur: "Date de retour atteinte",
      icone: "✓",
      classe: "depart-statut-autorise"
    };
  }

  return {
    texte: "Retour interdit",
    compteur:
      difference === 1
        ? "1 jour restant"
        : difference +
          " jours restants",
    icone: "⏳",
    classe: "depart-statut-interdit"
  };
}


/* ==================================================
   DÉTAILS D’UNE PERSONNE
================================================== */

function creerDetailsPersonneDepart(
  entree,
  categorie
) {
  const statut =
    obtenirStatutRetourDepart(
      entree
    );

  return `
    <div class="depart-details">

      <div class="depart-details-grille">

        ${creerChampDetailDepart(
          "Type de départ",
          obtenirNomCategorieDepart(
            categorie
          )
        )}

        ${creerChampDetailDepart(
          "Grade au moment du départ",
          entree.grade
        )}
${creerChampCopiableDepart(
  "Steam ID",
  entree.steamId,
  "steam"
)}

${creerChampCopiableDepart(
  "Discord ID",
  entree.discordId,
  "discord"
)}

        ${creerChampDetailDepart(
          "Date de départ",
          formaterDateDepartFrancaise(
            entree.dateDepart
          )
        )}

    ${creerChampDetailDepart(
  "Retour autorisé à partir du",
  entree.permanent === true ||
  normaliserTexteDepartClient(
    entree.statut
  ) === "PERMANENT"
    ? "Aucun retour autorisé"
    : entree.dateRetour
      ? formaterDateDepartFrancaise(
          entree.dateRetour
        )
      : "Retour non autorisé"
)}

        ${creerChampDetailDepart(
          "Statut actuel",
          statut.texte
        )}

        ${creerChampDetailDepart(
          "Décision prise par",
          entree.decision
        )}

      </div>

      <div class="depart-details-raison">

        <span>
          Raison du départ
        </span>

        <p>
          ${echapperHTML(
            entree.raison ||
            "Aucune raison renseignée."
          )}
        </p>

      </div>

      <div class="depart-details-medailles">

        <span>
          Médailles obtenues durant le service
        </span>

        <div class="depart-medailles-liste">
          ${creerMedaillesDepart(
            entree.medailles
          )}
        </div>

      </div>

      ${departPeutGerer ? `<div class="depart-details-actions">

  <button
    class="depart-bouton-secondaire"
    type="button"
    data-action="modifier-dossier-depart"
    data-ligne="${entree.ligne}"
    data-categorie="${categorie}"
  >
    ✏ Modifier
  </button>

  <button
    class="depart-bouton-supprimer"
    type="button"
    data-action="supprimer-dossier-depart"
    data-ligne="${entree.ligne}"
    data-categorie="${categorie}"
  >
    🗑 Supprimer
  </button>

</div>` : ""}

    </div>
  `;
}


function creerChampDetailDepart(
  label,
  valeur
) {
  return `
    <div class="depart-detail-champ">

      <span>
        ${echapperHTML(label)}
      </span>

      <strong>
        ${echapperHTML(
          valeur || "Non renseigné"
        )}
      </strong>

    </div>
  `;
}


/* ==================================================
   MÉDAILLES
================================================== */

function creerMedaillesDepart(
  valeur
) {
  const medailles =
    String(valeur || "")
      .split(/[,;\n]+/)
      .map(function (medaille) {
        return medaille.trim();
      })
      .filter(Boolean);

  if (!medailles.length) {
    return `
      <span class="depart-medaille depart-medaille-vide">
        Aucune médaille renseignée
      </span>
    `;
  }

  return medailles
    .map(function (medaille) {
      return `
        <span class="depart-medaille">
          ${echapperHTML(medaille)}
        </span>
      `;
    })
    .join("");
}


/* ==================================================
   ÉVÉNEMENTS D’UNE CATÉGORIE
================================================== */

function installerEvenementsCategorieDepart() {
  const retour =
    document.getElementById(
      "departRetourAccueil"
    );

  if (retour) {
    retour.addEventListener(
      "click",
      function () {
        categorieDepartOuverte =
          null;

        personneDepartOuverte =
          null;

        rechercheDepart = "";

        afficherAccueilDeparts();
      }
    );
  }

  const actualiser =
    document.getElementById(
      "departActualiserCategorie"
    );

  if (actualiser) {
    actualiser.addEventListener(
      "click",
      function() {
        if (typeof gdaForcerActualisation === "function") {
          gdaForcerActualisation("recupererDeparts");
        }
        chargerRegistreDeparts();
      }
    );
  }

  const champRecherche =
    document.getElementById(
      "departRechercheCategorie"
    );

  if (champRecherche) {
    champRecherche.addEventListener(
      "input",
      function () {
        const position =
          champRecherche.selectionStart;

        rechercheDepart =
          champRecherche.value;

        afficherCategorieDepart();

        const nouveauChamp =
          document.getElementById(
            "departRechercheCategorie"
          );

        if (nouveauChamp) {
          nouveauChamp.focus();

          nouveauChamp.setSelectionRange(
            position,
            position
          );
        }
      }
    );
  }

  const effacer =
    document.getElementById(
      "departEffacerRechercheCategorie"
    );

  if (effacer) {
    effacer.addEventListener(
      "click",
      function () {
        rechercheDepart = "";

        afficherCategorieDepart();
      }
    );
  }

  installerEvenementsLignesDepart();
}


/* ==================================================
   ÉVÉNEMENTS DES LIGNES
================================================== */

function installerEvenementsLignesDepart() {
  document
    .querySelectorAll(
      '[data-action="ouvrir-personne-depart"]'
    )
    .forEach(function (bouton) {
      bouton.addEventListener(
        "click",
        function () {
          const ligne =
            Number(
              bouton.dataset.ligne
            );

          personneDepartOuverte =
            personneDepartOuverte === ligne
              ? null
              : ligne;

          if (categorieDepartOuverte) {
            afficherCategorieDepart();
          } else {
            afficherAccueilDeparts();
          }
        }
      );
    });

document
  .querySelectorAll(
    '[data-action="modifier-dossier-depart"]'
  )
  .forEach(function (bouton) {
    bouton.addEventListener(
      "click",
      function (evenement) {
        evenement.stopPropagation();

        const ligne =
          Number(bouton.dataset.ligne);

        const categorie =
          bouton.dataset.categorie;

        ouvrirModificationDepart(
          ligne,
          categorie
        );
      }
    );
  });

document
  .querySelectorAll(
    '[data-action="supprimer-dossier-depart"]'
  )
  .forEach(function (bouton) {
    bouton.addEventListener(
      "click",
      function (evenement) {
        evenement.stopPropagation();

        const ligne =
          Number(bouton.dataset.ligne);

        const categorie =
          bouton.dataset.categorie;

        confirmerSuppressionDepart(
          ligne,
          categorie
        );
      }
    );
  });

      installerEvenementsCopieDepart();
}


/* ==================================================
   OUTILS DE CATÉGORIE
================================================== */

function obtenirNomCategorieDepart(
  categorie
) {
  if (categorie === "licenciement") {
    return "Licenciement";
  }

  if (categorie === "blacklist") {
    return "Liste noire";
  }

  return "Départ";
}

/* ==================================================
   FORMULAIRE D’AJOUT
================================================== */

function creerFormulaireNouveauDepart() {
  const aujourdHui =
    obtenirDateDepartISO(
      new Date()
    );

  const membres =
    recupererMembresPourDepart();

  const optionsMembres =
    membres
      .map(function (membre) {
        return `
          <option value="${echapperHTML(
            membre.nom
          )}">
            ${echapperHTML(membre.grade)}
            — ${echapperHTML(membre.nom)}
          </option>
        `;
      })
      .join("");

  return `
    <section class="depart-bloc depart-formulaire-bloc">

      <div class="depart-bloc-titre">

        <div>
          <h4>
            ➕ Ajouter un dossier
          </h4>

          <p>
            Enregistrer un départ, un licenciement ou une inscription sur liste noire.
          </p>
        </div>

      </div>

      <form
        id="departNouveauFormulaire"
        class="depart-formulaire"
      >

        <label class="depart-champ">

          <span>
            Personnel
          </span>

          <select
            id="departNom"
            required
          >
            <option value="">
              Sélectionner un membre
            </option>

            ${optionsMembres}
          </select>

        </label>

        <label class="depart-champ">

          <span>
            Type de dossier
          </span>

          <select
            id="departType"
            required
          >
            <option value="">
              Sélectionner un type
            </option>

            <option value="Départ">
              Départ
            </option>

            <option value="Licenciement">
              Licenciement
            </option>

            <option value="Blacklist">
              Blacklist
            </option>
          </select>

        </label>

        <label class="depart-champ">

          <span>
            Date du départ
          </span>

          <input
            id="departDate"
            type="date"
            lang="fr-FR"
            value="${aujourdHui}"
            required
          >

        </label>

        <label
          id="departDureeZone"
          class="depart-champ depart-champ-cache"
        >

          <span>
            Durée de la blacklist
          </span>

          <select id="departDuree">

            <option value="">
              Sélectionner une durée
            </option>

            <option value="1 semaine">
              1 semaine
            </option>

            <option value="2 semaines">
              2 semaines
            </option>

            <option value="3 semaines">
              3 semaines
            </option>

            <option value="1 mois">
              1 mois
            </option>

            <option value="2 mois">
              2 mois
            </option>

            <option value="3 mois">
              3 mois
            </option>

            <option value="6 mois">
              6 mois
            </option>

            <option value="Permanent">
              Permanent
            </option>

          </select>

        </label>

        <label class="depart-champ depart-champ-raison">

          <span>
            Raison
          </span>

          <textarea
            id="departRaison"
            maxlength="1500"
            placeholder="Expliquez la raison du départ ou de la décision..."
            required
          ></textarea>

        </label>

        <div class="depart-formulaire-actions">

          <button
            id="departValider"
            class="depart-bouton-principal"
            type="submit"
          >
            Enregistrer
          </button>

        </div>

      </form>

      <p
        id="departFormulaireMessage"
        class="depart-message-formulaire"
      ></p>

    </section>
  `;
}


/* ==================================================
   OUVRIR LE FORMULAIRE
================================================== */

function afficherFormulaireDepart() {
  if (!departPeutGerer) {
    afficherAccueilDeparts();
    return;
  }

  departWorkspace.innerHTML = `
    <section id="departModule">

      <header class="depart-header">

        <div class="depart-header-titre">

          <h3>
            ➕ AJOUTER UN DOSSIER
          </h3>

          <p>
            Enregistrer un départ, un licenciement ou une blacklist.
          </p>

        </div>

        <button
          id="departRetourDepuisFormulaire"
          class="depart-bouton-secondaire"
          type="button"
        >
          ← Retour
        </button>

      </header>

      ${creerFormulaireNouveauDepart()}

    </section>
  `;

  installerEvenementsFormulaireDepart();
}


/* ==================================================
   MEMBRES DISPONIBLES DANS LE FORMULAIRE
================================================== */

function recupererMembresPourDepart() {
  return [...membresDepart].sort(
    function (a, b) {
      const rangA =
        obtenirRangGradeDepart(
          a.grade
        );

      const rangB =
        obtenirRangGradeDepart(
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
    }
  );
}


/* ==================================================
   ÉVÉNEMENTS DU FORMULAIRE
================================================== */

function installerEvenementsFormulaireDepart() {
  const boutonRetour =
    document.getElementById(
      "departRetourDepuisFormulaire"
    );

  if (boutonRetour) {
    boutonRetour.addEventListener(
      "click",
      function () {
        afficherAccueilDeparts();
      }
    );
  }

  const champType =
    document.getElementById(
      "departType"
    );

  const zoneDuree =
    document.getElementById(
      "departDureeZone"
    );

  const champDuree =
    document.getElementById(
      "departDuree"
    );

  if (
    champType &&
    zoneDuree &&
    champDuree
  ) {
    champType.addEventListener(
      "change",
      function () {
        const type =
          normaliserTexteDepartClient(
            champType.value
          );

        const estBlacklist =
          type.includes("BLACK");

        zoneDuree.classList.toggle(
          "depart-champ-cache",
          !estBlacklist
        );

        champDuree.required =
          estBlacklist;

        if (!estBlacklist) {
          champDuree.value = "";
        }
      }
    );
  }

  const formulaire =
    document.getElementById(
      "departNouveauFormulaire"
    );

  if (formulaire) {
    formulaire.addEventListener(
      "submit",
      envoyerNouveauDepart
    );
  }
}


/* ==================================================
   ENREGISTREMENT
================================================== */

async function envoyerNouveauDepart(
  evenement
) {
  evenement.preventDefault();

  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";

  const nom =
    document.getElementById(
      "departNom"
    ).value;

  const type =
    document.getElementById(
      "departType"
    ).value;

  const dateDepart =
    document.getElementById(
      "departDate"
    ).value;

  const duree =
    document.getElementById(
      "departDuree"
    ).value;

  const raison =
    document.getElementById(
      "departRaison"
    ).value.trim();

  const bouton =
    document.getElementById(
      "departValider"
    );

  const message =
    document.getElementById(
      "departFormulaireMessage"
    );

  const typeNormalise =
    normaliserTexteDepartClient(
      type
    );

  if (
    !nom ||
    !type ||
    !dateDepart ||
    !raison
  ) {
    afficherMessageFormulaireDepart(
      message,
      "Tous les champs obligatoires doivent être remplis.",
      true
    );

    return;
  }

  if (
    typeNormalise.includes("BLACK") &&
    !duree
  ) {
    afficherMessageFormulaireDepart(
      message,
      "Veuillez sélectionner une durée de blacklist.",
      true
    );

    return;
  }

  bouton.disabled = true;
  bouton.textContent =
    "Enregistrement...";

  afficherMessageFormulaireDepart(
    message,
    "Enregistrement du dossier...",
    false
  );

  try {
    const url =
      DEPART_API_URL +
      "?action=ajouterDepart" +
      "&identifiant=" +
      encodeURIComponent(identifiant) +
      "&nom=" +
      encodeURIComponent(nom) +
      "&type=" +
      encodeURIComponent(type) +
      "&dateDepart=" +
      encodeURIComponent(dateDepart) +
      "&duree=" +
      encodeURIComponent(duree) +
      "&raison=" +
      encodeURIComponent(raison);

    const reponse =
      await fetch(url);

    if (!reponse.ok) {
      throw new Error(
        "Erreur serveur : " +
        reponse.status
      );
    }

    const resultat =
      await reponse.json();

    if (!resultat.success) {
      afficherMessageFormulaireDepart(
        message,
        resultat.message ||
          "Impossible d’enregistrer ce dossier.",
        true
      );

      return;
    }

    afficherMessageFormulaireDepart(
      message,
      resultat.message ||
        "Le dossier a été enregistré.",
      false,
      true
    );

    if (typeof invaliderCacheLecturesActionsGDA === "function") {
      invaliderCacheLecturesActionsGDA([
        "recupererDeparts",
        "recupererEffectif",
        "recupererGestionPersonnel",
        "recupererAdministration"
      ]);
    } else if (typeof window.invaliderCacheEffectifGDA === "function") {
      window.invaliderCacheEffectifGDA();
    }

    appliquerDonneesDeparts(resultat, false);
    categorieDepartOuverte = null;
    personneDepartOuverte = null;
    afficherAccueilDeparts();
    afficherNotificationGDA(
      resultat.message || "Le dossier a été enregistré.",
      "succes"
    );

  } catch (erreur) {
    console.error(erreur);

    afficherMessageFormulaireDepart(
      message,
      "Impossible de contacter le serveur GDA.",
      true
    );

  } finally {
    bouton.disabled = false;
    bouton.textContent =
      "Enregistrer";
  }
}


/* ==================================================
   MESSAGE DU FORMULAIRE
================================================== */

function afficherMessageFormulaireDepart(
  element,
  texte,
  erreur,
  succes
) {
  if (!element) {
    return;
  }

  element.textContent =
    texte;

  element.className =
    "depart-message-formulaire";

  if (erreur) {
    element.classList.add(
      "depart-message-erreur"
    );
  } else if (succes) {
    element.classList.add(
      "depart-message-succes"
    );
  }
}


/* ==================================================
   BOUTON AJOUTER SUR L’ACCUEIL
================================================== */

function installerBoutonAjouterDepart() {
  const bouton =
    document.getElementById(
      "departAjouterDossier"
    );

  if (!bouton) {
    return;
  }

  bouton.addEventListener(
    "click",
    afficherFormulaireDepart
  );
}


/* ==================================================
   RANG DES GRADES
================================================== */

function obtenirRangGradeDepart(
  grade
) {
  const gradeNormalise =
    normaliserTexteDepartClient(
      grade
    );

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
    "ANCIEN-GDA"
  ];

  const position =
    ordreGrades.indexOf(
      gradeNormalise
    );

  return position === -1
    ? 999
    : position;
}

/* ==================================================
   GESTION DES DATES
================================================== */

function convertirDateDepartClient(
  texte
) {
  const valeur =
    String(texte || "").trim();

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(valeur)) {
    const dateHeure = new Date(valeur);
    return isNaN(dateHeure.getTime()) ? null : dateHeure;
  }

  const correspondanceISO =
    valeur.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (correspondanceISO) {
    const date = new Date(
      Number(correspondanceISO[1]),
      Number(correspondanceISO[2]) - 1,
      Number(correspondanceISO[3])
    );

    date.setHours(0, 0, 0, 0);

    return isNaN(date.getTime())
      ? null
      : date;
  }

  const correspondanceFrancaise =
    valeur.match(
      /^(\d{2})\/(\d{2})\/(\d{4})$/
    );

  if (correspondanceFrancaise) {
    const date = new Date(
      Number(correspondanceFrancaise[3]),
      Number(correspondanceFrancaise[2]) - 1,
      Number(correspondanceFrancaise[1])
    );

    date.setHours(0, 0, 0, 0);

    return isNaN(date.getTime())
      ? null
      : date;
  }

  return null;
}

function valeurDateDepartPourChamp(texte) {
  const valeur = String(texte || "").trim();
  const iso = valeur.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
  if (iso) return iso[1];
  const date = convertirDateDepartClient(valeur);
  if (!date) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}


function obtenirDateDepartAujourdhui() {
  const aujourdHui =
    new Date();

  aujourdHui.setHours(
    0,
    0,
    0,
    0
  );

  return aujourdHui;
}


function obtenirDateDepartISO(
  date
) {
  if (
    !date ||
    isNaN(date.getTime())
  ) {
    return "";
  }

  const annee =
    date.getFullYear();

  const mois =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const jour =
    String(
      date.getDate()
    ).padStart(2, "0");

  return (
    annee +
    "-" +
    mois +
    "-" +
    jour
  );
}


function formaterDateDepartFrancaise(
  texte
) {
  return formaterDateHeureGDA(texte, "Non renseignée");
}


/* ==================================================
   CALCUL LOCAL DU TEMPS RESTANT
================================================== */

function calculerJoursRestantsDepart(
  dateRetourTexte
) {
  const dateRetour =
    convertirDateDepartClient(
      dateRetourTexte
    );

  if (!dateRetour) {
    return null;
  }

  const aujourdHui =
    obtenirDateDepartAujourdhui();

  return Math.ceil(
    (
      dateRetour.getTime() -
      aujourdHui.getTime()
    ) /
    86400000
  );
}


/* ==================================================
   COPIE DES IDENTIFIANTS
================================================== */

async function copierTexteDepart(
  texte,
  libelle
) {
  const valeur =
    String(texte || "").trim();

  if (!valeur) {
    window.alert(
      libelle +
      " non renseigné."
    );

    return;
  }

  try {
    await navigator.clipboard.writeText(
      valeur
    );

    window.alert(
      libelle +
      " copié."
    );

  } catch (erreur) {
    console.error(erreur);

    /*
     * Solution de secours pour les navigateurs
     * qui refusent navigator.clipboard.
     */
    const zone =
      document.createElement(
        "textarea"
      );

    zone.value = valeur;
    zone.style.position = "fixed";
    zone.style.opacity = "0";

    document.body.appendChild(
      zone
    );

    zone.select();

    document.execCommand(
      "copy"
    );

    zone.remove();

    window.alert(
      libelle +
      " copié."
    );
  }
}


/* ==================================================
   DÉTAIL AVEC BOUTONS DE COPIE
================================================== */

function creerChampCopiableDepart(
  label,
  valeur,
  type
) {
  const texte =
    String(valeur || "").trim();

  if (!texte) {
    return creerChampDetailDepart(
      label,
      "Non renseigné"
    );
  }

  return `
    <div class="depart-detail-champ depart-detail-copiable">

      <span>
        ${echapperHTML(label)}
      </span>

      <div class="depart-detail-valeur">

        <strong>
          ${echapperHTML(texte)}
        </strong>

        <button
          class="depart-bouton-copier"
          type="button"
          data-action="copier-identifiant-depart"
          data-type="${echapperHTML(type)}"
          data-valeur="${echapperHTML(texte)}"
        >
          📋 Copier
        </button>

      </div>

    </div>
  `;
}


/* ==================================================
   ÉVÉNEMENTS DE COPIE
================================================== */

function installerEvenementsCopieDepart() {
  document
    .querySelectorAll(
      '[data-action="copier-identifiant-depart"]'
    )
    .forEach(function (bouton) {
      bouton.addEventListener(
        "click",
        function (evenement) {
          evenement.stopPropagation();

          const type =
            bouton.dataset.type ===
            "steam"
              ? "Steam ID"
              : "Discord ID";

          copierTexteDepart(
            bouton.dataset.valeur,
            type
          );
        }
      );
    });
}


function trouverDossierDepart(
  ligne,
  categorie
) {
  const entrees =
    obtenirEntreesCategorieDepart(
      categorie
    );

  return entrees.find(
    function (entree) {
      return Number(entree.ligne) ===
        Number(ligne);
    }
  ) || null;
}


function ouvrirModificationDepart(
  ligne,
  categorie
) {
  const entree =
    trouverDossierDepart(
      ligne,
      categorie
    );

  if (!entree) {
    window.alert(
      "Le dossier est introuvable."
    );

    return;
  }

  const estPermanent =
    entree.permanent === true ||
    normaliserTexteDepartClient(
      entree.statut
    ) === "PERMANENT";

  departWorkspace.innerHTML = `
    <section id="departModule">

      <header class="depart-header">

        <div class="depart-header-titre">

          <h3>
            ✏ MODIFIER LE DOSSIER
          </h3>

          <p>
            ${echapperHTML(entree.nom)}
            — ${echapperHTML(entree.grade)}
          </p>

        </div>

        <button
          id="departAnnulerModification"
          class="depart-bouton-secondaire"
          type="button"
        >
          ← Retour
        </button>

      </header>

      <section class="depart-bloc">

        <form
          id="departFormulaireModification"
          class="depart-formulaire"
        >

          <label class="depart-champ">

            <span>
              Type de dossier
            </span>

            <select
              id="departModificationType"
              required
            >
              <option
                value="Départ"
                ${
                  categorie === "depart"
                    ? "selected"
                    : ""
                }
              >
                Départ
              </option>

              <option
                value="Licenciement"
                ${
                  categorie === "licenciement"
                    ? "selected"
                    : ""
                }
              >
                Licenciement
              </option>

              <option
                value="Blacklist"
                ${
                  categorie === "blacklist"
                    ? "selected"
                    : ""
                }
              >
                Blacklist
              </option>
            </select>

          </label>

          <label class="depart-champ">

            <span>
              Date de départ
            </span>

            <input
              id="departModificationDateDepart"
              type="date"
              lang="fr-FR"
              value="${echapperHTML(
                valeurDateDepartPourChamp(entree.dateDepart)
              )}"
              required
            >

          </label>

          <label class="depart-champ">

            <span>
              Date de retour
            </span>

            <input
              id="departModificationDateRetour"
              type="date"
              lang="fr-FR"
              value="${echapperHTML(
                valeurDateDepartPourChamp(entree.dateRetour)
              )}"
              ${estPermanent ? "disabled" : ""}
            >

          </label>

          <label class="depart-champ">

            <span>
              Statut
            </span>

            <select
              id="departModificationStatut"
              required
            >
              <option
                value="ACTIF"
                ${
                  !estPermanent &&
                  normaliserTexteDepartClient(
                    entree.statut
                  ) !== "RETOUR-AUTORISE"
                    ? "selected"
                    : ""
                }
              >
                Actif
              </option>

              <option
                value="INACTIF"
                ${
                  normaliserTexteDepartClient(
                    entree.statut
                  ) === "RETOUR-AUTORISE"
                    ? "selected"
                    : ""
                }
              >
                Inactif
              </option>

              <option
                value="PERMANENT"
                ${estPermanent ? "selected" : ""}
              >
                Permanent
              </option>
            </select>

          </label>

          <label class="depart-champ depart-champ-raison">

            <span>
              Raison
            </span>

            <textarea
              id="departModificationRaison"
              maxlength="1500"
              required
            >${echapperHTML(
              entree.raison || ""
            )}</textarea>

          </label>

          <div class="depart-formulaire-actions">

            <button
              id="departModificationValider"
              class="depart-bouton-principal"
              type="submit"
            >
              Enregistrer les modifications
            </button>

          </div>

        </form>

        <p
          id="departModificationMessage"
          class="depart-message-formulaire"
        ></p>

      </section>

    </section>
  `;

  const boutonRetour =
    document.getElementById(
      "departAnnulerModification"
    );

  if (boutonRetour) {
    boutonRetour.addEventListener(
      "click",
      afficherCategorieDepart
    );
  }

  const statut =
    document.getElementById(
      "departModificationStatut"
    );

  const dateRetour =
    document.getElementById(
      "departModificationDateRetour"
    );

  if (statut && dateRetour) {
    dateRetour.dataset.valeurConservee = dateRetour.value;
    statut.addEventListener(
      "change",
      function () {
        const permanent =
          statut.value === "PERMANENT";

        dateRetour.disabled =
          permanent;

        if (permanent) {
          if (dateRetour.value) {
            dateRetour.dataset.valeurConservee = dateRetour.value;
          }
          dateRetour.value = "";
        } else if (!dateRetour.value) {
          dateRetour.value = dateRetour.dataset.valeurConservee || "";
        }
      }
    );
  }

  const formulaire =
    document.getElementById(
      "departFormulaireModification"
    );

  if (formulaire) {
    formulaire.addEventListener(
      "submit",
      function (evenement) {
        envoyerModificationDepart(
          evenement,
          entree,
          categorie
        );
      }
    );
  }
}


async function envoyerModificationDepart(
  evenement,
  entree,
  categorie
) {
  evenement.preventDefault();

  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";

  const type =
    document.getElementById(
      "departModificationType"
    ).value;

  const dateDepart =
    document.getElementById(
      "departModificationDateDepart"
    ).value;

  const dateRetour =
    document.getElementById(
      "departModificationDateRetour"
    ).value;

  const statut =
    document.getElementById(
      "departModificationStatut"
    ).value;

  const raison =
    document.getElementById(
      "departModificationRaison"
    ).value.trim();

  const bouton =
    document.getElementById(
      "departModificationValider"
    );

  const message =
    document.getElementById(
      "departModificationMessage"
    );

  bouton.disabled = true;
  bouton.textContent =
    "Enregistrement...";

  try {
    const url =
      DEPART_API_URL +
      "?action=modifierDepart" +
      "&identifiant=" +
      encodeURIComponent(identifiant) +
      "&ligne=" +
      encodeURIComponent(entree.ligne) +
      "&type=" +
      encodeURIComponent(type) +
      "&dateDepart=" +
      encodeURIComponent(dateDepart) +
      "&dateRetour=" +
      encodeURIComponent(dateRetour) +
      "&statut=" +
      encodeURIComponent(statut) +
      "&raison=" +
      encodeURIComponent(raison);

    const reponse =
      await fetch(url);

    const resultat =
      await reponse.json();

    if (!resultat.success) {
      afficherMessageFormulaireDepart(
        message,
        resultat.message ||
          "Impossible de modifier le dossier.",
        true
      );

      return;
    }
afficherMessageFormulaireDepart(
  message,
  resultat.message ||
    "Le dossier a été modifié.",
  false,
  true
);

const nouvelleCategorie =
  obtenirCategorieEntreeDepart({
    type: type
  });

appliquerDonneesDeparts(resultat, false);
categorieDepartOuverte = nouvelleCategorie;
personneDepartOuverte = null;
afficherCategorieDepart();
afficherNotificationGDA(
  resultat.message || "Le dossier a été modifié.",
  "succes"
);

  } catch (erreur) {
    console.error(erreur);

    afficherMessageFormulaireDepart(
      message,
      "Impossible de contacter le serveur.",
      true
    );

  } finally {
    bouton.disabled = false;
    bouton.textContent =
      "Enregistrer les modifications";
  }
}


function confirmerSuppressionDepart(
  ligne,
  categorie
) {
  const entree =
    trouverDossierDepart(
      ligne,
      categorie
    );

  if (!entree) {
    return;
  }

  const confirmation =
    window.confirm(
      "Supprimer définitivement le dossier de " +
      entree.nom +
      " ?"
    );

  if (!confirmation) {
    return;
  }

  supprimerDossierDepart(
    entree
  );
}


async function supprimerDossierDepart(
  entree
) {
  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";

  try {
    const url =
      DEPART_API_URL +
      "?action=supprimerDepart" +
      "&identifiant=" +
      encodeURIComponent(identifiant) +
      "&ligne=" +
      encodeURIComponent(entree.ligne);

    const reponse =
      await fetch(url);

    const resultat =
      await reponse.json();

    if (!resultat.success) {
      window.alert(
        resultat.message ||
          "Impossible de supprimer le dossier."
      );

      return;
    }

    appliquerDonneesDeparts(resultat, false);
    personneDepartOuverte = null;
    if (categorieDepartOuverte) {
      afficherCategorieDepart();
    } else {
      afficherAccueilDeparts();
    }
    afficherNotificationGDA(
      resultat.message || "Dossier supprimé.",
      "succes"
    );

  } catch (erreur) {
    console.error(erreur);

    window.alert(
      "Impossible de contacter le serveur."
    );
  }
}


/* ==================================================
   ERREURS DU MODULE
================================================== */

function afficherErreurDepart(
  message
) {
  departWorkspace.innerHTML = `
    <section id="departModule">

      <div class="
        depart-message
        depart-message-erreur
      ">

        <strong>
          Impossible d’ouvrir le registre
        </strong>

        <span>
          ${echapperHTML(
            message ||
            "Une erreur inconnue est survenue."
          )}
        </span>

        <button
          id="departReessayer"
          class="depart-bouton-secondaire"
          type="button"
        >
          ↻ Réessayer
        </button>

      </div>

    </section>
  `;

  const bouton =
    document.getElementById(
      "departReessayer"
    );

  if (bouton) {
    bouton.addEventListener(
      "click",
      chargerRegistreDeparts
    );
  }
}
