const effectifButton = document.getElementById("effectifButton");
const workspace = document.getElementById("workspace");

const EFFECTIF_API_URL = API_URL;

let effectifMembres = [];
let effectifPeutModifier = false;
let effectifPeutAjouter = false;
let effectifGradesEdition = [];
let effectifSanctionsEdition = [];
let effectifMedaillesEdition = [];
let effectifSpecialisationsEdition = [];
let effectifCharge = false;


effectifButton.addEventListener("click", function () {
  definirModuleGdaActif("effectif-officier");
  if (effectifCharge) {
    afficherEffectif(effectifMembres);
  } else {
    chargerEffectif();
  }
});


async function chargerEffectif() {
  const identifiant =
    sessionStorage.getItem("identifiantUtilisateur") || "";


  // Une requête de préchargement peut déjà être en cours sans que les
  // données soient encore disponibles. Dans ce cas, afficher quand même
  // l'état de chargement afin que le clic donne un retour immédiat.
  if (!effectifCharge) {
    workspace.innerHTML = `
      <section id="effectifModule">
        <div class="effectif-message">
          Chargement de l’effectif...
        </div>
      </section>
    `;
  }

  if (!identifiant) {
    afficherErreurEffectif(
      "Votre session n’est plus valide. Rechargez la page et reconnectez-vous."
    );
    return;
  }

  try {
    const url =
      EFFECTIF_API_URL +
      "?action=recupererEffectif" +
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
      afficherErreurEffectif(
        resultat.message ||
        "Impossible de récupérer l’effectif."
      );
      return;
    }

    effectifMembres = Array.isArray(resultat.membres)
      ? resultat.membres.filter(
          estMembreReelEffectif
        )
      : [];
    effectifPeutModifier =
      resultat.peutModifier === true;
    effectifPeutAjouter =
      resultat.peutAjouter === true;
    effectifGradesEdition =
      Array.isArray(resultat.grades)
        ? resultat.grades
        : [];
    effectifSanctionsEdition =
      Array.isArray(resultat.sanctions)
        ? resultat.sanctions
        : [];
    effectifMedaillesEdition =
      Array.isArray(resultat.medailles)
        ? resultat.medailles
        : [];
    effectifSpecialisationsEdition =
      Array.isArray(resultat.specialisations)
        ? resultat.specialisations
        : [];
    effectifCharge = true;

    afficherEffectif(effectifMembres);

  } catch (erreur) {
    console.error(erreur);

    afficherErreurEffectif(
      erreur.message || "Impossible de contacter le serveur GDA."
    );
  }
}

function synchroniserCacheEffectifGDA(membres) {
  if (!Array.isArray(membres)) return;
  effectifMembres = membres.filter(estMembreReelEffectif);
  effectifCharge = true;
}

function invaliderCacheEffectifGDA() {
  effectifCharge = false;
  if (typeof gdaForcerActualisation === "function") {
    gdaForcerActualisation("recupererEffectif");
  }
}

window.invaliderCacheEffectifGDA = invaliderCacheEffectifGDA;


function afficherEffectif(membres) {
  if (!moduleGdaEstActif("effectif-officier")) return;
  const groupes = {
    "officiers-superieurs": [],
    "officiers": [],
    "sous-officiers": [],
    "hommes-du-rang": []
  };

  membres.forEach(function (membre) {
    const categorie =
      obtenirCategorieGrade(membre.grade);

    groupes[categorie].push(membre);
  });

  workspace.innerHTML = `
    <section id="effectifModule">

      <div class="effectif-header">

        <div>
          <h3 class="effectif-header-title">
            EFFECTIF GLOBAL
          </h3>

          <p class="effectif-header-subtitle">
            Liste officielle des membres de la Garde de l’Administration
          </p>
        </div>

        <div class="effectif-header-actions">
          <div
            class="effectif-compteur"
            aria-label="${membres.length} GDA sur 35 maximum"
          >
            <strong>${membres.length}</strong>
            <span>/ 35 GDA</span>
          </div>

          ${effectifPeutAjouter ? `
            <button
              class="effectif-edit-button"
              id="effectifAjouter"
              type="button"
            >
              ＋ Ajouter un GDA
            </button>
          ` : ""}

          <button
            class="effectif-refresh"
            id="effectifRefresh"
            type="button"
          >
            ↻ Actualiser
          </button>
        </div>

      </div>

      ${creerSectionEffectif(
        "Officiers supérieurs GDA",
        "officiers-superieurs",
        groupes["officiers-superieurs"]
      )}

      ${creerSectionEffectif(
        "Officiers GDA",
        "officiers",
        groupes["officiers"]
      )}

      ${creerSectionEffectif(
        "Sous-officiers GDA",
        "sous-officiers",
        groupes["sous-officiers"]
      )}

      ${creerSectionEffectif(
        "Hommes du rang GDA",
        "hommes-du-rang",
        groupes["hommes-du-rang"]
      )}

    </section>
  `;

  const refreshButton =
    document.getElementById("effectifRefresh");

  const ajouterButton =
    document.getElementById("effectifAjouter");

  if (ajouterButton) {
    ajouterButton.addEventListener("click", ouvrirAjoutMembreEffectif);
  }

  if (refreshButton) {
    refreshButton.addEventListener(
      "click",
      function() {
        if (typeof gdaForcerActualisation === "function") {
          gdaForcerActualisation("recupererEffectif");
        }
        chargerEffectif();
      }
    );
  }

  document
    .querySelectorAll(".effectif-member")
    .forEach(function (ligne) {
      ligne.addEventListener("click", function () {
        const index = Number(
          ligne.dataset.index
        );

        ouvrirFicheMembre(index);
      });

      ligne.addEventListener("keydown", function (event) {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();

          const index = Number(
            ligne.dataset.index
          );

          ouvrirFicheMembre(index);
        }
      });
    });
}

function ouvrirAjoutMembreEffectif() {
  if (!effectifPeutAjouter) return;

  const maintenant = new Date();
  const dateEntree = [
    String(maintenant.getDate()).padStart(2, "0"),
    String(maintenant.getMonth() + 1).padStart(2, "0"),
    maintenant.getFullYear()
  ].join("/");

  workspace.innerHTML = `
    <section id="effectifModule">
      <div class="effectif-header">
        <div>
          <h3 class="effectif-header-title">AJOUTER UN NOUVEAU GDA</h3>
          <p class="effectif-header-subtitle">
            Création directe d’une nouvelle ligne conforme dans l’effectif
          </p>
        </div>
        <button id="effectifAjoutAnnulerHaut" class="effectif-refresh" type="button">
          ← Annuler
        </button>
      </div>

      <form id="effectifAjoutForm" class="effectif-edition-form">
        ${creerChampEditionEffectif("Nom / matricule", "nom", "", "text", true)}

        <label class="effectif-edition-champ">
          <span>Grade</span>
          <select name="grade" required>
            <option value="">Sélectionner un grade</option>
            ${effectifGradesEdition.map(function (grade) {
              return `<option value="${echapperHTML(grade)}">${echapperHTML(grade)}</option>`;
            }).join("")}
          </select>
        </label>

        ${creerChampEditionEffectif("Steam ID", "steamId", "", "text", true)}
        ${creerChampEditionEffectif("Discord ID", "discordId", "", "text", true)}
        ${creerChampEditionEffectif(
          "Date d’entrée chez les GDA",
          "dateEntree",
          dateEntree,
          "date-fr",
          true
        )}
        ${creerSelecteurMultipleEffectif(
          "Spécialisation(s)",
          "specialisation",
          effectifSpecialisationsEdition,
          ""
        )}
        ${creerSelecteurMultipleEffectif(
          "Médaille(s)",
          "medaille",
          effectifMedaillesEdition,
          ""
        )}

        <div class="effectif-edition-actions">
          <button id="effectifAjoutAnnuler" class="effectif-note-delete" type="button">
            Annuler
          </button>
          <button id="effectifAjoutEnregistrer" class="effectif-refresh" type="submit">
            Ajouter le nouveau GDA
          </button>
        </div>
        <p id="effectifAjoutMessage" role="status"></p>
      </form>
    </section>
  `;

  const annuler = function () { afficherEffectif(effectifMembres); };
  document.getElementById("effectifAjoutAnnulerHaut").addEventListener("click", annuler);
  document.getElementById("effectifAjoutAnnuler").addEventListener("click", annuler);
  document.getElementById("effectifAjoutForm").addEventListener(
    "submit",
    enregistrerAjoutMembreEffectif
  );
  initialiserSelecteursMultiplesEffectif();
}

async function enregistrerAjoutMembreEffectif(event) {
  event.preventDefault();
  const formulaire = event.currentTarget;
  const bouton = document.getElementById("effectifAjoutEnregistrer");
  const message = document.getElementById("effectifAjoutMessage");
  const parametres = new URLSearchParams();
  parametres.set("action", "ajouterMembreEffectif");
  parametres.set(
    "identifiant",
    sessionStorage.getItem("identifiantUtilisateur") || ""
  );

  try {
    new FormData(formulaire).forEach(function (valeur, cle) {
      const texte = String(valeur).trim();
      parametres.set(
        cle,
        cle === "dateEntree"
          ? convertirDateFrancaiseVersISOEffectif(texte)
          : texte
      );
    });
  } catch (erreur) {
    message.className = "effectif-edition-erreur";
    message.textContent = erreur.message;
    return;
  }

  bouton.disabled = true;
  bouton.textContent = "Ajout en cours...";
  message.className = "";
  message.textContent = "Vérification des informations...";

  try {
    const reponse = await fetch(EFFECTIF_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: parametres.toString()
    });
    const resultat = await reponse.json();
    if (!resultat.success) {
      throw new Error(resultat.message || "Impossible d’ajouter ce GDA.");
    }
    if (resultat.membre) {
      effectifMembres.push(resultat.membre);
    }
    afficherEffectif(effectifMembres);
    afficherNotificationGDA(resultat.message || "Nouveau GDA ajouté.", "succes");
  } catch (erreur) {
    console.error(erreur);
    bouton.disabled = false;
    bouton.textContent = "Ajouter le nouveau GDA";
    message.className = "effectif-edition-erreur";
    message.textContent = erreur.message;
  }
}


function estMembreReelEffectif(membre) {
  const nom = normaliserTexteEffectif(
    membre && membre.nom
  );

  if (!nom) {
    return false;
  }

  return !(
    nom.includes("OFFICIERS-GDA") ||
    nom.includes("SOUS-OFFICIERS-GDA") ||
    nom.includes("HOMMES-DU-RANG-GDA")
  );
}


function creerSectionEffectif(
  titre,
  classeSection,
  membres
) {
  if (!membres.length) {
    return "";
  }

  const lignes = membres
    .map(function (membre) {
      const indexGlobal =
        effectifMembres.indexOf(membre);

      return creerLigneMembre(
        membre,
        indexGlobal
      );
    })
    .join("");

  return `
    <section class="effectif-section ${classeSection}">

      <h4 class="effectif-section-title">
        ${echapperHTML(titre)}

        <span>
          ${membres.length}
          membre${membres.length > 1 ? "s" : ""}
        </span>
      </h4>

      <div class="effectif-list">
        ${lignes}
      </div>

    </section>
  `;
}


function creerLigneMembre(membre, index) {
  const classeGrade =
    obtenirClasseGrade(membre.grade);
  const iconeGrade =
    obtenirIconeGradeEffectif(membre.grade);

  return `
    <article
      class="effectif-member"
      data-index="${index}"
      tabindex="0"
      role="button"
      aria-label="Voir la fiche de ${echapperHTML(membre.nom)}"
    >

      <div class="effectif-identite-groupe">
        <div class="effectif-grade-groupe">
          <img
            class="effectif-grade-icone"
            src="${iconeGrade}"
            alt="Insigne ${echapperHTML(
              membre.grade || "grade inconnu"
            )}"
            loading="lazy"
          >
          <span class="effectif-grade ${classeGrade}">
            ${echapperHTML(
              membre.grade || "Grade non renseigné"
            )}
          </span>
        </div>

        <div class="effectif-name">
          ${echapperHTML(membre.nom || "Sans nom")}
        </div>
      </div>

      <div class="effectif-badges">
        ${membre.enPeriodeProbatoire
          ? creerBadgesListe("Période probatoire", "probatoire")
          : ""}
        ${creerBadgesListe(
          membre.presence,
          "presence"
        )}
      </div>

      <div class="effectif-specialisation">
        <span class="effectif-info-label">
          Spécialisation
        </span>

        <div class="effectif-badges">
          ${creerBadgesListe(
            membre.specialisation,
            "specialisation"
          )}
        </div>
      </div>

    </article>
  `;
}


function ouvrirFicheMembre(index) {
  const membre = effectifMembres[index];

  if (!membre) {
    return;
  }

  workspace.innerHTML = `
    <section id="effectifModule">

      <div class="effectif-header">

        <div>
          <h3 class="effectif-header-title">
            ${echapperHTML(membre.nom)}
          </h3>

          <p class="effectif-header-subtitle">
            Fiche individuelle
          </p>
        </div>

        <div class="effectif-header-actions">
          ${effectifPeutModifier
            ? `
              <button
                id="effectifModifier"
                class="effectif-edit-button"
                type="button"
              >
                ✎ Modifier
              </button>
            `
            : ""}

          <button
            id="effectifRetour"
            class="effectif-refresh"
            type="button"
          >
            ← Retour
          </button>
        </div>

      </div>

      <div class="effectif-fiche">

        ${creerChampGradeFiche(membre.grade)}

        ${creerChampBadgesFiche(
          "Présence",
          membre.presence,
          "presence"
        )}

        ${creerChampBadgesFiche(
          "Spécialisation",
          membre.specialisation,
          "specialisation"
        )}

        ${creerChampFiche(
          "Steam ID",
          membre.steamId
        )}

        ${creerChampFiche(
          "Discord ID",
          membre.discordId
        )}

        ${creerChampFiche(
          "Nombre de rapports",
          membre.nombreRapports
        )}

        ${creerChampFiche(
          "Observation",
          membre.observation
        )}

        ${creerChampFiche(
          "Date de promotion / rétrogradation",
          formaterDateEffectif(
            membre.datePromotionRetro
          )
        )}

        ${creerChampFiche(
          "Date d’entrée",
          formaterDateEffectif(
            membre.dateEntree
          )
        )}

        ${creerChampBadgesFiche(
          "Sanction",
          membre.sanction,
          "sanction"
        )}

        ${creerChampFiche(
          "Recommandation",
          membre.recommandation
        )}

        ${creerChampBadgesFiche(
          "Médaille",
          membre.medaille,
          "medaille"
        )}

      </div>
            <section class="effectif-notes">

        <h4>
          Notes partagées
        </h4>

        <p>
          Cette note est visible et modifiable par tous les utilisateurs autorisés.
        </p>

        <textarea
          id="effectifNoteTexte"
          maxlength="3000"
          placeholder="Ajouter une note..."
        >${echapperHTML(membre.notes || "")}</textarea>

        <div class="effectif-notes-actions">

          <button
            id="effectifNoteEnregistrer"
            class="effectif-refresh"
            type="button"
          >
            Enregistrer
          </button>

          <button
            id="effectifNoteEffacer"
            class="effectif-note-delete"
            type="button"
          >
            Effacer
          </button>

        </div>

        <p id="effectifNoteMessage"></p>

      </section>

    </section>
  `;

  const retourButton =
    document.getElementById("effectifRetour");

  if (retourButton) {
    retourButton.addEventListener(
      "click",
      function () {
        afficherEffectif(effectifMembres);
      }
    );
  }

  const modifierButton =
    document.getElementById("effectifModifier");

  if (modifierButton) {
    modifierButton.addEventListener(
      "click",
      function () {
        ouvrirEditionMembre(membre, index);
      }
    );
  }

  const enregistrerButton =
    document.getElementById(
      "effectifNoteEnregistrer"
    );

  if (enregistrerButton) {
    enregistrerButton.addEventListener(
      "click",
      function () {
        enregistrerNoteMembre(
          membre,
          false
        );
      }
    );
  }

  const effacerButton =
    document.getElementById(
      "effectifNoteEffacer"
    );

  if (effacerButton) {
    effacerButton.addEventListener(
      "click",
      function () {
        enregistrerNoteMembre(
          membre,
          true
        );
      }
    );
  }
}


function ouvrirEditionMembre(membre, index) {
  if (!effectifPeutModifier || !membre) {
    return;
  }

  const grades = effectifGradesEdition.slice();
  if (
    membre.grade &&
    !grades.some(function (grade) {
      return normaliserTexteEffectif(grade) ===
        normaliserTexteEffectif(membre.grade);
    })
  ) {
    grades.push(membre.grade);
  }

  workspace.innerHTML = `
    <section id="effectifModule">
      <div class="effectif-header">
        <div>
          <h3 class="effectif-header-title">
            MODIFIER — ${echapperHTML(membre.nom)}
          </h3>
          <p class="effectif-header-subtitle">
            Modification directe de la ligne dans Effectif Global
          </p>
        </div>

        <button
          id="effectifEditionAnnulerHaut"
          class="effectif-refresh"
          type="button"
        >
          ← Annuler
        </button>
      </div>

      <form id="effectifEditionForm" class="effectif-edition-form">
        ${creerChampEditionEffectif(
          "Nom / matricule",
          "nom",
          membre.nom,
          "text",
          true
        )}

        <label class="effectif-edition-champ">
          <span>Grade</span>
          <select name="grade" required>
            ${grades.map(function (grade) {
              const selectionne =
                normaliserTexteEffectif(grade) ===
                normaliserTexteEffectif(membre.grade);
              return `
                <option value="${echapperHTML(grade)}"${selectionne ? " selected" : ""}>
                  ${echapperHTML(grade)}
                </option>
              `;
            }).join("")}
          </select>
        </label>

        ${creerChampEditionEffectif(
          "Steam ID",
          "steamId",
          membre.steamId,
          "text"
        )}
        ${creerChampEditionEffectif(
          "Discord ID",
          "discordId",
          membre.discordId,
          "text"
        )}
        ${creerChampEditionEffectif(
          "Date de promotion / rétrogradation",
          "datePromotionRetro",
          formaterDateEffectifPourChamp(
            membre.datePromotionRetro
          ),
          "date-fr"
        )}
        ${creerChampEditionEffectif(
          "Date d’entrée chez les GDA",
          "dateEntree",
          formaterDateEffectifPourChamp(
            membre.dateEntree
          ),
          "date-fr"
        )}
        ${creerSelecteurMultipleEffectif(
          "Spécialisation(s)",
          "specialisation",
          effectifSpecialisationsEdition,
          membre.specialisation
        )}
        ${creerSelecteurUniqueEffectif(
          "Sanction",
          "sanction",
          effectifSanctionsEdition,
          membre.sanction
        )}
        ${creerSelecteurMultipleEffectif(
          "Médaille(s)",
          "medaille",
          effectifMedaillesEdition,
          membre.medaille
        )}
        ${creerZoneEditionEffectif(
          "Recommandation(s)",
          "recommandation",
          membre.recommandation
        )}
        ${creerZoneEditionEffectif(
          "Observation",
          "observation",
          membre.observation,
          true
        )}

        <div class="effectif-edition-actions">
          <button
            id="effectifEditionAnnuler"
            class="effectif-note-delete"
            type="button"
          >
            Annuler
          </button>
          <button
            id="effectifEditionEnregistrer"
            class="effectif-refresh"
            type="submit"
          >
            Enregistrer les modifications
          </button>
        </div>

        <p id="effectifEditionMessage" role="status"></p>
      </form>
    </section>
  `;

  const annuler = function () {
    ouvrirFicheMembre(index);
  };

  document
    .getElementById("effectifEditionAnnulerHaut")
    .addEventListener("click", annuler);
  document
    .getElementById("effectifEditionAnnuler")
    .addEventListener("click", annuler);
  document
    .getElementById("effectifEditionForm")
    .addEventListener("submit", function (event) {
      enregistrerModificationsEffectif(
        event,
        membre,
        index
      );
    });

  initialiserSelecteursMultiplesEffectif();
}


function creerChampEditionEffectif(
  label,
  nom,
  valeur,
  type,
  requis
) {
  const estDateFrancaise =
    type === "date-fr";

  return `
    <label class="effectif-edition-champ">
      <span>${echapperHTML(label)}</span>
      <input
        type="${estDateFrancaise ? "text" : type}"
        name="${nom}"
        value="${echapperHTML(valeur || "")}"
        maxlength="160"
        ${estDateFrancaise
          ? 'inputmode="numeric" placeholder="jj/mm/aaaa" pattern="(?:\\d{2}/\\d{2}/\\d{4})?"'
          : ""}
        ${requis ? "required" : ""}
      >
    </label>
  `;
}

function creerSelecteurUniqueEffectif(label, nom, choix, valeurActuelle) {
  const valeur = String(valeurActuelle || "").trim();
  const liste = Array.isArray(choix) ? choix.slice() : [];
  const valeurNormalisee = normaliserTexteEffectif(valeur);
  const equivautAucuneSanction =
    !valeurNormalisee ||
    valeurNormalisee === "CLEAN" ||
    valeurNormalisee === "N/A" ||
    valeurNormalisee === "NA" ||
    valeurNormalisee === "AUCUNE" ||
    valeurNormalisee === "AUCUNE SANCTION" ||
    valeurNormalisee === "NON RENSEIGNE";
  const valeurConnue = equivautAucuneSanction || liste.some(function (option) {
    return normaliserTexteEffectif(option) === normaliserTexteEffectif(valeur);
  });

  return `
    <label class="effectif-edition-champ">
      <span>${echapperHTML(label)}</span>
      <select name="${echapperHTML(nom)}">
        <option value=""${equivautAucuneSanction ? " selected" : ""}>Aucune sanction</option>
        ${!valeurConnue && valeur
          ? `<option value="" selected>Anciennes sanctions multiples — choisissez une valeur</option>`
          : ""}
        ${liste.map(function (option) {
          const selectionnee =
            !equivautAucuneSanction &&
            normaliserTexteEffectif(option) === valeurNormalisee;
          return `
            <option value="${echapperHTML(option)}"${selectionnee ? " selected" : ""}>
              ${echapperHTML(option)}
            </option>
          `;
        }).join("")}
      </select>
    </label>
  `;
}


function creerSelecteurMultipleEffectif(
  label,
  nom,
  choix,
  valeurActuelle
) {
  const selection =
    decouperValeursEffectif(valeurActuelle);
  const liste = Array.isArray(choix)
    ? choix.slice()
    : [];

  selection.forEach(function (valeur) {
    if (!liste.some(function (choixExistant) {
      return normaliserTexteEffectif(choixExistant) ===
        normaliserTexteEffectif(valeur);
    })) {
      liste.push(valeur);
    }
  });

  const estSelectionne = function (valeur) {
    return selection.some(function (selectionActuelle) {
      return normaliserTexteEffectif(selectionActuelle) ===
        normaliserTexteEffectif(valeur);
    });
  };

  return `
    <fieldset
      class="effectif-edition-champ effectif-selecteur-multiple"
      data-effectif-multi
    >
      <span>${echapperHTML(label)}</span>
      <details>
        <summary>
          <span data-effectif-multi-resume>
            ${selection.length
              ? echapperHTML(selection.join(", "))
              : "Aucun choix"}
          </span>
          <b aria-hidden="true">▾</b>
        </summary>

        <div class="effectif-options-multiples">
          ${liste.map(function (valeur) {
            return `
              <label>
                <input
                  type="checkbox"
                  value="${echapperHTML(valeur)}"
                  ${estSelectionne(valeur) ? "checked" : ""}
                >
                <span>${echapperHTML(valeur)}</span>
              </label>
            `;
          }).join("")}
        </div>
      </details>

      <input
        type="hidden"
        name="${nom}"
        value="${echapperHTML(selection.join("; "))}"
        data-effectif-multi-valeur
      >
    </fieldset>
  `;
}


function initialiserSelecteursMultiplesEffectif() {
  document
    .querySelectorAll("[data-effectif-multi]")
    .forEach(function (bloc) {
      const cases = Array.from(
        bloc.querySelectorAll('input[type="checkbox"]')
      );
      const cache = bloc.querySelector(
        "[data-effectif-multi-valeur]"
      );
      const resume = bloc.querySelector(
        "[data-effectif-multi-resume]"
      );

      const synchroniser = function () {
        const selection = cases
          .filter(caseChoix => caseChoix.checked)
          .map(caseChoix => caseChoix.value);

        cache.value = selection.join("; ");
        resume.textContent = selection.length
          ? selection.join(", ")
          : "Aucun choix";
      };

      cases.forEach(function (caseChoix) {
        caseChoix.addEventListener(
          "change",
          synchroniser
        );
      });
      synchroniser();
    });
}


function creerZoneEditionEffectif(
  label,
  nom,
  valeur,
  large
) {
  return `
    <label class="effectif-edition-champ${large ? " effectif-edition-large" : ""}">
      <span>${echapperHTML(label)}</span>
      <textarea
        name="${nom}"
        maxlength="3000"
        rows="3"
      >${echapperHTML(valeur || "")}</textarea>
    </label>
  `;
}


async function enregistrerModificationsEffectif(
  event,
  membre,
  index
) {
  event.preventDefault();

  const form = event.currentTarget;
  const bouton = document.getElementById(
    "effectifEditionEnregistrer"
  );
  const message = document.getElementById(
    "effectifEditionMessage"
  );
  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";
  const donnees = new FormData(form);
  const parametres = new URLSearchParams();

  parametres.set("action", "modifierMembreEffectif");
  parametres.set("identifiant", identifiant);
  parametres.set("personne", membre.nom);

  try {
    donnees.forEach(function (valeur, cle) {
      const texte = String(valeur).trim();
      const estDate =
        cle === "datePromotionRetro" ||
        cle === "dateEntree";

      parametres.set(
        cle,
        estDate
          ? convertirDateFrancaiseVersISOEffectif(texte)
          : texte
      );
    });
  } catch (erreur) {
    message.className = "effectif-edition-erreur";
    message.textContent = erreur.message;
    return;
  }

  bouton.disabled = true;
  message.className = "";
  message.textContent = "Enregistrement en cours...";

  try {
    const reponse = await fetch(EFFECTIF_API_URL, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: parametres.toString()
    });
    const resultat = await reponse.json();

    if (!resultat.success) {
      throw new Error(
        resultat.message ||
        "Impossible d’enregistrer les modifications."
      );
    }

    if (resultat.nouvelIdentifiantAuteur) {
      sessionStorage.setItem(
        "identifiantUtilisateur",
        resultat.nouvelIdentifiantAuteur
      );
      sessionStorage.setItem(
        "nomUtilisateur",
        resultat.nouvelIdentifiantAuteur
      );
    }

    if (resultat.gradeAuteur) {
      sessionStorage.setItem(
        "gradeUtilisateur",
        resultat.gradeAuteur
      );
    }

    if (typeof resultat.specialisationAuteur === "string") {
      sessionStorage.setItem(
        "specialisationUtilisateur",
        resultat.specialisationAuteur
      );
      if (typeof appliquerVisibiliteModulesGDA === "function") {
        appliquerVisibiliteModulesGDA();
      }
    }

    effectifPeutModifier =
      resultat.peutModifier === true;

    if (resultat.membre) {
      effectifMembres[index] = resultat.membre;
    }

    ouvrirFicheMembre(index);
  } catch (erreur) {
    console.error(erreur);
    bouton.disabled = false;
    message.className = "effectif-edition-erreur";
    message.textContent = erreur.message;
  }
}


function creerChampFiche(label, valeur) {
  return `
    <div class="effectif-fiche-champ">

      <span class="effectif-fiche-label">
        ${echapperHTML(label)}
      </span>

      <span class="effectif-fiche-valeur">
        ${echapperHTML(
          valeur || "Non renseigné"
        )}
      </span>

    </div>
  `;
}


function creerChampGradeFiche(grade) {
  const iconeGrade =
    obtenirIconeGradeEffectif(grade);

  return `
    <div class="effectif-fiche-champ">
      <span class="effectif-fiche-label">
        Grade
      </span>

      <span class="effectif-fiche-grade">
        <img
          class="effectif-grade-icone effectif-grade-icone-fiche"
          src="${iconeGrade}"
          alt="Insigne ${echapperHTML(
            grade || "grade inconnu"
          )}"
        >
        <strong>${echapperHTML(
          grade || "Non renseigné"
        )}</strong>
      </span>
    </div>
  `;
}


function creerChampBadgesFiche(
  label,
  valeur,
  type
) {
  return `
    <div class="effectif-fiche-champ">

      <span class="effectif-fiche-label">
        ${echapperHTML(label)}
      </span>

      <div class="effectif-badges">
        ${creerBadgesListe(
          valeur,
          type
        )}
      </div>

    </div>
  `;
}


async function enregistrerNoteMembre(
  membre,
  effacer
) {
  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";

  const textarea =
    document.getElementById(
      "effectifNoteTexte"
    );

  const message =
    document.getElementById(
      "effectifNoteMessage"
    );

  if (
    !textarea ||
    !message
  ) {
    return;
  }

  const nouvelleNote =
    effacer
      ? ""
      : textarea.value.trim();

  message.textContent =
    effacer
      ? "Effacement en cours..."
      : "Enregistrement en cours...";

  textarea.disabled = true;

  try {
    const url =
      EFFECTIF_API_URL +
      "?action=enregistrerNote" +
      "&identifiant=" +
      encodeURIComponent(identifiant) +
      "&personne=" +
      encodeURIComponent(membre.nom) +
      "&note=" +
      encodeURIComponent(nouvelleNote);

    const reponse = await fetch(url);

    if (!reponse.ok) {
      throw new Error(
        "Erreur serveur : " + reponse.status
      );
    }

    const resultat = await reponse.json();

    if (!resultat.success) {
      message.textContent =
        resultat.message ||
        "Impossible d’enregistrer la note.";

      return;
    }

    membre.notes = nouvelleNote;
    textarea.value = nouvelleNote;

    message.textContent =
      resultat.message ||
      "Modification enregistrée.";

  } catch (erreur) {
    console.error(erreur);

    message.textContent =
      "Impossible de contacter le serveur GDA.";

  } finally {
    textarea.disabled = false;
  }
}


function afficherErreurEffectif(message) {
  if (!moduleGdaEstActif("effectif-officier")) return;
  workspace.innerHTML = `
    <section id="effectifModule">

      <div class="effectif-message effectif-error">
        ${echapperHTML(message)}
      </div>

    </section>
  `;
}


function creerBadgesListe(valeur, type) {
  const elements =
    decouperValeursEffectif(valeur);

  if (!elements.length) {
    return `
      <span class="effectif-badge badge-vide">
        Non renseigné
      </span>
    `;
  }

  return elements
    .map(function (element) {
      const classe =
        obtenirClasseBadge(
          element,
          type
        );

      const emoji = type === "medaille"
        ? ""
        : obtenirEmojiBadge(element, type);

      const ruban =
        type === "medaille"
          ? creerRubanMedaille(element)
          : "";

      return `
        <span class="effectif-badge ${classe}">
          ${ruban}

          ${emoji
            ? `<span class="effectif-badge-emoji">${emoji}</span>`
            : ""}

          <span class="effectif-badge-texte">
            ${echapperHTML(element)}
          </span>
        </span>
      `;
    })
    .join("");
}

function obtenirEmojiBadge(texte, type) {
  const normalise =
    normaliserTexteEffectif(texte);

  if (type === "probatoire") {
    return "⏳";
  }

  if (type === "medaille") {
    if (normalise.includes("BRAVOURE")) {
      return "⚔️";
    }

    if (normalise.includes("MERITE")) {
      return "🏅";
    }

    if (normalise.includes("ACTIVITE")) {
      return "🎖️";
    }

    if (normalise.includes("ANCIENNETE")) {
      return "⏳";
    }

    if (normalise.includes("VETERAN")) {
      return "🌿";
    }

    if (normalise.includes("DEFENSE")) {
      return "🛡️";
    }

    if (normalise.includes("MEDECIN")) {
      return "⚕️";
    }

    if (normalise.includes("GSPR")) {
      return "🛡️";
    }

    if (normalise.includes("INSTRUCTEUR")) {
      return "🎓";
    }

    if (normalise.includes("ANCIEN-GERANT")) {
      return "👑";
    }

    return "🏆";
  }

  if (type === "specialisation") {
    if (normalise.includes("MEDECIN")) {
      return "🩺";
    }

    if (normalise.includes("INSTRUCTEUR")) {
      return "🎓";
    }

    if (normalise.includes("RESPONSABLE")) {
      return "📋";
    }

    if (normalise.includes("GERANT")) {
      return "🗂️";
    }

    if (normalise.includes("RECRUTEMENT")) {
      return "👥";
    }

    if (normalise.includes("LOGISTIQUE")) {
      return "📦";
    }

    return "⚙️";
  }

  if (type === "presence") {
    if (
      normalise === "PRESENT" ||
      normalise === "PRESENTE"
    ) {
      return "●";
    }

    if (
      normalise === "ABSENT" ||
      normalise === "ABSENTE"
    ) {
      return "●";
    }
  }

  if (type === "sanction") {
    if (
      normalise === "CLEAN" ||
      normalise === "AUCUNE" ||
      normalise === "RAS" ||
      normalise === "N/A"
    ) {
      return "✓";
    }

    return "⚠";
  }

  return "";
}

function creerRubanMedaille(texte) {
  const normalise =
    normaliserTexteEffectif(texte);

  let classeRuban =
    "ruban-medaille-standard";

  if (normalise.includes("BRAVOURE")) {
    classeRuban =
      "ruban-medaille-bravoure";
  } else if (
    normalise.includes("MERITE")
  ) {
    classeRuban =
      "ruban-medaille-merite";
  } else if (
    normalise.includes("ACTIVITE")
  ) {
    classeRuban =
      "ruban-medaille-activite";
  } else if (
    normalise.includes("ANCIENNETE")
  ) {
    classeRuban =
      "ruban-medaille-anciennete";
  } else if (
    normalise.includes("VETERAN")
  ) {
    classeRuban =
      "ruban-medaille-veteran";
  } else if (
    normalise.includes("DEFENSE")
  ) {
    classeRuban =
      "ruban-medaille-defense";
  } else if (
    normalise.includes("MEDECIN")
  ) {
    classeRuban =
      "ruban-medaille-medecin";
  } else if (
    normalise.includes("GSPR")
  ) {
    classeRuban =
      "ruban-medaille-gspr";
  } else if (
    normalise.includes("INSTRUCTEUR")
  ) {
    classeRuban =
      "ruban-medaille-instructeur";
  } else if (
    normalise.includes("ANCIEN-GERANT")
  ) {
    classeRuban =
      "ruban-medaille-gerant";
  }

  return `
    <span
      class="ruban-medaille ${classeRuban}"
      aria-hidden="true"
    ></span>
  `;
}

function decouperValeursEffectif(valeur) {
  return String(valeur || "")
    .split(/[,;\n]+/)
    .map(function (element) {
      return element.trim();
    })
    .filter(Boolean);
}


function obtenirClasseBadge(valeur, type) {
  const normalise =
    normaliserTexteEffectif(valeur);

  if (type === "probatoire") {
    return "badge-periode-probatoire";
  }

  if (type === "presence") {
    if (
      normalise === "PRESENT" ||
      normalise === "PRESENTE"
    ) {
      return "badge-presence-present";
    }

    if (
      normalise === "ABSENT" ||
      normalise === "ABSENTE"
    ) {
      return "badge-presence-absent";
    }

    return "badge-neutre";
  }

  if (type === "sanction") {
    if (
      normalise === "CLEAN" ||
      normalise === "AUCUNE" ||
      normalise === "RAS" ||
      normalise === "N/A" ||
      normalise === "NEANT"
    ) {
      return "badge-sanction-clean";
    }

    if (
      normalise.includes("BLAME") ||
      normalise.includes("SANCTION") ||
      normalise.includes("AVERT") ||
      normalise.includes("RETRO")
    ) {
      return "badge-sanction-alerte";
    }

    return "badge-neutre";
  }

  if (type === "medaille") {
    if (
      normalise.includes("MERITE")
    ) {
      return "badge-medaille-merite";
    }

    if (
      normalise.includes("HONNEUR") ||
      normalise.includes("DISTINCTION")
    ) {
      return "badge-medaille-honneur";
    }

    if (
      normalise.includes("BRAVOURE") ||
      normalise.includes("COURAGE")
    ) {
      return "badge-medaille-bravoure";
    }

    return classeCouleurStable_(
      normalise,
      "medaille"
    );
  }

  if (type === "specialisation") {
    if (
      normalise.includes("MEDECIN")
    ) {
      return "badge-specialisation-medecin";
    }

    if (
      normalise.includes("INSTRUCTEUR")
    ) {
      return "badge-specialisation-instructeur";
    }

    if (
      normalise.includes("RESPONSABLE")
    ) {
      return "badge-specialisation-responsable";
    }

    if (
      normalise.includes("GERANT")
    ) {
      return "badge-specialisation-gerant";
    }

    return classeCouleurStable_(
      normalise,
      "specialisation"
    );
  }

  return "badge-neutre";
}


function classeCouleurStable_(
  texte,
  prefixe
) {
  let total = 0;

  for (
    let index = 0;
    index < texte.length;
    index++
  ) {
    total += texte.charCodeAt(index);
  }

  const numero =
    total % 6 + 1;

  return (
    prefixe +
    "-couleur-" +
    numero
  );
}
function obtenirCategorieGrade(grade) {
  const normalise =
    normaliserTexteEffectif(grade);

  if (
    [
      "LIEUTENANT-COLONEL",
      "COMMANDANT",
      "VICE-COMMANDANT"
    ].includes(normalise)
  ) {
    return "officiers-superieurs";
  }

  if (
    [
      "CAPITAINE",
      "LIEUTENANT",
      "SOUS-LIEUTENANT",
      "ASPIRANT"
    ].includes(normalise)
  ) {
    return "officiers";
  }

  if (
    [
      "MAJOR",
      "ADJUDANT-CHEF",
      "ADJUDANT",
      "SERGENT-CHEF",
      "SERGENT"
    ].includes(normalise)
  ) {
    return "sous-officiers";
  }

  return "hommes-du-rang";
}


function obtenirIconeGradeEffectif(grade) {
  const gradeNormalise =
    normaliserTexteEffectif(grade)
      .replace(/\./g, "")
      .replace(/_/g, "-")
      .replace(/[’']/g, "-")
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


function obtenirClasseGrade(grade) {
  const categorie =
    obtenirCategorieGrade(grade);

  if (
    categorie ===
    "officiers-superieurs"
  ) {
    return "grade-superieur";
  }

  if (
    categorie ===
    "officiers"
  ) {
    return "grade-officier";
  }

  if (
    categorie ===
    "sous-officiers"
  ) {
    return "grade-sous-officier";
  }

  return "grade-rang";
}


function obtenirClasseStatut(statut) {
  const normalise =
    normaliserTexteEffectif(statut);

  if (
    normalise === "PRESENT" ||
    normalise === "PRESENTE"
  ) {
    return "status-present";
  }

  if (
    normalise === "ABSENT" ||
    normalise === "ABSENTE"
  ) {
    return "status-absent";
  }

  return "status-inconnu";
}


function normaliserTexteEffectif(texte) {
  return String(texte || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/’/g, "'")
    .replace(
      /[–—]/g,
      "-"
    )
    .replace(
      /\s*-\s*/g,
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


function formaterDateEffectifPourChamp(valeur) {
  const texte = String(valeur || "").trim();
  if (!texte) return "";

  const iso = texte.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );
  if (iso) {
    return iso[3] + "/" + iso[2] + "/" + iso[1];
  }

  return /^(\d{2})\/(\d{2})\/(\d{4})$/.test(texte)
    ? texte
    : "";
}


function formaterDateEffectif(valeur) {
  return formaterDateHeureGDA(valeur, "Non renseignée");
}


function convertirDateFrancaiseVersISOEffectif(valeur) {
  const texte = String(valeur || "").trim();
  if (!texte) return "";

  const correspondance = texte.match(
    /^(\d{2})\/(\d{2})\/(\d{4})$/
  );

  if (!correspondance) {
    throw new Error(
      "Les dates doivent être saisies au format jj/mm/aaaa."
    );
  }

  const jour = Number(correspondance[1]);
  const mois = Number(correspondance[2]);
  const annee = Number(correspondance[3]);
  const date = new Date(annee, mois - 1, jour);

  if (
    date.getFullYear() !== annee ||
    date.getMonth() !== mois - 1 ||
    date.getDate() !== jour
  ) {
    throw new Error("La date saisie est invalide.");
  }

  return correspondance[3] + "-" +
    correspondance[2] + "-" +
    correspondance[1];
}
