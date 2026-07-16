const disponibilitesButton =
  document.getElementById("disponibilitesButton");

const disponibilitesWorkspace =
  document.getElementById("workspace");

const DISPONIBILITES_API_URL = API_URL;

let disponibilitesMembres = [];
let absencesActives = [];
let historiqueAbsences = [];
let disponibilitesPeutGerer = false;
let disponibilitesPeutSupprimer = false;
let disponibilitesChargees = false;
let demandesAbsenceEnAttente = [];
let demandeAbsenceOfficierOuverte = "";
let demandeAbsenceRefusOuvert = "";

let historiqueOuvert = false;
let absenceOuverte = null;

let rechercheAbsence = "";

/* ==================================================
   OUVERTURE DU MODULE
================================================== */

disponibilitesButton.addEventListener(
  "click",
  function () {
    if (disponibilitesChargees) {
      afficherDisponibilites();
    } else {
      chargerDisponibilites();
    }
  }
);


/* ==================================================
   CHARGEMENT DEPUIS GOOGLE SHEETS
================================================== */

async function chargerDisponibilites() {
  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";

  if (!(typeof gdaReponseEnCache === "function" && gdaReponseEnCache("recupererDisponibilites"))) {
    disponibilitesWorkspace.innerHTML = `
      <section id="disponibilitesModule">

        <div class="disponibilites-message">
          Chargement des disponibilités...
        </div>

      </section>
    `;
  }

  if (!identifiant) {
    afficherErreurDisponibilites(
      "Votre session n’est plus valide. Rechargez la page et reconnectez-vous."
    );

    return;
  }

  try {
    const url =
      DISPONIBILITES_API_URL +
      "?action=recupererDisponibilites" +
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
      afficherErreurDisponibilites(
        resultat.message ||
        "Impossible de récupérer les disponibilités."
      );

      return;
    }

    appliquerDonneesDisponibilites(resultat, true);

    afficherDisponibilites();

    

  } catch (erreur) {
    console.error(erreur);

    afficherErreurDisponibilites(
      erreur.message || "Impossible de contacter le serveur GDA."
    );
  }
}

function appliquerDonneesDisponibilites(resultat, avecMembres) {
  if (avecMembres && Array.isArray(resultat.membres)) {
    disponibilitesMembres = resultat.membres;
  }
  if (typeof resultat.peutGerer === "boolean") {
    disponibilitesPeutGerer = resultat.peutGerer;
  }
  if (typeof resultat.peutSupprimer === "boolean") {
    disponibilitesPeutSupprimer = resultat.peutSupprimer;
  }
  if (Array.isArray(resultat.demandesEnAttente)) {
    demandesAbsenceEnAttente = resultat.demandesEnAttente;
  }

  const toutesLesAbsences = [
    ...(Array.isArray(resultat.actives) ? resultat.actives : []),
    ...(Array.isArray(resultat.historiques) ? resultat.historiques : [])
  ];
  const repartition = repartirAbsencesSelonDates(toutesLesAbsences);
  absencesActives = repartition.actives;
  historiqueAbsences = repartition.historiques;
  disponibilitesChargees = true;
  if (!avecMembres && typeof invaliderCacheEffectifGDA === "function") {
    invaliderCacheEffectifGDA();
  }
}


/* ==================================================
   AFFICHAGE PRINCIPAL
================================================== */

function afficherDisponibilites() {
  const totalEffectif =
    disponibilitesMembres.length;

  const totalAbsents =
    compterMembresAbsentsActuels();

  const totalDisponibles =
    Math.max(
      0,
      totalEffectif - totalAbsents
    );

  disponibilitesWorkspace.innerHTML = `
    <section id="disponibilitesModule">

      ${creerEnteteDisponibilites(
        totalDisponibles,
        totalAbsents
      )}

      ${creerRechercheAbsences()}

      ${creerSectionDemandesAbsenceEnAttente()}

      ${creerFormulaireAbsence()}

      ${creerSectionAbsencesActives()}

      ${creerSectionHistorique()}

    </section>
  `;
    installerEvenementsDisponibilites();
}

function creerSectionDemandesAbsenceEnAttente() {
  if (!demandesAbsenceEnAttente.length) return "";
  return `
    <section class="disponibilites-bloc demandes-absence-officier-bloc">
      <div class="disponibilites-bloc-titre">
        <div><h4>📨 Demandes d’absence en attente</h4><p>Ouvrez une demande pour consulter les dates et la raison.</p></div>
        <span class="disponibilites-total">${demandesAbsenceEnAttente.length}</span>
      </div>
      <div class="demandes-absence-officier-liste">
        ${demandesAbsenceEnAttente.map(creerDemandeAbsenceOfficier).join("")}
      </div>
    </section>
  `;
}

function creerDemandeAbsenceOfficier(demande) {
  const ouverte = demandeAbsenceOfficierOuverte === demande.id;
  const refusOuvert = demandeAbsenceRefusOuvert === demande.id;
  return `
    <article class="demande-absence-officier ${ouverte ? "ouverte" : ""}">
      <button class="demande-absence-officier-resume" type="button" data-ouvrir-demande-absence="${echapperHTML(demande.id)}" aria-expanded="${ouverte}">
        <div><strong>${echapperHTML(demande.nom)}</strong><span>${echapperHTML(demande.grade || "Grade non renseigné")}</span></div>
        <span class="disponibilites-badge">En attente</span><b>${ouverte ? "▲" : "▼"}</b>
      </button>
      ${ouverte ? `
        <div class="demande-absence-officier-details">
          <div class="demande-absence-officier-dates"><div><span>Début</span><strong>${echapperHTML(formaterDateHeureGDA(demande.dateDebut))}</strong></div><div><span>Fin prévue</span><strong>${echapperHTML(formaterDateHeureGDA(demande.dateFin))}</strong></div></div>
          <div class="demande-absence-officier-raison"><span>Raison</span><p>${echapperHTML(demande.raison || "Non renseignée")}</p></div>
          ${disponibilitesPeutGerer ? `
            <div class="demande-absence-officier-actions"><button class="accepter" type="button" data-accepter-demande-absence="${echapperHTML(demande.id)}">✓ Accepter</button><button class="refuser" type="button" data-ouvrir-refus-demande="${echapperHTML(demande.id)}">✕ Refuser</button></div>
            ${refusOuvert ? `<form class="demande-absence-officier-refus" data-formulaire-refus-demande="${echapperHTML(demande.id)}"><label><span>Motif du refus</span><textarea maxlength="1500" required placeholder="Expliquez pourquoi la demande est refusée…"></textarea></label><div><button type="button" data-annuler-refus-demande="${echapperHTML(demande.id)}">Annuler</button><button class="confirmer" type="submit">Confirmer le refus</button></div></form>` : ""}
          ` : '<p class="demande-absence-officier-lecture">Vous pouvez consulter cette demande, mais vous n’avez pas la permission de la traiter.</p>'}
        </div>
      ` : ""}
    </article>
  `;
}


/* ==================================================
   EN-TÊTE
================================================== */

function creerEnteteDisponibilites(
  totalDisponibles,
  totalAbsents
) {
  return `
    <header class="disponibilites-header">

      <div class="disponibilites-header-titre">

        <h3>
          📆 DISPONIBILITÉS DU PERSONNEL
        </h3>

        <p>
          Registre des absences et indisponibilités
        </p>

      </div>

      <div class="disponibilites-statistiques">

        <div class="
          disponibilites-compteur
          disponibilites-compteur-disponible
        ">
          <span class="disponibilites-compteur-valeur">
            ${totalDisponibles}
          </span>

          <span class="disponibilites-compteur-label">
            Disponibles
          </span>
        </div>

        <div class="
          disponibilites-compteur
          disponibilites-compteur-absent
        ">
          <span class="disponibilites-compteur-valeur">
            ${totalAbsents}
          </span>

          <span class="disponibilites-compteur-label">
            Absents
          </span>
        </div>

        <button
          id="disponibilitesActualiser"
          class="disponibilites-bouton-secondaire"
          type="button"
        >
          ↻ Actualiser
        </button>

      </div>

    </header>
  `;
}


/* ==================================================
   FORMULAIRE D’AJOUT
================================================== */
function creerRechercheAbsences() {
  return `
    <section class="disponibilites-bloc">

      <div class="disponibilites-bloc-titre">

        <div>
          <h4>
            🔎 Rechercher les absences d’un membre
          </h4>

          <p>
            Recherche dans les absences actives et dans l’historique.
          </p>
        </div>

      </div>

      <div style="padding: 20px;">

        <label class="disponibilites-champ">

          <span>
            Nom du membre
          </span>

          <input
            id="rechercheAbsenceNom"
            type="search"
            value="${echapperHTML(rechercheAbsence)}"
            placeholder="Rechercher un nom..."
            autocomplete="off"
          >

        </label>

      </div>

    </section>
  `;
}


/* ==================================================
   FORMULAIRE D’AJOUT
================================================== */

function creerFormulaireAbsence() {
  const aujourdHui =
    obtenirDateLocaleISO();

  const membresTries =
    [...disponibilitesMembres].sort(
      function (a, b) {
        const rangA =
          obtenirRangGradeDisponibilites(
            a.grade
          );

        const rangB =
          obtenirRangGradeDisponibilites(
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

  const optionsMembres =
    membresTries
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
    <section class="disponibilites-bloc">

      <div class="disponibilites-bloc-titre">

        <div>
          <h4>
            ➕ Déclarer une absence
          </h4>

          <p>
            Ajoutez une nouvelle indisponibilité au registre.
          </p>
        </div>

      </div>

      <form
        id="formulaireNouvelleAbsence"
        class="disponibilites-formulaire"
      >

        <label class="disponibilites-champ">

          <span>
            Personnel
          </span>

          <select
            id="absenceNom"
            required
          >
            <option value="">
              Sélectionner un membre
            </option>

            ${optionsMembres}
          </select>

        </label>

        <label class="disponibilites-champ">

          <span>
            Début de l’absence
          </span>

          <input
            id="absenceDateDebut"
            type="date"
            lang="fr-FR"
            value="${aujourdHui}"
            required
          >

        </label>

        <label class="disponibilites-champ">

          <span>
            Retour prévu
          </span>

          <input
            id="absenceDateFin"
            type="date"
            lang="fr-FR"
            min="${aujourdHui}"
            required
          >

        </label>

        <label class="
          disponibilites-champ
          disponibilites-champ-raison
        ">

          <span>
            Raison
          </span>

          <input
            id="absenceRaison"
            type="text"
            maxlength="1000"
            placeholder="Motif de l’absence..."
            required
          >

        </label>

        <button
          id="absenceValider"
          class="disponibilites-bouton-principal"
          type="submit"
        >
          Valider
        </button>

      </form>

      <p
        id="absenceFormulaireMessage"
        class="disponibilites-retour-message"
      ></p>

    </section>
  `;
}

function creerSectionAbsencesActives() {
  const absencesFiltrees =
    filtrerEtTrierAbsences(
      absencesActives
    );

  const contenu =
    absencesFiltrees.length
      ? absencesFiltrees
          .map(function (absence) {
            return creerLigneAbsence(
              absence,
              false
            );
          })
          .join("")
      : `
        <div class="disponibilites-vide">
          ${
            rechercheAbsence
              ? "Aucune absence active trouvée pour cette recherche."
              : "Aucun membre n’est actuellement absent."
          }
        </div>
      `;

  return `
    <section class="
      disponibilites-bloc
      disponibilites-bloc-actif
    ">

      <div class="disponibilites-bloc-titre">

        <div>
          <h4>
            🟠 Absences actives
          </h4>

          <p>
            Membres actuellement indisponibles.
          </p>
        </div>

        <span class="disponibilites-total">
          ${absencesFiltrees.length}
        </span>

      </div>

      <div class="disponibilites-liste">
        ${contenu}
      </div>

    </section>
  `;
}

/* ==================================================
   HISTORIQUE
================================================== */

function creerSectionHistorique() {
  const absencesFiltrees =
    filtrerEtTrierAbsences(
      historiqueAbsences
    );

  const rechercheActive =
    rechercheAbsence.trim() !== "";

  const historiqueAffiche =
    historiqueOuvert ||
    rechercheActive;

  const contenu =
    absencesFiltrees.length
      ? absencesFiltrees
          .map(function (absence) {
            return creerLigneAbsence(
              absence,
              true
            );
          })
          .join("")
      : `
        <div class="disponibilites-vide">
          ${
            rechercheActive
              ? "Aucune ancienne absence trouvée pour cette recherche."
              : "Aucune absence terminée."
          }
        </div>
      `;

  return `
    <section class="
      disponibilites-bloc
      disponibilites-bloc-historique
      ${historiqueAffiche ? "historique-ouvert" : ""}
    ">

      <button
        id="historiqueAbsencesBouton"
        class="disponibilites-historique-entete"
        type="button"
        aria-expanded="${historiqueAffiche}"
      >

        <div>
          <h4>
            📚 Historique des absences
          </h4>

          <p>
            Absences terminées et archivées.
          </p>
        </div>

        <div class="disponibilites-historique-droite">

          <span class="disponibilites-total">
            ${absencesFiltrees.length}
          </span>

          <span class="disponibilites-fleche">
            ${historiqueAffiche ? "▲" : "▼"}
          </span>

        </div>

      </button>

      <div
        id="historiqueAbsencesContenu"
        class="disponibilites-historique-contenu"
      >
        ${contenu}
      </div>

    </section>
  `;
}
/* ==================================================
   CRÉATION D’UNE LIGNE D’ABSENCE
================================================== */

function creerLigneAbsence(
  absence,
  historique
) {
  const estOuverte =
    absenceOuverte === absence.ligne;

  const classeEtat =
    historique
      ? "absence-terminee"
      : "absence-active";

  const texteDuree =
    obtenirTexteDureeAbsence(
      absence,
      historique
    );

  return `
    <article
      class="
        disponibilites-absence
        ${classeEtat}
        ${estOuverte ? "absence-ouverte" : ""}
      "
      data-ligne="${absence.ligne}"
    >

      <button
        class="disponibilites-absence-resume"
        type="button"
        data-action="ouvrir-absence"
        data-ligne="${absence.ligne}"
        aria-expanded="${estOuverte}"
      >

        <div class="disponibilites-absence-identite">

          <strong>
            ${echapperHTML(absence.nom)}
          </strong>

          <span>
            ${echapperHTML(
              absence.grade || "Grade non renseigné"
            )}
          </span>

        </div>

        <div class="disponibilites-absence-duree">

          <span class="
            disponibilites-badge
            ${historique
              ? "badge-termine"
              : "badge-absent"}
          ">
            ${historique ? "Terminée" : "Absent"}
          </span>

          <strong>
            ${echapperHTML(texteDuree)}
          </strong>

        </div>

        <span class="disponibilites-absence-fleche">
          ${estOuverte ? "▲" : "▼"}
        </span>

      </button>

      ${
        estOuverte
          ? creerDetailsAbsence(
              absence,
              historique
            )
          : ""
      }

    </article>
  `;
}


/* ==================================================
   DÉTAILS D’UNE ABSENCE
================================================== */

function creerDetailsAbsence(
  absence,
  historique
) {
  const peutModifier =
    utilisateurPeutModifierAbsences();

  const boutonsEdition =
    (!historique && peutModifier) || disponibilitesPeutSupprimer
      ? `
        <div class="disponibilites-actions">
          ${!historique && peutModifier ? `
            <button
              class="disponibilites-bouton-secondaire"
              type="button"
              data-action="editer-absence"
              data-ligne="${absence.ligne}"
            >
              ✏ Modifier
            </button>

            <button
              class="disponibilites-bouton-retour"
              type="button"
              data-action="retour-anticipe"
              data-ligne="${absence.ligne}"
            >
              ↩ Retour anticipé
            </button>
          ` : ""}
          ${disponibilitesPeutSupprimer ? `
            <button
              class="disponibilites-bouton-supprimer"
              type="button"
              data-action="supprimer-absence"
              data-ligne="${absence.ligne}"
            >
              🗑 Supprimer définitivement
            </button>
          ` : ""}
        </div>
      `
      : "";

  return `
    <div class="disponibilites-details">

      <div class="disponibilites-details-grille">

        ${creerChampDetailAbsence(
          "Date de début",
          formaterDateFrancaise(
            absence.dateDebut
          )
        )}

        ${creerChampDetailAbsence(
          historique
            ? "Date de fin"
            : "Retour prévu",
          formaterDateFrancaise(
            absence.dateFin
          )
        )}

        ${creerChampDetailAbsence(
          "Durée totale",
          calculerDureeTotaleAbsence(
            absence.dateDebut,
            absence.dateFin
          )
        )}

        ${creerChampDetailAbsence(
          "Déclarée par",
          absence.auteur ||
          "Non renseigné"
        )}

      </div>

      <div class="disponibilites-raison">

        <span>
          Raison
        </span>

        <p>
          ${echapperHTML(
            absence.raison ||
            "Aucune raison renseignée."
          )}
        </p>

      </div>

      ${boutonsEdition}

    </div>
  `;
}


function creerChampDetailAbsence(
  label,
  valeur
) {
  return `
    <div class="disponibilites-detail-champ">

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
   INSTALLATION DES ÉVÉNEMENTS
================================================== */

function installerEvenementsDisponibilites() {

      const champRecherche =
    document.getElementById(
      "rechercheAbsenceNom"
    );

  if (champRecherche) {
    champRecherche.addEventListener(
      "input",
      function () {
        const positionCurseur =
          champRecherche.selectionStart;

        rechercheAbsence =
          champRecherche.value;

        afficherDisponibilites();

        const nouveauChamp =
          document.getElementById(
            "rechercheAbsenceNom"
          );

        if (nouveauChamp) {
          nouveauChamp.focus();

          nouveauChamp.setSelectionRange(
            positionCurseur,
            positionCurseur
          );
        }
      }
    );
  }

  const boutonActualiser =
    document.getElementById(
      "disponibilitesActualiser"
    );

  if (boutonActualiser) {
    boutonActualiser.addEventListener(
      "click",
      function() {
        if (typeof gdaForcerActualisation === "function") {
          gdaForcerActualisation("recupererDisponibilites");
        }
        chargerDisponibilites();
      }
    );
  }

  const formulaire =
    document.getElementById(
      "formulaireNouvelleAbsence"
    );

  if (formulaire) {
    formulaire.addEventListener(
      "submit",
      envoyerNouvelleAbsence
    );
  }

  const dateDebut =
    document.getElementById(
      "absenceDateDebut"
    );

  const dateFin =
    document.getElementById(
      "absenceDateFin"
    );

  if (dateDebut && dateFin) {
    dateDebut.addEventListener(
      "change",
      function () {
        dateFin.min = dateDebut.value;

        if (
          dateFin.value &&
          dateFin.value < dateDebut.value
        ) {
          dateFin.value = "";
        }
      }
    );
  }

  const boutonHistorique =
    document.getElementById(
      "historiqueAbsencesBouton"
    );

  if (boutonHistorique) {
    boutonHistorique.addEventListener(
      "click",
      function () {
        historiqueOuvert =
          !historiqueOuvert;

        afficherDisponibilites();
      }
    );
  }

  document
    .querySelectorAll(
      '[data-action="ouvrir-absence"]'
    )
    .forEach(function (bouton) {
      bouton.addEventListener(
        "click",
        function () {
          const ligne = Number(
            bouton.dataset.ligne
          );

          absenceOuverte =
            absenceOuverte === ligne
              ? null
              : ligne;

          afficherDisponibilites();
        }
      );
    });

  document
    .querySelectorAll(
      '[data-action="editer-absence"]'
    )
    .forEach(function (bouton) {
      bouton.addEventListener(
        "click",
        function () {
          const ligne = Number(
            bouton.dataset.ligne
          );

          ouvrirEditionAbsence(ligne);
        }
      );
    });

  document
    .querySelectorAll(
      '[data-action="retour-anticipe"]'
    )
    .forEach(function (bouton) {
      bouton.addEventListener(
        "click",
        function () {
          const ligne = Number(
            bouton.dataset.ligne
          );

          confirmerRetourAnticipe(ligne);
        }
      );
    });

  document
    .querySelectorAll(
      '[data-action="supprimer-absence"]'
    )
    .forEach(function (bouton) {
      bouton.addEventListener(
        "click",
        function () {
          confirmerSuppressionAbsence(
            Number(bouton.dataset.ligne),
            bouton
          );
        }
      );
    });

  document.querySelectorAll("[data-ouvrir-demande-absence]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      const id = bouton.dataset.ouvrirDemandeAbsence;
      demandeAbsenceOfficierOuverte = demandeAbsenceOfficierOuverte === id ? "" : id;
      demandeAbsenceRefusOuvert = "";
      afficherDisponibilites();
    });
  });
  document.querySelectorAll("[data-accepter-demande-absence]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      const id = bouton.dataset.accepterDemandeAbsence;
      if (confirm("Accepter cette demande et l’ajouter au registre des absences ?")) {
        traiterDemandeAbsenceOfficier(id, "ACCEPTER", "", bouton);
      }
    });
  });
  document.querySelectorAll("[data-ouvrir-refus-demande]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      demandeAbsenceRefusOuvert = bouton.dataset.ouvrirRefusDemande;
      afficherDisponibilites();
    });
  });
  document.querySelectorAll("[data-annuler-refus-demande]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      demandeAbsenceRefusOuvert = "";
      afficherDisponibilites();
    });
  });
  document.querySelectorAll("[data-formulaire-refus-demande]").forEach(function (formulaire) {
    formulaire.addEventListener("submit", function (evenement) {
      evenement.preventDefault();
      const motif = formulaire.querySelector("textarea").value.trim();
      if (!motif) return;
      traiterDemandeAbsenceOfficier(
        formulaire.dataset.formulaireRefusDemande,
        "REFUSER",
        motif,
        formulaire.querySelector('[type="submit"]')
      );
    });
  });
}

async function traiterDemandeAbsenceOfficier(id, decision, motifRefus, bouton) {
  bouton.disabled = true;
  try {
    const donnees = new URLSearchParams({
      identifiant: sessionStorage.getItem("identifiantUtilisateur") || "",
      demandeId: id,
      decision: decision,
      motifRefus: motifRefus || ""
    });
    const reponse = await fetch(DISPONIBILITES_API_URL + "?action=traiterDemandeAbsence", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: donnees.toString()
    });
    const resultat = await reponse.json();
    if (!resultat.success) throw new Error(resultat.message || "Décision impossible.");
    appliquerDonneesDisponibilites(resultat, false);
    demandeAbsenceOfficierOuverte = "";
    demandeAbsenceRefusOuvert = "";
    afficherDisponibilites();
    afficherNotificationGDA(resultat.message, "succes");
  } catch (erreur) {
    afficherNotificationGDA(erreur.message || "Décision impossible.", "erreur");
    bouton.disabled = false;
  }
}


/* ==================================================
   AJOUT D’UNE ABSENCE
================================================== */

async function envoyerNouvelleAbsence(
  evenement
) {
  evenement.preventDefault();

  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";

  const nom =
    document.getElementById(
      "absenceNom"
    ).value;

  const dateDebut =
    document.getElementById(
      "absenceDateDebut"
    ).value;

  const dateFin =
    document.getElementById(
      "absenceDateFin"
    ).value;

  const raison =
    document.getElementById(
      "absenceRaison"
    ).value.trim();

  const bouton =
    document.getElementById(
      "absenceValider"
    );

  const message =
    document.getElementById(
      "absenceFormulaireMessage"
    );

  if (
    !nom ||
    !dateDebut ||
    !dateFin ||
    !raison
  ) {
    message.textContent =
      "Tous les champs sont obligatoires.";

    message.className =
      "disponibilites-retour-message message-erreur";

    return;
  }

  bouton.disabled = true;
  bouton.textContent =
    "Enregistrement...";

  message.textContent =
    "Enregistrement de l’absence...";

  message.className =
    "disponibilites-retour-message";

  try {
    const url =
      DISPONIBILITES_API_URL +
      "?action=ajouterAbsence" +
      "&identifiant=" +
      encodeURIComponent(identifiant) +
      "&nom=" +
      encodeURIComponent(nom) +
      "&dateDebut=" +
      encodeURIComponent(dateDebut) +
      "&dateFin=" +
      encodeURIComponent(dateFin) +
      "&raison=" +
      encodeURIComponent(raison);

    const reponse = await fetch(url);

    if (!reponse.ok) {
      throw new Error(
        "Erreur serveur : " +
        reponse.status
      );
    }

    const resultat =
      await reponse.json();

    if (!resultat.success) {
      message.textContent =
        resultat.message ||
        "Impossible d’enregistrer l’absence.";

      message.className =
        "disponibilites-retour-message message-erreur";

      return;
    }

    message.textContent =
      resultat.message ||
      "Absence enregistrée.";

    message.className =
      "disponibilites-retour-message message-succes";

    appliquerDonneesDisponibilites(resultat, false);
    absenceOuverte = null;
    afficherDisponibilites();
    afficherNotificationGDA(
      resultat.message || "Absence enregistrée.",
      "succes"
    );

  } catch (erreur) {
    console.error(erreur);

    message.textContent =
      "Impossible de contacter le serveur GDA.";

    message.className =
      "disponibilites-retour-message message-erreur";

  } finally {
    bouton.disabled = false;
    bouton.textContent = "Valider";
  }
}


/* ==================================================
   ÉDITION D’UNE ABSENCE
================================================== */

function ouvrirEditionAbsence(ligne) {
  const absence =
    absencesActives.find(
      function (element) {
        return element.ligne === ligne;
      }
    );

  if (!absence) {
    return;
  }

  disponibilitesWorkspace.innerHTML = `
    <section id="disponibilitesModule">

      <header class="disponibilites-header">

        <div class="disponibilites-header-titre">

          <h3>
            ✏ MODIFIER UNE ABSENCE
          </h3>

          <p>
            ${echapperHTML(absence.nom)}
            — ${echapperHTML(absence.grade)}
          </p>

        </div>

        <button
          id="annulerEditionAbsence"
          class="disponibilites-bouton-secondaire"
          type="button"
        >
          ← Retour
        </button>

      </header>

      <section class="disponibilites-bloc">

        <form
          id="formulaireEditionAbsence"
          class="disponibilites-formulaire-edition"
        >

          <label class="disponibilites-champ">

            <span>
              Date de début
            </span>

            <input
              id="editionDateDebut"
              type="date"
              lang="fr-FR"
              value="${absence.dateDebut}"
              required
            >

          </label>

          <label class="disponibilites-champ">

            <span>
              Retour prévu
            </span>

            <input
              id="editionDateFin"
              type="date"
              lang="fr-FR"
              value="${absence.dateFin}"
              required
            >

          </label>

          <label class="
            disponibilites-champ
            disponibilites-champ-plein
          ">

            <span>
              Raison
            </span>

            <textarea
              id="editionRaison"
              maxlength="1000"
              required
            >${echapperHTML(absence.raison)}</textarea>

          </label>

          <button
            id="editionAbsenceValider"
            class="disponibilites-bouton-principal"
            type="submit"
          >
            Enregistrer les modifications
          </button>

        </form>

        <p
          id="editionAbsenceMessage"
          class="disponibilites-retour-message"
        ></p>

      </section>

    </section>
  `;

  document
    .getElementById(
      "annulerEditionAbsence"
    )
    .addEventListener(
      "click",
      afficherDisponibilites
    );

  document
    .getElementById(
      "formulaireEditionAbsence"
    )
    .addEventListener(
      "submit",
      function (event) {
        envoyerModificationAbsence(
          event,
          absence
        );
      }
    );
}
/* ==================================================
   ENREGISTREMENT DES MODIFICATIONS
================================================== */

async function envoyerModificationAbsence(
  evenement,
  absence
) {
  evenement.preventDefault();

  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";

  const dateDebut =
    document.getElementById(
      "editionDateDebut"
    ).value;

  const dateFin =
    document.getElementById(
      "editionDateFin"
    ).value;

  const raison =
    document.getElementById(
      "editionRaison"
    ).value.trim();

  const bouton =
    document.getElementById(
      "editionAbsenceValider"
    );

  const message =
    document.getElementById(
      "editionAbsenceMessage"
    );

  if (
    !dateDebut ||
    !dateFin ||
    !raison
  ) {
    message.textContent =
      "Tous les champs sont obligatoires.";

    message.className =
      "disponibilites-retour-message message-erreur";

    return;
  }

  if (dateFin < dateDebut) {
    message.textContent =
      "La date de fin ne peut pas être antérieure à la date de début.";

    message.className =
      "disponibilites-retour-message message-erreur";

    return;
  }

  bouton.disabled = true;
  bouton.textContent =
    "Enregistrement...";

  message.textContent =
    "Modification de l’absence...";

  message.className =
    "disponibilites-retour-message";

  try {
    const url =
      DISPONIBILITES_API_URL +
      "?action=modifierAbsence" +
      "&identifiant=" +
      encodeURIComponent(identifiant) +
      "&ligne=" +
      encodeURIComponent(absence.ligne) +
      "&dateDebut=" +
      encodeURIComponent(dateDebut) +
      "&dateFin=" +
      encodeURIComponent(dateFin) +
      "&raison=" +
      encodeURIComponent(raison);

    const reponse = await fetch(url);

    if (!reponse.ok) {
      throw new Error(
        "Erreur serveur : " +
        reponse.status
      );
    }

    const resultat =
      await reponse.json();

    if (!resultat.success) {
      message.textContent =
        resultat.message ||
        "Impossible de modifier l’absence.";

      message.className =
        "disponibilites-retour-message message-erreur";

      return;
    }

    message.textContent =
      resultat.message ||
      "Absence modifiée.";

    message.className =
      "disponibilites-retour-message message-succes";

    appliquerDonneesDisponibilites(resultat, false);
    absenceOuverte = null;
    afficherDisponibilites();
    afficherNotificationGDA(
      resultat.message || "Absence modifiée.",
      "succes"
    );

  } catch (erreur) {
    console.error(erreur);

    message.textContent =
      "Impossible de contacter le serveur GDA.";

    message.className =
      "disponibilites-retour-message message-erreur";

  } finally {
    bouton.disabled = false;

    bouton.textContent =
      "Enregistrer les modifications";
  }
}


/* ==================================================
   RETOUR ANTICIPÉ
================================================== */

function confirmerRetourAnticipe(ligne) {
  const absence =
    absencesActives.find(
      function (element) {
        return element.ligne === ligne;
      }
    );

  if (!absence) {
    return;
  }

  const confirmation =
    window.confirm(
      "Confirmer le retour anticipé de " +
      absence.nom +
      " ?"
    );

  if (!confirmation) {
    return;
  }

  enregistrerRetourAnticipe(absence);
}


async function enregistrerRetourAnticipe(
  absence
) {
  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";

  try {
    const url =
      DISPONIBILITES_API_URL +
      "?action=retourAnticipe" +
      "&identifiant=" +
      encodeURIComponent(identifiant) +
      "&ligne=" +
      encodeURIComponent(absence.ligne);

    const reponse = await fetch(url);

    if (!reponse.ok) {
      throw new Error(
        "Erreur serveur : " +
        reponse.status
      );
    }

    const resultat =
      await reponse.json();

    if (!resultat.success) {
      window.alert(
        resultat.message ||
        "Impossible d’enregistrer le retour anticipé."
      );

      return;
    }

    appliquerDonneesDisponibilites(resultat, false);
    absenceOuverte = null;
    afficherDisponibilites();
    afficherNotificationGDA(
      resultat.message || "Retour anticipé enregistré.",
      "succes"
    );

  } catch (erreur) {
    console.error(erreur);

    window.alert(
      "Impossible de contacter le serveur GDA."
    );
  }
}


async function confirmerSuppressionAbsence(ligne, bouton) {
  const absence = absencesActives.concat(historiqueAbsences).find(
    function (element) {
      return Number(element.ligne) === Number(ligne);
    }
  );
  if (!absence || !disponibilitesPeutSupprimer) return;

  const confirmation = window.confirm(
    "Supprimer définitivement l’absence de " +
    absence.nom +
    " ? Cette action est irréversible."
  );
  if (!confirmation) return;

  bouton.disabled = true;
  try {
    const donnees = new URLSearchParams({
      identifiant: sessionStorage.getItem("identifiantUtilisateur") || "",
      ligne: String(ligne)
    });
    const reponse = await fetch(
      DISPONIBILITES_API_URL + "?action=supprimerAbsence",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: donnees.toString()
      }
    );
    const resultat = await reponse.json();
    if (!resultat.success) {
      throw new Error(resultat.message || "Suppression impossible.");
    }
    appliquerDonneesDisponibilites(resultat, false);
    absenceOuverte = null;
    afficherDisponibilites();
    afficherNotificationGDA(resultat.message, "succes");
  } catch (erreur) {
    afficherNotificationGDA(
      erreur.message || "Impossible de supprimer cette absence.",
      "erreur"
    );
    bouton.disabled = false;
  }
}


/* ==================================================
   CALCULS DES DURÉES
================================================== */

function obtenirTexteDureeAbsence(
  absence,
  historique
) {
  if (historique) {
    return calculerDureeTotaleAbsence(
      absence.dateDebut,
      absence.dateFin
    );
  }

  const joursRestants =
    Number(absence.joursRestants);

  if (!Number.isFinite(joursRestants)) {
    return "Durée inconnue";
  }

  if (joursRestants < 0) {
    return "Terminée";
  }

  if (joursRestants === 0) {
    return "Retour aujourd’hui";
  }

  if (joursRestants === 1) {
    return "1 jour restant";
  }

  return (
    joursRestants +
    " jours restants"
  );
}


function calculerDureeTotaleAbsence(
  dateDebutTexte,
  dateFinTexte
) {
  const dateDebut =
    convertirDateISOEnLocale(
      dateDebutTexte
    );

  const dateFin =
    convertirDateISOEnLocale(
      dateFinTexte
    );

  if (!dateDebut || !dateFin) {
    return "Durée inconnue";
  }

  const difference =
    Math.round(
      (
        dateFin.getTime() -
        dateDebut.getTime()
      ) /
      86400000
    );

  const jours =
    Math.max(
      1,
      difference + 1
    );

  if (jours === 1) {
    return "1 jour";
  }

  return jours + " jours";
}


/* ==================================================
   CLASSEMENT AUTOMATIQUE SELON LES DATES
================================================== */

function repartirAbsencesSelonDates(
  absences
) {
  const actives = [];
  const historiques = [];

  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);

  /* Évite un éventuel doublon renvoyé par le serveur. */
  const lignesDejaVues = new Set();

  absences.forEach(function (absence) {
    if (!absence) {
      return;
    }

    const cle = String(
      absence.ligne ||
      [
        absence.nom,
        absence.dateDebut,
        absence.dateFin
      ].join("|")
    );

    if (lignesDejaVues.has(cle)) {
      return;
    }

    lignesDejaVues.add(cle);

    const dateDebut =
      convertirDateISOEnLocale(
        absence.dateDebut
      );

    const dateFin =
      convertirDateISOEnLocale(
        absence.dateFin
      );

    const estActive =
      Boolean(dateDebut && dateFin) &&
      dateDebut.getTime() <=
        aujourdHui.getTime() &&
      dateFin.getTime() >=
        aujourdHui.getTime();

    if (estActive) {
      absence.statut = "ACTIF";
      absence.joursRestants =
        Math.max(
          0,
          Math.round(
            (
              dateFin.getTime() -
              aujourdHui.getTime()
            ) / 86400000
          )
        );

      actives.push(absence);
      return;
    }

    absence.statut = "TERMINE";
    historiques.push(absence);
  });

  return {
    actives,
    historiques
  };
}


function compterMembresAbsentsActuels() {
  const noms =
    new Set();

  absencesActives.forEach(
    function (absence) {
      if (absence.nom) {
        noms.add(
          normaliserTexteDisponibilites(
            absence.nom
          )
        );
      }
    }
  );

  return noms.size;
}


/* ==================================================
   PERMISSIONS
================================================== */

function filtrerEtTrierAbsences(
  absences
) {
  const recherche =
    normaliserTexteDisponibilites(
      rechercheAbsence
    );

  return [...absences]
    .filter(function (absence) {
      if (!recherche) {
        return true;
      }

      const nom =
        normaliserTexteDisponibilites(
          absence.nom
        );

      return nom.includes(recherche);
    })
    .sort(function (a, b) {
      /*
       * Une ligne Sheets plus élevée correspond
       * à une absence déposée plus récemment.
       */
      const ligneA =
        Number(a.ligne || 0);

      const ligneB =
        Number(b.ligne || 0);

      return ligneB - ligneA;
    });
}

function utilisateurPeutModifierAbsences() {
  return disponibilitesPeutGerer;
}


/* ==================================================
   DATES
================================================== */

function obtenirDateLocaleISO() {
  const maintenant = new Date();

  return convertirDateEnISO(
    maintenant
  );
}


function convertirDateEnISO(date) {
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


function convertirDateISOEnLocale(
  texte
) {
  const correspondance =
    String(texte || "")
      .match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

  if (!correspondance) {
    return null;
  }

  const date = new Date(
    Number(correspondance[1]),
    Number(correspondance[2]) - 1,
    Number(correspondance[3])
  );

  date.setHours(0, 0, 0, 0);

  return date;
}


function formaterDateFrancaise(
  dateISO
) {
  return formaterDateHeureGDA(dateISO, "Non renseignée");
}


/* ==================================================
   NORMALISATION ET ERREURS
================================================== */

function normaliserTexteDisponibilites(
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

function obtenirRangGradeDisponibilites(
  grade
) {
  const gradeNormalise =
    normaliserTexteDisponibilites(
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

function afficherErreurDisponibilites(
  message
) {
  disponibilitesWorkspace.innerHTML = `
    <section id="disponibilitesModule">

      <div class="
        disponibilites-message
        disponibilites-erreur
      ">
        ${echapperHTML(message)}
      </div>

    </section>
  `;
}
