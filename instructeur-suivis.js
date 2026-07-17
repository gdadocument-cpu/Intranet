let suivisFormationInstructeur = [];
let nouveauxArrivantsInstructeur = [];
let suiviFormationOuvert = "";
let nouvelArrivantInstructeurOuvert = "";
let instructeursDisponiblesSuivi = [];
let gerantsDisponiblesSuivi = [];
let gerantConnecteSuivi = "";
let suivisFormationPeutModifier = false;
let suivisFormationInstructeurCharges = false;
const CACHE_SUIVIS_FORMATION_INSTRUCTEUR = "gdaSuivisFormationInstructeur:";
const DUREE_CACHE_SUIVIS_FORMATION_INSTRUCTEUR = 5 * 60 * 1000;
let suivisFormationInstructeurChargesLe = 0;
let chargementPostItsInstructeur = 0;
let relancePostItsInstructeur = null;
let nombreRelancesPostItsInstructeur = 0;
const CACHE_POST_ITS_INSTRUCTEUR = "gdaPostItsInstructeur:";
const DUREE_CACHE_POST_ITS_INSTRUCTEUR = 2 * 60 * 1000;
let cachePostItsInstructeurValide = false;
let cachePostItsInstructeurDate = 0;

window.invaliderCacheSuivisInstructeurGDA = function() {
  try {
    localStorage.removeItem(cleCacheSuivisFormationInstructeur());
    localStorage.removeItem(cleCachePostItsInstructeurGDA());
  } catch (erreur) {
    /* Facultatif. */
  }
  suivisFormationInstructeurChargesLe = 0;
  cachePostItsInstructeurValide = false;
  cachePostItsInstructeurDate = 0;
};

function cleCacheSuivisFormationInstructeur() {
  return CACHE_SUIVIS_FORMATION_INSTRUCTEUR + normaliserValeurRapportInstructeur(
    sessionStorage.getItem("identifiantUtilisateur") || ""
  );
}

function lireCacheSuivisFormationInstructeur() {
  try {
    const cache = JSON.parse(localStorage.getItem(cleCacheSuivisFormationInstructeur()) || "null");
    if (!cache || !cache.donnees || Date.now() - Number(cache.date || 0) > DUREE_CACHE_SUIVIS_FORMATION_INSTRUCTEUR) return null;
    return cache.donnees;
  } catch (erreur) {
    return null;
  }
}

function enregistrerCacheSuivisFormationInstructeur(donnees) {
  try {
    localStorage.setItem(cleCacheSuivisFormationInstructeur(), JSON.stringify({
      date: Date.now(),
      donnees: donnees
    }));
  } catch (erreur) {
    /* Le cache local reste facultatif. */
  }
}

function appliquerDonneesSuivisFormationInstructeur(resultat) {
  suivisFormationInstructeur = Array.isArray(resultat.suivis) ? resultat.suivis : [];
  nouveauxArrivantsInstructeur = Array.isArray(resultat.nouveauxArrivants)
    ? resultat.nouveauxArrivants
    : [];
  instructeursDisponiblesSuivi = Array.isArray(resultat.instructeurs)
    ? resultat.instructeurs
    : [];
  gerantsDisponiblesSuivi = Array.isArray(resultat.gerants)
    ? resultat.gerants
    : [];
  gerantConnecteSuivi = resultat.gerantConnecte ||
    sessionStorage.getItem("identifiantUtilisateur") || "";
  suivisFormationPeutModifier = resultat.peutModifier === true &&
    (typeof utilisateurPeutAdministrerSuivisFormationGDA !== "function" ||
      utilisateurPeutAdministrerSuivisFormationGDA());
  suivisFormationInstructeurCharges = true;
  suivisFormationInstructeurChargesLe = Date.now();
}

function cleCachePostItsInstructeurGDA() {
  return CACHE_POST_ITS_INSTRUCTEUR +
    normaliserValeurRapportInstructeur(
      sessionStorage.getItem("identifiantUtilisateur") || ""
    );
}

function lireCachePostItsInstructeurGDA() {
  try {
    const cache = JSON.parse(localStorage.getItem(cleCachePostItsInstructeurGDA()) || "null");
    cachePostItsInstructeurDate = Number(cache && cache.date || 0);
    cachePostItsInstructeurValide = !!(
      cache &&
      Array.isArray(cache.suivis) &&
      Date.now() - cachePostItsInstructeurDate < DUREE_CACHE_POST_ITS_INSTRUCTEUR
    );
    if (!cachePostItsInstructeurValide) {
      return [];
    }
    return cache.suivis;
  } catch (erreur) {
    cachePostItsInstructeurValide = false;
    cachePostItsInstructeurDate = 0;
    return [];
  }
}

function enregistrerCachePostItsInstructeurGDA(suivis) {
  try {
    cachePostItsInstructeurDate = Date.now();
    cachePostItsInstructeurValide = true;
    localStorage.setItem(cleCachePostItsInstructeurGDA(), JSON.stringify({
      date: cachePostItsInstructeurDate,
      suivis: Array.isArray(suivis) ? suivis : []
    }));
  } catch (erreur) {
    /* Le cache accélère l'affichage mais n'est jamais obligatoire. */
  }
}

function afficherPostItsInstructeurGDA(workspace, suivis) {
  workspace.querySelector(".post-its-instructeur-gda")?.remove();
  if (!Array.isArray(suivis) || !suivis.length) return;
  workspace.insertAdjacentHTML("beforeend", `
    <aside class="post-its-instructeur-gda" aria-label="GDA placés sous ma surveillance">
      ${suivis.map(creerPostItInstructeurGDA).join("")}
    </aside>
  `);
  installerPostItsInstructeurGDA();
}

function modifierCachePostItInstructeurGDA(id, modifications) {
  const suivis = lireCachePostItsInstructeurGDA();
  const suivi = suivis.find(function (element) { return element.id === id; });
  if (!suivi) return;
  Object.assign(suivi, modifications || {});
  enregistrerCachePostItsInstructeurGDA(suivis);
}

async function chargerPostItsInstructeurGDA() {
  const workspace = document.getElementById("workspace");
  if (!workspace) return;
  workspace.querySelector(".post-its-instructeur-gda")?.remove();
  if (
    !sessionStorage.getItem("sessionTokenDiscord") ||
    menuOfficierOuvert ||
    menuEspaceGdaOuvert ||
    menuSpecialisationsOuvert ||
    menuLiensUtilesOuvert ||
    menuAdministrationOuvert ||
    moduleGdaActif
  ) return;
  const accueil = workspace.querySelector("#welcomePanel");
  if (!accueil) return;
  const cache = lireCachePostItsInstructeurGDA();
  if (cache.length) afficherPostItsInstructeurGDA(workspace, cache);
  if (cachePostItsInstructeurValide) return;
  const numeroChargement = ++chargementPostItsInstructeur;
  try {
    const resultat = await requeteRapportInstructeur(
      "recupererMesSuivisInstructeur",
      {},
      "GET"
    );
    if (
      numeroChargement !== chargementPostItsInstructeur ||
      !document.body.contains(workspace) ||
      !workspace.querySelector("#welcomePanel") ||
      menuOfficierOuvert || menuEspaceGdaOuvert || menuSpecialisationsOuvert ||
      menuLiensUtilesOuvert || menuAdministrationOuvert || moduleGdaActif
    ) return;
    const suivis = Array.isArray(resultat.suivis) ? resultat.suivis : [];
    enregistrerCachePostItsInstructeurGDA(suivis);
    afficherPostItsInstructeurGDA(workspace, suivis);
    if (relancePostItsInstructeur) {
      window.clearTimeout(relancePostItsInstructeur);
      relancePostItsInstructeur = null;
    }
    nombreRelancesPostItsInstructeur = 0;
  } catch (erreur) {
    console.warn("Post-it Instructeur indisponible :", erreur);
    if (
      nombreRelancesPostItsInstructeur < 2 &&
      !relancePostItsInstructeur &&
      workspace.querySelector("#welcomePanel")
    ) {
      nombreRelancesPostItsInstructeur++;
      relancePostItsInstructeur = window.setTimeout(function () {
        relancePostItsInstructeur = null;
        chargerPostItsInstructeurGDA();
      }, 5000);
    }
  }
}

window.addEventListener("load", function () {
  window.setTimeout(function () {
    if (sessionStorage.getItem("sessionTokenDiscord")) {
      chargerPostItsInstructeurGDA();
    }
  }, 250);
});

function creerPostItInstructeurGDA(suivi) {
  return `<article class="post-it-instructeur-gda" data-post-it-suivi="${echapperRapportInstructeur(suivi.id)}">
    <header>
      <span>📌 GDA sous surveillance</span>
      <strong>${echapperRapportInstructeur(suivi.matricule)}</strong>
    </header>
    <div class="post-it-instructeur-statistiques">
      <div><small>Rapports effectués</small><b data-post-it-rapports>${Number(suivi.nombreRapports || 0)}</b></div>
      <div class="post-it-instructeur-services">
        <small>Vu en service</small>
        <span>
          <button type="button" data-post-it-service="-1" aria-label="Retirer une prise de service">−</button>
          <b data-post-it-services>${Number(suivi.prisesService || 0)}</b>
          <button type="button" data-post-it-service="1" aria-label="Ajouter une prise de service">＋</button>
        </span>
      </div>
    </div>
    <label>
      <span>Commentaire de suivi</span>
      <textarea data-post-it-commentaire rows="5" placeholder="Laissez vos observations sur ce GDA…">${echapperRapportInstructeur(suivi.commentaire || "")}</textarea>
    </label>
    <div class="post-it-instructeur-actions">
      <small data-post-it-retour aria-live="polite"></small>
      <button type="button" data-post-it-enregistrer>Enregistrer</button>
    </div>
  </article>`;
}

function installerPostItsInstructeurGDA() {
  document.querySelectorAll("[data-post-it-suivi]").forEach(function (postIt) {
    postIt.querySelectorAll("[data-post-it-service]").forEach(function (bouton) {
      bouton.addEventListener("click", async function () {
        const boutons = postIt.querySelectorAll("[data-post-it-service]");
        boutons.forEach(function (element) { element.disabled = true; });
        try {
          const resultat = await requeteRapportInstructeur(
            "mettreAJourMonSuiviInstructeur",
            {
              suiviId: postIt.dataset.postItSuivi,
              variationService: bouton.dataset.postItService
            },
            "POST"
          );
          postIt.querySelector("[data-post-it-services]").textContent =
            Number(resultat.suivi.prisesService || 0);
          modifierCachePostItInstructeurGDA(postIt.dataset.postItSuivi, {
            prisesService: Number(resultat.suivi.prisesService || 0)
          });
          afficherRetourPostItInstructeurGDA(postIt, "Compteur enregistré.", false);
        } catch (erreur) {
          afficherRetourPostItInstructeurGDA(postIt, erreur.message || "Échec de l’enregistrement.", true);
        } finally {
          boutons.forEach(function (element) { element.disabled = false; });
        }
      });
    });
    postIt.querySelector("[data-post-it-enregistrer]")?.addEventListener("click", async function () {
      const bouton = this;
      const commentaire = postIt.querySelector("[data-post-it-commentaire]").value;
      bouton.disabled = true;
      bouton.textContent = "Enregistrement…";
      try {
        await requeteRapportInstructeur(
          "mettreAJourMonSuiviInstructeur",
          { suiviId: postIt.dataset.postItSuivi, commentaire: commentaire },
          "POST"
        );
        modifierCachePostItInstructeurGDA(postIt.dataset.postItSuivi, {
          commentaire: commentaire
        });
        afficherRetourPostItInstructeurGDA(postIt, "Commentaire enregistré.", false);
      } catch (erreur) {
        afficherRetourPostItInstructeurGDA(postIt, erreur.message || "Échec de l’enregistrement.", true);
      } finally {
        bouton.disabled = false;
        bouton.textContent = "Enregistrer";
      }
    });
  });
}

function afficherRetourPostItInstructeurGDA(postIt, message, erreur) {
  const retour = postIt.querySelector("[data-post-it-retour]");
  if (!retour) return;
  retour.textContent = message;
  retour.classList.toggle("erreur", erreur === true);
}

async function ouvrirSuivisFormationInstructeur(forcer) {
  if (
    typeof utilisateurPeutConsulterSuivisFormationGDA === "function" &&
    !utilisateurPeutConsulterSuivisFormationGDA()
  ) return;
  definirModuleGdaActif("instructeur-suivis-formation");
  const workspace = document.getElementById("workspace");
  if (!workspace) return;
  if (!suivisFormationInstructeurCharges && !forcer) {
    const cache = lireCacheSuivisFormationInstructeur();
    if (cache) appliquerDonneesSuivisFormationInstructeur(cache);
  }
  const donneesAffichees = suivisFormationInstructeurCharges;
  if (donneesAffichees) {
    afficherAccueilSuivisFormationInstructeur();
    if (!forcer && Date.now() - suivisFormationInstructeurChargesLe < DUREE_CACHE_SUIVIS_FORMATION_INSTRUCTEUR) {
      return;
    }
  } else {
    workspace.innerHTML = `
      <section class="suivis-instructeur-module">
        <div class="suivis-instructeur-message">Chargement des suivis de formation…</div>
      </section>
    `;
  }
  try {
    if (forcer && typeof gdaForcerActualisation === "function") {
      gdaForcerActualisation("recupererSuivisFormationInstructeur");
    }
    const resultat = await requeteRapportInstructeur(
      "recupererSuivisFormationInstructeur",
      {},
      "GET"
    );
    appliquerDonneesSuivisFormationInstructeur(resultat);
    enregistrerCacheSuivisFormationInstructeur(resultat);
    if (
      moduleGdaEstActif("instructeur-suivis-formation") &&
      (!donneesAffichees || document.getElementById("suivisInstructeurActualiser"))
    ) {
      afficherAccueilSuivisFormationInstructeur();
    }
  } catch (erreur) {
    if (donneesAffichees) {
      if (typeof afficherNotificationGDA === "function") {
        afficherNotificationGDA("Actualisation des suivis indisponible.", "erreur");
      }
      return;
    }
    if (!moduleGdaEstActif("instructeur-suivis-formation")) return;
    workspace.innerHTML = `
      <section class="suivis-instructeur-module">
        <div class="suivis-instructeur-message erreur">
          ${echapperRapportInstructeur(erreur.message || "Impossible de charger les suivis.")}
        </div>
      </section>
    `;
  }
}

function afficherAccueilSuivisFormationInstructeur() {
  const workspace = document.getElementById("workspace");
  if (!workspace || !moduleGdaEstActif("instructeur-suivis-formation")) return;
  workspace.innerHTML = `
    <section class="suivis-instructeur-module">
      <header class="suivis-instructeur-entete">
        <div>
          <span>Spécialisation Instructeur</span>
          <h3>📚 Suivis de formation</h3>
          <p>Gestion des périodes probatoires actuellement en cours.</p>
        </div>
        <div class="suivis-instructeur-actions-entete">
          ${suivisFormationPeutModifier
            ? '<button id="suivisInstructeurAjouterDossier" type="button">＋ Ajouter un dossier</button>'
            : ''}
          <button id="suivisInstructeurActualiser" type="button">↻ Actualiser</button>
        </div>
      </header>
      <section class="groupe-suivis-instructeur encours">
        <header class="banniere-suivis-instructeur">
          <div><span>⏳</span><strong>Suivis en cours</strong></div>
          <b>${suivisFormationInstructeur.length}</b>
        </header>
        <div class="liste-suivis-instructeur">
          ${suivisFormationInstructeur.length
            ? suivisFormationInstructeur.map(creerCarteSuiviInstructeur).join("")
            : '<div class="suivis-instructeur-message">Aucun suivi en cours.</div>'}
        </div>
      </section>
      ${nouveauxArrivantsInstructeur.length ? `
        <aside class="alertes-suivis-instructeur" aria-label="Personnes en attente">
          <header><span>🔔 Personne(s) en attente</span><b>${nouveauxArrivantsInstructeur.length}</b></header>
          <div class="alertes-suivis-instructeur-liste">
            ${nouveauxArrivantsInstructeur.map(creerAlerteNouvelArrivantInstructeur).join("")}
          </div>
        </aside>` : ""}
    </section>
  `;
  document.getElementById("suivisInstructeurAjouterDossier")?.addEventListener("click", function () {
    afficherFormulaireSuiviFormation();
  });
  document.getElementById("suivisInstructeurActualiser")?.addEventListener("click", function () {
    ouvrirSuivisFormationInstructeur(true);
  });
  document.querySelectorAll("[data-prendre-en-charge]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      const personne = nouveauxArrivantsInstructeur.find(function (element) {
        return element.id === bouton.dataset.prendreEnCharge;
      });
      if (personne) afficherPriseEnChargeNouvelArrivantInstructeur(personne);
    });
  });
  document.querySelectorAll("[data-suivi-id]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      suiviFormationOuvert = suiviFormationOuvert === bouton.dataset.suiviId ? "" : bouton.dataset.suiviId;
      afficherAccueilSuivisFormationInstructeur();
    });
  });
  document.querySelectorAll("[data-modifier-suivi]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      const suivi = suivisFormationInstructeur.find(function (element) {
        return element.id === bouton.dataset.modifierSuivi;
      });
      if (suivi) afficherModificationSuiviInstructeur(suivi);
    });
  });
  document.querySelectorAll("[data-supprimer-suivi]").forEach(function (bouton) {
    bouton.addEventListener("click", supprimerSuiviInstructeur);
  });
  document.querySelectorAll("[data-decision-suivi]").forEach(function (bouton) {
    bouton.addEventListener("click", deciderSuiviInstructeur);
  });
  document.querySelectorAll("[data-transferer-suivi]").forEach(function (bouton) {
    bouton.addEventListener("click", transfererGeranceSuiviInstructeur);
  });
}

function creerAlerteNouvelArrivantInstructeur(personne) {
  const formationEffectuee = personne.formationEffectuee === true;
  const action = suivisFormationPeutModifier
    ? `<button type="button" class="${formationEffectuee ? "" : "formation-attente"}" data-prendre-en-charge="${echapperRapportInstructeur(personne.id)}" ${formationEffectuee ? "" : "disabled"}>
        ${formationEffectuee ? "Prendre en charge" : "Formation en attente"}
      </button>`
    : `<button type="button" class="formation-attente" disabled>
        ${formationEffectuee ? "Prêt pour une prise en charge" : "Formation en attente"}
      </button>`;
  return `<article class="alerte-suivi-instructeur">
    <div>
      <strong>${echapperRapportInstructeur(personne.matricule)}</strong>
      <small>${formationEffectuee ? "Test et formation enregistrés · dossier prêt" : "Test accepté · rapport Formation requis"}</small>
    </div>
    ${action}
  </article>`;
}

function afficherPriseEnChargeNouvelArrivantInstructeur(personne) {
  if (!suivisFormationPeutModifier) return;
  const workspace = document.getElementById("workspace");
  if (!workspace || personne.formationEffectuee !== true) return;
  const identifiantsDifferents = personne.identifiantsConformes === false;
  const options = instructeursDisponiblesSuivi.map(function (instructeur) {
    return `<option value="${echapperRapportInstructeur(instructeur.nom)}">${echapperRapportInstructeur(instructeur.nom)} — ${echapperRapportInstructeur(instructeur.specialisation || "Instructeur")}</option>`;
  }).join("");
  workspace.innerHTML = `
    <section class="suivis-instructeur-module prise-en-charge-suivi">
      ${boutonRetourSuivisInstructeur()}
      <header class="suivis-instructeur-sous-entete">
        <h3>📂 Prendre en charge le dossier</h3>
        <p>Vérifiez et corrigez les informations avant de démarrer la période probatoire.</p>
      </header>
      <form data-demarrer-suivi="${echapperRapportInstructeur(personne.id)}" class="formulaire-suivi-instructeur formulaire-prise-en-charge">
        <input type="hidden" name="suiviId" value="${echapperRapportInstructeur(personne.id)}">
        ${identifiantsDifferents ? '<input type="hidden" name="identifiantsConfirmes" value="1">' : ""}
        ${champSuiviInstructeur("Matricule définitif *", "matricule", personne.matricule, "text", true)}
        ${identifiantsDifferents ? `
          <section class="comparaison-identifiants-formation large">
            <h4>⚠ Identifiants différents entre le Test et la Formation</h4>
            <div>
              <span><small>Steam ID — Test</small><strong>${echapperRapportInstructeur(personne.steamId || "Non renseigné")}</strong></span>
              <span><small>Steam ID — Formation</small><strong>${echapperRapportInstructeur(personne.steamIdFormation || "Non renseigné")}</strong></span>
              <span><small>Discord ID — Test</small><strong>${echapperRapportInstructeur(personne.discordId || "Non renseigné")}</strong></span>
              <span><small>Discord ID — Formation</small><strong>${echapperRapportInstructeur(personne.discordIdFormation || "Non renseigné")}</strong></span>
            </div>
            <p>Le gérant doit retaper ci-dessous les identifiants définitifs à conserver.</p>
          </section>
          ${champSuiviInstructeur("Steam ID définitif *", "steamId", "", "text", true)}
          ${champSuiviInstructeur("Discord ID définitif *", "discordId", "", "text", true)}
        ` : `
          ${champSuiviInstructeur("Steam ID *", "steamId", personne.steamId, "text", true)}
          ${champSuiviInstructeur("Discord ID *", "discordId", personne.discordId, "text", true)}
        `}
        ${champSuiviInstructeur("Date exacte de fin *", "dateFin", "", "date", true)}
        <label class="large"><span>Instructeur en charge *</span><select name="instructeur" required><option value="">Sélectionner un instructeur</option>${options}</select></label>
        <label class="large"><span>Gérant du dossier</span><input type="text" value="${echapperRapportInstructeur(gerantConnecteSuivi)}" readonly></label>
        <div class="retour-validation-suivi" aria-live="polite"></div>
        <button class="enregistrer-suivi-instructeur" type="submit">Prendre en charge et démarrer</button>
      </form>
    </section>
  `;
  installerRetourSuivisInstructeur();
  document.querySelector("[data-demarrer-suivi]")
    ?.addEventListener("submit", demarrerNouveauSuiviInstructeur);
}

function afficherNouveauxArrivantsInstructeur() {
  const workspace = document.getElementById("workspace");
  workspace.innerHTML = `
    <section class="suivis-instructeur-module">
      ${boutonRetourSuivisInstructeur()}
      <header class="suivis-instructeur-sous-entete"><h3>✨ Nouveaux arrivants</h3><p>Rapports acceptés qui ne possèdent pas encore de suivi.</p></header>
      <div class="nouveaux-arrivants-instructeur-liste">
        ${nouveauxArrivantsInstructeur.map(function (personne) {
          const ouverte = nouvelArrivantInstructeurOuvert === personne.id;
          return `<article class="nouvel-arrivant-suivi ${ouverte ? "ouverte" : ""}">
            <button type="button" class="resume-nouvel-arrivant" data-nouvel-arrivant-id="${echapperRapportInstructeur(personne.id)}">
              <strong>${echapperRapportInstructeur(personne.matricule)}</strong>
              <span><b>${Number(personne.nombreRapports || 0)}</b> rapport(s)</span>
              <span><b>${Number(personne.prisesService || 0)}</b> prise(s) de service</span>
              <span>Instructeur : <b>${personne.instructeur ? echapperRapportInstructeur(personne.instructeur) : "À attribuer"}</b></span>
              <span>Gérant : <b>${personne.gerant ? echapperRapportInstructeur(personne.gerant) : "En attente"}</b></span>
              <i>⌄</i>
            </button>
            ${ouverte ? creerValidationNouvelArrivantInstructeur(personne) : ""}
          </article>`;
        }).join("")}
      </div>
    </section>
  `;
  installerRetourSuivisInstructeur();
  document.querySelectorAll("[data-nouvel-arrivant-id]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      nouvelArrivantInstructeurOuvert =
        nouvelArrivantInstructeurOuvert === bouton.dataset.nouvelArrivantId
          ? ""
          : bouton.dataset.nouvelArrivantId;
      afficherNouveauxArrivantsInstructeur();
    });
  });
  document.querySelectorAll("[data-demarrer-suivi]").forEach(function (formulaire) {
    formulaire.addEventListener("submit", demarrerNouveauSuiviInstructeur);
  });
}

function creerValidationNouvelArrivantInstructeur(personne) {
  const options = instructeursDisponiblesSuivi.map(function (instructeur) {
    return `<option value="${echapperRapportInstructeur(instructeur.nom)}">${echapperRapportInstructeur(instructeur.nom)} — ${echapperRapportInstructeur(instructeur.specialisation || "Instructeur")}</option>`;
  }).join("");
  return `<div class="details-nouvel-arrivant">
    <div class="identifiants-nouvel-arrivant">
      ${detailSuiviInstructeur("Steam ID", personne.steamId)}
      ${detailSuiviInstructeur("Discord ID", personne.discordId)}
      ${detailSuiviInstructeur("Commentaire du test", personne.commentaire)}
    </div>
    <form data-demarrer-suivi="${echapperRapportInstructeur(personne.id)}" class="validation-nouvel-arrivant-formulaire">
      <input type="hidden" name="suiviId" value="${echapperRapportInstructeur(personne.id)}">
      <label><span>Instructeur en charge *</span><select name="instructeur" required><option value="">Sélectionner un instructeur</option>${options}</select></label>
      <label><span>Gérant validant</span><input type="text" value="${echapperRapportInstructeur(gerantConnecteSuivi)}" readonly></label>
      <label><span>Date exacte de fin *</span><input name="dateFin" type="date" required></label>
      <label><span>Sanction éventuelle</span><input name="sanction" type="text" placeholder="Aucune sanction"></label>
      <div class="retour-validation-suivi" aria-live="polite"></div>
      <button type="submit">Valider et commencer le suivi</button>
    </form>
  </div>`;
}

async function demarrerNouveauSuiviInstructeur(evenement) {
  evenement.preventDefault();
  evenement.stopPropagation();
  const formulaire = evenement.currentTarget;
  if (!formulaire.reportValidity()) return;
  const bouton = formulaire.querySelector("button[type=submit]");
  const retour = formulaire.querySelector(".retour-validation-suivi");
  bouton.disabled = true;
  bouton.textContent = "Validation…";
  try {
    const resultat = await requeteRapportInstructeur(
      "demarrerSuiviFormationInstructeur",
      Object.fromEntries(new FormData(formulaire).entries()),
      "POST"
    );
    if (typeof afficherNotificationGDA === "function") afficherNotificationGDA(resultat.message, "succes");
    nouvelArrivantInstructeurOuvert = "";
    await ouvrirSuivisFormationInstructeur(true);
  } catch (erreur) {
    retour.textContent = erreur.message || "Impossible de démarrer ce suivi.";
    bouton.disabled = false;
    bouton.textContent = "Prendre en charge et démarrer";
  }
}

function afficherFormulaireSuiviFormation(personne) {
  if (!suivisFormationPeutModifier) return;
  personne = personne || {};
  const workspace = document.getElementById("workspace");
  const instructeur = personne.instructeur ||
    sessionStorage.getItem("identifiantUtilisateur") || "";
  workspace.innerHTML = `
    <section class="suivis-instructeur-module">
      ${boutonRetourSuivisInstructeur()}
      <header class="suivis-instructeur-sous-entete"><h3>＋ Ajouter un suivi</h3><p>Création d’une période probatoire dans le document mémoire.</p></header>
      <form id="formulaireAjoutSuiviInstructeur" class="formulaire-suivi-instructeur">
        <input type="hidden" name="rapportId" value="${echapperRapportInstructeur(personne.rapportId || "")}">
        ${champSuiviInstructeur("Matricule *", "matricule", personne.matricule, "text", true)}
        ${champSuiviInstructeur("Steam ID *", "steamId", personne.steamId, "text", true)}
        ${champSuiviInstructeur("Discord ID *", "discordId", personne.discordId, "text", true)}
        ${champSuiviInstructeur("Date de fin de période *", "dateFin", "", "date", true)}
        ${champSuiviInstructeur("Instructeur en charge", "instructeur", instructeur, "text", false)}
        ${champSuiviInstructeur("Gérant", "gerant", "", "text", false)}
        ${champSuiviInstructeur("Nombre de rapports", "nombreRapports", "0", "number", false)}
        ${champSuiviInstructeur("Prises de service", "prisesService", "0", "number", false)}
        <label class="large"><span>Commentaire</span><textarea name="commentaire" rows="4"></textarea></label>
        <label class="large"><span>Sanction</span><textarea name="sanction" rows="3"></textarea></label>
        <div id="retourAjoutSuiviInstructeur" class="retour-formulaire-suivi"></div>
        <button class="enregistrer-suivi-instructeur" type="submit">Ajouter au suivi</button>
      </form>
    </section>
  `;
  installerRetourSuivisInstructeur();
  document.getElementById("formulaireAjoutSuiviInstructeur")
    ?.addEventListener("submit", enregistrerAjoutSuiviInstructeur);
}

function champSuiviInstructeur(libelle, nom, valeur, type, requis) {
  return `<label><span>${libelle}</span><input name="${nom}" type="${type}" value="${echapperRapportInstructeur(valeur || "")}" ${type === "number" ? 'min="0" step="1"' : ""} ${requis ? "required" : ""}></label>`;
}

async function enregistrerAjoutSuiviInstructeur(evenement) {
  evenement.preventDefault();
  const formulaire = evenement.currentTarget;
  if (!formulaire.reportValidity()) return;
  const bouton = formulaire.querySelector("button[type=submit]");
  const retour = document.getElementById("retourAjoutSuiviInstructeur");
  bouton.disabled = true;
  bouton.textContent = "Enregistrement…";
  try {
    const resultat = await requeteRapportInstructeur(
      "ajouterSuiviFormationInstructeur",
      Object.fromEntries(new FormData(formulaire).entries()),
      "POST"
    );
    if (typeof afficherNotificationGDA === "function") afficherNotificationGDA(resultat.message, "succes");
    await ouvrirSuivisFormationInstructeur(true);
  } catch (erreur) {
    retour.textContent = erreur.message || "Impossible d’ajouter ce suivi.";
    retour.className = "retour-formulaire-suivi erreur";
    bouton.disabled = false;
    bouton.textContent = "Ajouter au suivi";
  }
}

function afficherListeSuivisFormationInstructeur() {
  const workspace = document.getElementById("workspace");
  workspace.innerHTML = `
    <section class="suivis-instructeur-module">
      ${boutonRetourSuivisInstructeur()}
      <header class="suivis-instructeur-sous-entete"><h3>⏳ Suivis en cours</h3><p>${suivisFormationInstructeur.length} période(s) probatoire(s) active(s).</p></header>
      <div class="liste-suivis-instructeur">
        ${suivisFormationInstructeur.length ? suivisFormationInstructeur.map(creerCarteSuiviInstructeur).join("") : '<div class="suivis-instructeur-message">Aucun suivi en cours.</div>'}
      </div>
    </section>
  `;
  installerRetourSuivisInstructeur();
  document.querySelectorAll("[data-suivi-id]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      suiviFormationOuvert = suiviFormationOuvert === bouton.dataset.suiviId ? "" : bouton.dataset.suiviId;
      afficherListeSuivisFormationInstructeur();
    });
  });
  document.querySelectorAll("[data-modifier-suivi]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      const suivi = suivisFormationInstructeur.find(function (element) {
        return element.id === bouton.dataset.modifierSuivi;
      });
      if (suivi) afficherModificationSuiviInstructeur(suivi);
    });
  });
  document.querySelectorAll("[data-supprimer-suivi]").forEach(function (bouton) {
    bouton.addEventListener("click", supprimerSuiviInstructeur);
  });
  document.querySelectorAll("[data-decision-suivi]").forEach(function (bouton) {
    bouton.addEventListener("click", deciderSuiviInstructeur);
  });
  document.querySelectorAll("[data-transferer-suivi]").forEach(function (bouton) {
    bouton.addEventListener("click", transfererGeranceSuiviInstructeur);
  });
}

function creerCarteSuiviInstructeur(suivi) {
  const ouverte = suiviFormationOuvert === suivi.id;
  return `<article class="carte-suivi-instructeur ${ouverte ? "ouverte" : ""}">
    <button type="button" class="resume-suivi-instructeur" data-suivi-id="${echapperRapportInstructeur(suivi.id)}">
      <strong>${echapperRapportInstructeur(suivi.matricule)}</strong>
      <span><b>${Number(suivi.joursRestants || 0)}</b> jour(s) restant(s)</span>
      <span>Instructeur : <b>${valeurSuiviInstructeur(suivi.instructeur)}</b></span>
      <span>Gérant : <b>${valeurSuiviInstructeur(suivi.gerant)}</b></span>
      <em class="${suivi.absent ? "absent" : ""}">${suivi.absent
        ? "Absent"
        : (suivi.statut ? valeurSuiviInstructeur(suivi.statut) : "En cours")}</em>
      <i>⌄</i>
    </button>
    ${ouverte ? `<div class="details-suivi-instructeur">
      ${detailSuiviInstructeur("Discord ID", suivi.discordId)}
      ${detailSuiviInstructeur("Steam ID", suivi.steamId)}
      ${detailSuiviInstructeur("Nombre de rapports", suivi.nombreRapports)}
      ${detailSuiviInstructeur("Prises de service", suivi.prisesService)}
      ${detailSuiviInstructeur("Date exacte de fin", suivi.dateFin)}
      ${Number(suivi.joursAbsencePlanifies || 0) > 0 && suivi.dateFinApresAbsence
        ? detailSuiviInstructeur(
            "Date de fin après absence",
            suivi.dateFinApresAbsence,
            "detail-suivi-absence"
          )
        : ""}
      ${detailSuiviInstructeur("Commentaire", suivi.commentaire)}
      ${detailSuiviInstructeur("Sanction", suivi.sanction)}
      ${creerActionsSuiviInstructeur(suivi)}
    </div>` : ""}
  </article>`;
}

function creerActionsSuiviInstructeur(suivi) {
  const administration = suivisFormationPeutModifier ? `
    <button type="button" class="modifier" data-modifier-suivi="${echapperRapportInstructeur(suivi.id)}">✎ Modifier</button>
    <button type="button" class="supprimer" data-supprimer-suivi="${echapperRapportInstructeur(suivi.id)}">🗑 Supprimer</button>
  ` : "";
  const decision = suivi.peutDecider ? `
    <button type="button" class="accepter" data-decision-suivi="${echapperRapportInstructeur(suivi.id)}" data-decision="ACCEPTE">✓ Accepter</button>
    <button type="button" class="refuser" data-decision-suivi="${echapperRapportInstructeur(suivi.id)}" data-decision="REFUSE">✕ Refuser</button>
  ` : "";
  const gerantActuel = normaliserValeurRapportInstructeur(suivi.gerant);
  const optionsGerants = gerantsDisponiblesSuivi.filter(function (gerant) {
    return normaliserValeurRapportInstructeur(gerant.libelle) !== gerantActuel;
  }).map(function (gerant) {
    return `<option value="${echapperRapportInstructeur(gerant.nom)}">${echapperRapportInstructeur(gerant.libelle)}${gerant.grade ? " — " + echapperRapportInstructeur(gerant.grade) : ""}</option>`;
  }).join("");
  const transfert = suivi.peutTransferer && optionsGerants ? `
    <span class="transfert-gerance-suivi">
      <select aria-label="Nouveau gérant" data-nouveau-gerant-suivi="${echapperRapportInstructeur(suivi.id)}">
        <option value="">Nouveau gérant…</option>${optionsGerants}
      </select>
      <button type="button" class="transferer" data-transferer-suivi="${echapperRapportInstructeur(suivi.id)}">⇄ Transférer</button>
    </span>
  ` : "";
  return administration || decision || transfert
    ? `<div class="actions-suivi-instructeur">${administration}${decision}${transfert}</div>`
    : "";
}

function afficherModificationSuiviInstructeur(suivi) {
  if (!suivisFormationPeutModifier) return;
  const workspace = document.getElementById("workspace");
  const options = instructeursDisponiblesSuivi.map(function (instructeur) {
    const selectionne = normaliserValeurRapportInstructeur(instructeur.nom) ===
      normaliserValeurRapportInstructeur(suivi.instructeur);
    return `<option value="${echapperRapportInstructeur(instructeur.nom)}" ${selectionne ? "selected" : ""}>${echapperRapportInstructeur(instructeur.nom)}</option>`;
  }).join("");
  workspace.innerHTML = `
    <section class="suivis-instructeur-module">
      ${boutonRetourSuivisInstructeur()}
      <header class="suivis-instructeur-sous-entete"><h3>✎ Modifier le suivi</h3><p>${echapperRapportInstructeur(suivi.matricule)}</p></header>
      <form id="formulaireModificationSuiviInstructeur" class="formulaire-suivi-instructeur">
        <input type="hidden" name="suiviId" value="${echapperRapportInstructeur(suivi.id)}">
        ${champSuiviInstructeur("Matricule *", "matricule", suivi.matricule, "text", true)}
        ${champSuiviInstructeur("Steam ID *", "steamId", suivi.steamId, "text", true)}
        ${champSuiviInstructeur("Discord ID *", "discordId", suivi.discordId, "text", true)}
        ${champSuiviInstructeur("Date de fin *", "dateFin", convertirDateSuiviEnISO(suivi.dateFin), "date", true)}
        <label><span>Instructeur *</span><select name="instructeur" required>${options}</select></label>
        ${champSuiviInstructeur("Gérant *", "gerant", suivi.gerant, "text", true)}
        ${champSuiviInstructeur("Nombre de rapports", "nombreRapports", suivi.nombreRapports, "number", false)}
        ${champSuiviInstructeur("Prises de service", "prisesService", suivi.prisesService, "number", false)}
        <label class="large"><span>Commentaire</span><textarea name="commentaire" rows="4">${echapperRapportInstructeur(suivi.commentaire || "")}</textarea></label>
        <label class="large"><span>Sanction</span><textarea name="sanction" rows="3">${echapperRapportInstructeur(suivi.sanction || "")}</textarea></label>
        <div id="retourModificationSuivi" class="retour-formulaire-suivi"></div>
        <button class="enregistrer-suivi-instructeur" type="submit">Enregistrer les modifications</button>
      </form>
    </section>
  `;
  installerRetourSuivisInstructeur();
  document.getElementById("formulaireModificationSuiviInstructeur")
    ?.addEventListener("submit", enregistrerModificationSuiviInstructeur);
}

async function enregistrerModificationSuiviInstructeur(evenement) {
  evenement.preventDefault();
  const formulaire = evenement.currentTarget;
  if (!formulaire.reportValidity()) return;
  const bouton = formulaire.querySelector("button[type=submit]");
  const retour = document.getElementById("retourModificationSuivi");
  bouton.disabled = true;
  try {
    const resultat = await requeteRapportInstructeur(
      "modifierSuiviFormationInstructeur",
      Object.fromEntries(new FormData(formulaire).entries()),
      "POST"
    );
    if (typeof afficherNotificationGDA === "function") afficherNotificationGDA(resultat.message, "succes");
    await ouvrirSuivisFormationInstructeur(true);
  } catch (erreur) {
    retour.textContent = erreur.message || "Modification impossible.";
    retour.className = "retour-formulaire-suivi erreur";
    bouton.disabled = false;
  }
}

async function supprimerSuiviInstructeur(evenement) {
  if (!suivisFormationPeutModifier) return;
  const id = evenement.currentTarget.dataset.supprimerSuivi;
  const suivi = suivisFormationInstructeur.find(function (element) { return element.id === id; });
  if (!suivi || !window.confirm("Supprimer définitivement le suivi de " + suivi.matricule + " ?")) return;
  try {
    const resultat = await requeteRapportInstructeur(
      "supprimerSuiviFormationInstructeur",
      { suiviId: id },
      "POST"
    );
    if (typeof afficherNotificationGDA === "function") afficherNotificationGDA(resultat.message, "succes");
    await ouvrirSuivisFormationInstructeur(true);
  } catch (erreur) {
    if (typeof afficherNotificationGDA === "function") afficherNotificationGDA(erreur.message, "erreur");
  }
}

async function deciderSuiviInstructeur(evenement) {
  const bouton = evenement.currentTarget;
  const decision = bouton.dataset.decision;
  let raison = "";
  if (decision === "REFUSE") {
    raison = window.prompt("Indiquez la raison du refus :") || "";
    if (!raison.trim()) return;
  } else if (!window.confirm("Confirmer l’acceptation de cette personne ?")) {
    return;
  }
  bouton.disabled = true;
  try {
    const resultat = await requeteRapportInstructeur(
      "deciderSuiviFormationInstructeur",
      { suiviId: bouton.dataset.decisionSuivi, decision: decision, raison: raison },
      "POST"
    );
    if (typeof afficherNotificationGDA === "function") afficherNotificationGDA(resultat.message, "succes");
    await ouvrirSuivisFormationInstructeur(true);
  } catch (erreur) {
    bouton.disabled = false;
    if (typeof afficherNotificationGDA === "function") afficherNotificationGDA(erreur.message, "erreur");
  }
}

async function transfererGeranceSuiviInstructeur(evenement) {
  const bouton = evenement.currentTarget;
  const suiviId = bouton.dataset.transfererSuivi;
  const selecteur = document.querySelector(
    '[data-nouveau-gerant-suivi="' + CSS.escape(suiviId) + '"]'
  );
  const nouveauGerant = selecteur ? selecteur.value : "";
  if (!nouveauGerant) {
    if (typeof afficherNotificationGDA === "function") {
      afficherNotificationGDA("Choisissez d’abord le nouveau gérant.", "erreur");
    }
    return;
  }
  const suivi = suivisFormationInstructeur.find(function (element) {
    return element.id === suiviId;
  });
  if (!window.confirm(
    "Transférer la gérance du suivi de " + (suivi ? suivi.matricule : "cette personne") +
    " à " + nouveauGerant + " ?"
  )) return;
  bouton.disabled = true;
  try {
    const resultat = await requeteRapportInstructeur(
      "transfererGeranceSuiviFormationInstructeur",
      { suiviId: suiviId, nouveauGerant: nouveauGerant },
      "POST"
    );
    if (typeof afficherNotificationGDA === "function") {
      afficherNotificationGDA(resultat.message, "succes");
    }
    await ouvrirSuivisFormationInstructeur(true);
  } catch (erreur) {
    bouton.disabled = false;
    if (typeof afficherNotificationGDA === "function") {
      afficherNotificationGDA(erreur.message, "erreur");
    }
  }
}

function convertirDateSuiviEnISO(valeur) {
  const morceaux = String(valeur || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return morceaux ? morceaux[3] + "-" + morceaux[2] + "-" + morceaux[1] : "";
}

function detailSuiviInstructeur(libelle, valeur, classeSupplementaire) {
  const large = normaliserValeurRapportInstructeur(libelle).includes("COMMENTAIRE");
  const classes = [
    large ? "detail-suivi-large" : "",
    classeSupplementaire || ""
  ].filter(Boolean).join(" ");
  return `<div class="${classes}"><span>${libelle}</span><strong>${valeurSuiviInstructeur(valeur)}</strong></div>`;
}

function valeurSuiviInstructeur(valeur) {
  return echapperRapportInstructeur(
    valeur === null || valeur === undefined || String(valeur).trim() === ""
      ? "Non renseigné"
      : String(valeur)
  );
}

function boutonRetourSuivisInstructeur() {
  return '<button id="retourAccueilSuivisInstructeur" class="retour-suivis-instructeur" type="button">← Retour aux suivis</button>';
}

function installerRetourSuivisInstructeur() {
  document.getElementById("retourAccueilSuivisInstructeur")
    ?.addEventListener("click", afficherAccueilSuivisFormationInstructeur);
}
