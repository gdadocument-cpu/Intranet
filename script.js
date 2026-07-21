const API_URL =
  "https://script.google.com/macros/s/AKfycbwQ1OJoI3wgBkViyxMEMmYC5jbxqfHevWf4cuEnewi5er5pPSWovSJM2UgoddhrB955kA/exec";

const username = document.getElementById("username");
const loginForm = document.getElementById("login");
const loginButton = document.getElementById("loginButton");
const rememberDiscord = document.getElementById("rememberDiscord");
const CLE_SOUVENIR_DISCORD = "gdaDiscordRemember";
const VERSION_CACHE_GDA = "20260717-5";
const CLE_VERSION_CACHE_GDA = "gdaCacheVersion";

function initialiserCacheVersionneGDA() {
  try {
    if (localStorage.getItem(CLE_VERSION_CACHE_GDA) === VERSION_CACHE_GDA) return;
    const prefixesDonnees = [
      "gdaArchivesInstructeur:",
      "gdaRapportsInstructeur:",
      "gdaSuivisFormationInstructeur:",
      "gdaPostItsInstructeur:"
    ];
    Object.keys(localStorage).forEach(function(cle) {
      if (prefixesDonnees.some(function(prefixe) { return cle.startsWith(prefixe); })) {
        localStorage.removeItem(cle);
      }
    });
    localStorage.setItem(CLE_VERSION_CACHE_GDA, VERSION_CACHE_GDA);
  } catch (erreur) {
    /* Le site reste utilisable lorsque le stockage local est désactivé. */
  }
}

initialiserCacheVersionneGDA();

const loading = document.getElementById("loading");
const progress = document.getElementById("progress");
const percent = document.getElementById("percent");
const bootText = document.getElementById("bootText");

const bar = document.getElementById("bar");
const alertOverlay = document.getElementById("alertOverlay");

let minuteurPresenceEnLigne = null;
let utilisateursEnLigne = [];
let minuteurNotificationsAbsence = null;
let notificationsAbsenceGDA = [];
let menuOfficierOuvert = false;
let menuEspaceGdaOuvert = false;
let menuSpecialisationsOuvert = false;
let menuInstructeurOuvert = false;
let menuLiensUtilesOuvert = false;
let menuAdministrationOuvert = false;
let moduleGdaActif = "";

function definirModuleGdaActif(nom) {
  moduleGdaActif = String(nom || "");
}

function moduleGdaEstActif(nom) {
  return moduleGdaActif === String(nom || "");
}

function animerChargementProgressifGDA(conteneur) {
  if (!conteneur || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.requestAnimationFrame(function() {
    const racines = Array.from(conteneur.children).slice(0, 3);
    const blocs = [];
    racines.forEach(function(racine) {
      blocs.push(racine);
      Array.from(racine.children).slice(0, 16).forEach(function(enfant) { blocs.push(enfant); });
      Array.from(racine.querySelectorAll("article")).slice(8).forEach(function(carte) { carte.classList.add("gda-rendu-differe"); });
    });
    blocs.slice(0, 18).forEach(function(bloc, index) {
      if (bloc.classList.contains("gda-revelation")) return;
      bloc.classList.add("gda-revelation");
      bloc.style.setProperty("--gda-reveal-delay", Math.min(index * 28, 196) + "ms");
    });
    window.requestAnimationFrame(function() {
      blocs.forEach(function(bloc) { bloc.classList.add("gda-revelation-visible"); });
    });
  });
}

function initialiserChargementProgressifGDA() {
  const espace = document.getElementById("workspace");
  if (!espace || espace.dataset.revelationObservee === "1") return;
  espace.dataset.revelationObservee = "1";
  new MutationObserver(function(mutations) {
    if (mutations.some(function(mutation) { return mutation.addedNodes.length > 0; })) animerChargementProgressifGDA(espace);
  }).observe(espace, { childList:true, subtree:true });
  animerChargementProgressifGDA(espace);
}

initialiserChargementProgressifGDA();

const MEDECIN_GDA_URL = "medecin/index.html?v=20260721-5";
const REGLEMENT_GDA_URL =
  "https://docs.google.com/document/d/1w2HBmk0RJdvvOpNMIZAMVUFpqUNaYaICc9SgZDBYrzA/preview";
const GUIDE_GDA_URL =
  "https://sites.google.com/view/guide-gda/guide?authuser=0";
const COURS_MARTIAL_URL =
  "https://docs.google.com/document/d/1bow1cKtKiLF3Z83qvz9XSoERj5IGiwj7MAVvhUfshAA/preview";
const REGLEMENT_INSTRUCTEUR_URL =
  "https://docs.google.com/document/d/1g1QKhrcpjdNO6pQ1OUS9foEXCd0wkRIieAeVe1Y8Wos/preview";

function formaterDateHeureGDA(valeur, valeurVide) {
  if (valeur === null || valeur === undefined || valeur === "") {
    return valeurVide || "Non renseignée";
  }

  let date = null;
  if (valeur instanceof Date) {
    date = new Date(valeur.getTime());
  } else if (typeof valeur === "number" && Number.isFinite(valeur)) {
    date = new Date(valeur < 100000000000 ? valeur * 1000 : valeur);
  } else {
    const texte = String(valeur).trim();
    const francais = texte.match(
      /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T,]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
    );
    const iso = texte.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (francais) {
      date = new Date(
        Number(francais[3]),
        Number(francais[2]) - 1,
        Number(francais[1]),
        Number(francais[4] || 0),
        Number(francais[5] || 0),
        Number(francais[6] || 0)
      );
    } else if (iso) {
      date = new Date(
        Number(iso[1]),
        Number(iso[2]) - 1,
        Number(iso[3]),
        Number(iso[4] || 0),
        Number(iso[5] || 0),
        Number(iso[6] || 0)
      );
    } else if (/^\d{10,13}$/.test(texte)) {
      const timestamp = Number(texte);
      date = new Date(texte.length === 10 ? timestamp * 1000 : timestamp);
    } else {
      const candidate = new Date(texte);
      if (!isNaN(candidate.getTime())) date = candidate;
    }
  }

  if (!date || isNaN(date.getTime())) {
    return valeurVide || "Non renseignée";
  }

  const deuxChiffres = function(nombre) {
    return String(nombre).padStart(2, "0");
  };
  return deuxChiffres(date.getDate()) + "/" +
    deuxChiffres(date.getMonth() + 1) + "/" +
    String(date.getFullYear()).padStart(4, "0") + " " +
    deuxChiffres(date.getHours()) + ":" +
    deuxChiffres(date.getMinutes()) + ":" +
    deuxChiffres(date.getSeconds());
}

const officierGdaButton = document.getElementById("officierGdaButton");
const retourOfficierButton = document.getElementById("retourOfficierButton");
const espaceGdaButton = document.getElementById("espaceGdaButton");
const effectifMembreGdaButton = document.getElementById("effectifMembreGdaButton");
const rapportMembreGdaButton = document.getElementById("rapportMembreGdaButton");
const demandeAbsenceGdaButton = document.getElementById("demandeAbsenceGdaButton");
const retourEspaceGdaButton = document.getElementById("retourEspaceGdaButton");
const specialisationsButton = document.getElementById("specialisationsButton");
const instructeurButton = document.getElementById("instructeurButton");
const suivisFormationInstructeurButton = document.getElementById("suivisFormationInstructeurButton");
const rapportInstructeurButton = document.getElementById("rapportInstructeurButton");
const reglementInstructeurButton = document.getElementById("reglementInstructeurButton");
const archivesInstructeurButton = document.getElementById("archivesInstructeurButton");
const retourInstructeurButton = document.getElementById("retourInstructeurButton");
const medecinButton = document.getElementById("medecinButton");
const retourSpecialisationsButton = document.getElementById("retourSpecialisationsButton");
const liensUtilesButton = document.getElementById("liensUtilesButton");
const reglementGdaButton = document.getElementById("reglementGdaButton");
const guideGdaButton = document.getElementById("guideGdaButton");
const coursMartialButton = document.getElementById("coursMartialButton");
const retourLiensUtilesButton = document.getElementById("retourLiensUtilesButton");
const recommandationsObservationsButton = document.getElementById("recommandationsObservationsButton");
const administrationButton = document.getElementById("administrationButton");
const retourAdministrationButton = document.getElementById("retourAdministrationButton");

if (officierGdaButton) {
  officierGdaButton.addEventListener("click", ouvrirMenuOfficierGDA);
}
if (retourOfficierButton) {
  retourOfficierButton.addEventListener("click", fermerMenuOfficierGDA);
}
if (espaceGdaButton) {
  espaceGdaButton.addEventListener("click", ouvrirMenuEspaceGDA);
}
if (effectifMembreGdaButton) {
  effectifMembreGdaButton.addEventListener("click", ouvrirEffectifMembreGDA);
}
if (rapportMembreGdaButton) {
  rapportMembreGdaButton.addEventListener("click", ouvrirRapportMembreGDA);
}
if (demandeAbsenceGdaButton) {
  demandeAbsenceGdaButton.addEventListener("click", ouvrirDemandeAbsenceGDA);
}
if (retourEspaceGdaButton) {
  retourEspaceGdaButton.addEventListener("click", fermerMenuEspaceGDA);
}
if (specialisationsButton) {
  specialisationsButton.addEventListener("click", ouvrirMenuSpecialisationsGDA);
}
if (instructeurButton) {
  instructeurButton.addEventListener("click", ouvrirEspaceInstructeurGDA);
}
if (suivisFormationInstructeurButton) {
  suivisFormationInstructeurButton.addEventListener("click", ouvrirSuivisFormationInstructeurGDA);
}
if (rapportInstructeurButton) {
  rapportInstructeurButton.addEventListener("click", ouvrirRapportInstructeurGDA);
}
if (reglementInstructeurButton) {
  reglementInstructeurButton.addEventListener("click", ouvrirReglementInstructeurGDA);
}
if (archivesInstructeurButton) {
  archivesInstructeurButton.addEventListener("click", ouvrirArchivesInstructeurGDA);
}
if (retourInstructeurButton) {
  retourInstructeurButton.addEventListener("click", fermerMenuInstructeurGDA);
}
if (medecinButton) {
  medecinButton.addEventListener("click", ouvrirEspaceMedecinGDA);
}
if (retourSpecialisationsButton) {
  retourSpecialisationsButton.addEventListener("click", fermerMenuSpecialisationsGDA);
}
if (liensUtilesButton) {
  liensUtilesButton.addEventListener("click", ouvrirMenuLiensUtilesGDA);
}
if (reglementGdaButton) {
  reglementGdaButton.addEventListener("click", ouvrirReglementGDA);
}
if (guideGdaButton) {
  guideGdaButton.addEventListener("click", ouvrirGuideGDA);
}
if (coursMartialButton) {
  coursMartialButton.addEventListener("click", ouvrirCoursMartialGDA);
}
if (retourLiensUtilesButton) {
  retourLiensUtilesButton.addEventListener("click", fermerMenuLiensUtilesGDA);
}
if (recommandationsObservationsButton) {
  recommandationsObservationsButton.addEventListener("click", function () {
    if (typeof ouvrirRecommandationsObservationsGDA === "function") {
      ouvrirRecommandationsObservationsGDA();
    }
  });
}
if (administrationButton) {
  administrationButton.addEventListener("click", ouvrirMenuAdministrationGDA);
}
if (retourAdministrationButton) {
  retourAdministrationButton.addEventListener("click", fermerMenuAdministrationGDA);
}

const fetchNatifGDA = window.fetch.bind(window);

const ACTIONS_LECTURE_GDA = new Set([
  "recupererEffectif",
  "recupererRecommandationsObservations",
  "recupererEffectifPublic",
  "recupererDisponibilites",
  "recupererDeparts",
  "recupererRapports",
  "recupererMesRapports",
  "recupererMesDemandesAbsence",
  "recupererNotifications",
  "recupererGestionPersonnel",
  "recupererAdministration",
  "recupererListeBlanche",
  "recupererJournalActions",
  "recupererArchivesInstructeur",
  "recupererRapportsInstructeur",
  "recupererCandidatsRapportFormationInstructeur",
  "recupererSuivisFormationInstructeur",
  "recupererMesSuivisInstructeur"
]);
const cacheLecturesGDA = new Map();
const requetesLecturesGDA = new Map();
const actualisationsForceesGDA = new Set();
const DUREE_CACHE_LECTURE_GDA = 2 * 60 * 1000;
const CLE_CACHE_SESSION_API_GDA = "gdaApiCacheSessionV2";
const TAILLE_MAX_CACHE_SESSION_GDA = 1500000;
const DELAI_MAX_API_GDA = 45 * 1000;
let sessionPrechargeeGDA = "";
let sessionCacheHydrateGDA = "";
let minuteurSauvegardeCacheGDA = null;
const INVALIDATIONS_CACHE_GDA = {
  appliquerGestionPersonnel: ["recupererGestionPersonnel", "recupererEffectif", "recupererEffectifPublic", "recupererDeparts"],
  modifierLogGestionPersonnel: ["recupererGestionPersonnel"],
  supprimerLogGestionPersonnel: ["recupererGestionPersonnel"],
  modifierMembreEffectif: ["recupererEffectif", "recupererEffectifPublic", "recupererGestionPersonnel", "recupererAdministration"],
  ajouterMembreEffectif: ["recupererEffectif", "recupererEffectifPublic", "recupererGestionPersonnel", "recupererAdministration"],
  enregistrerRapportTestInstructeur: ["recupererRapportsInstructeur", "recupererSuivisFormationInstructeur", "recupererMesSuivisInstructeur"],
  enregistrerRapportFormationInstructeur: ["recupererRapportsInstructeur", "recupererSuivisFormationInstructeur"],
  modifierRapportInstructeur: ["recupererRapportsInstructeur", "recupererSuivisFormationInstructeur", "recupererMesSuivisInstructeur"],
  supprimerRapportInstructeur: ["recupererRapportsInstructeur", "recupererSuivisFormationInstructeur", "recupererMesSuivisInstructeur"],
  ajouterSuiviFormationInstructeur: ["recupererSuivisFormationInstructeur", "recupererMesSuivisInstructeur", "recupererEffectif", "recupererEffectifPublic", "recupererGestionPersonnel", "recupererAdministration"],
  demarrerSuiviFormationInstructeur: ["recupererSuivisFormationInstructeur", "recupererMesSuivisInstructeur", "recupererEffectif", "recupererEffectifPublic", "recupererGestionPersonnel", "recupererAdministration"],
  modifierSuiviFormationInstructeur: ["recupererSuivisFormationInstructeur", "recupererMesSuivisInstructeur"],
  supprimerSuiviFormationInstructeur: ["recupererSuivisFormationInstructeur", "recupererMesSuivisInstructeur"],
  transfererGeranceSuiviFormationInstructeur: ["recupererSuivisFormationInstructeur", "recupererMesSuivisInstructeur"],
  deciderSuiviFormationInstructeur: ["recupererSuivisFormationInstructeur", "recupererMesSuivisInstructeur", "recupererArchivesInstructeur", "recupererEffectif", "recupererEffectifPublic", "recupererGestionPersonnel", "recupererAdministration", "recupererDeparts"],
  mettreAJourMonSuiviInstructeur: ["recupererSuivisFormationInstructeur", "recupererMesSuivisInstructeur"],
  supprimerArchiveInstructeur: ["recupererArchivesInstructeur"],
  ajouterListeBlanche: ["recupererAdministration"],
  modifierListeBlanche: ["recupererAdministration"],
  supprimerListeBlanche: ["recupererAdministration"],
  ajouterRecommandationObservation: ["recupererRecommandationsObservations", "recupererEffectif"],
  modifierRecommandationObservation: ["recupererRecommandationsObservations", "recupererEffectif"],
  purgerRecommandationsObservations: ["recupererRecommandationsObservations", "recupererEffectif"]
};

function hydraterCacheSessionGDA(sessionToken) {
  if (!sessionToken || sessionCacheHydrateGDA === sessionToken) return;
  sessionCacheHydrateGDA = sessionToken;
  try {
    const donnees = JSON.parse(sessionStorage.getItem(CLE_CACHE_SESSION_API_GDA) || "[]");
    const maintenant = Date.now();
    if (!Array.isArray(donnees)) return;
    donnees.forEach(function(element) {
      if (!element || element.sessionToken !== sessionToken || maintenant - Number(element.enregistreLe || 0) >= DUREE_CACHE_LECTURE_GDA) return;
      cacheLecturesGDA.set(element.cle, element);
    });
  } catch (erreur) {
    sessionStorage.removeItem(CLE_CACHE_SESSION_API_GDA);
  }
}

function sauvegarderCacheSessionGDA() {
  window.clearTimeout(minuteurSauvegardeCacheGDA);
  minuteurSauvegardeCacheGDA = window.setTimeout(function() {
    try {
      const maintenant = Date.now();
      const elements = Array.from(cacheLecturesGDA.entries())
        .filter(function(item) { return maintenant - item[1].enregistreLe < DUREE_CACHE_LECTURE_GDA; })
        .sort(function(a, b) { return b[1].enregistreLe - a[1].enregistreLe; })
        .map(function(item) { return Object.assign({ cle:item[0] }, item[1]); });
      while (elements.length && JSON.stringify(elements).length > TAILLE_MAX_CACHE_SESSION_GDA) elements.pop();
      sessionStorage.setItem(CLE_CACHE_SESSION_API_GDA, JSON.stringify(elements));
    } catch (erreur) {
      /* Le cache mémoire continue de fonctionner si le quota est indisponible. */
    }
  }, 80);
}

function reconstruireReponseGDA(entree) {
  return new Response(entree.corps, {
    status: entree.statut,
    statusText: entree.texteStatut,
    headers: entree.entetes
  });
}

async function securiserReponseJsonGDA(reponse) {
  const corps = await reponse.text();
  try {
    JSON.parse(corps);
    return new Response(corps, {
      status: reponse.status,
      statusText: reponse.statusText,
      headers: Array.from(reponse.headers.entries())
    });
  } catch (erreur) {
    return new Response(JSON.stringify({
      success: false,
      message: "Google Apps Script a renvoyé une page HTML au lieu des données. Redéployez la dernière version du script, autorisez ses accès puis reconnectez-vous."
    }), {
      status: 502,
      statusText: "Réponse serveur invalide",
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
}

function fetchApiAvecDelaiGDA(ressource, options) {
  const controleur = new AbortController();
  const optionsFinales = Object.assign({}, options || {}, {
    signal: controleur.signal
  });
  const signalExterne = options && options.signal;
  const annulerDepuisExterieur = function() { controleur.abort(); };
  if (signalExterne) {
    if (signalExterne.aborted) controleur.abort();
    else signalExterne.addEventListener("abort", annulerDepuisExterieur, { once: true });
  }
  const minuteur = window.setTimeout(function() {
    controleur.abort();
  }, DELAI_MAX_API_GDA);

  return fetchNatifGDA(ressource, optionsFinales)
    .catch(function(erreur) {
      if (controleur.signal.aborted && !(signalExterne && signalExterne.aborted)) {
        throw new Error("Le serveur GDA met trop de temps à répondre. Réessayez dans quelques secondes.");
      }
      throw erreur;
    })
    .finally(function() {
      window.clearTimeout(minuteur);
      if (signalExterne) {
        signalExterne.removeEventListener("abort", annulerDepuisExterieur);
      }
    });
}

function viderCacheLecturesGDA() {
  cacheLecturesGDA.clear();
  sauvegarderCacheSessionGDA();
}

function invaliderCacheLecturesActionsGDA(actions) {
  const cibles = new Set(Array.isArray(actions) ? actions : []);
  cibles.add("recupererJournalActions");
  for (const [cle, entree] of cacheLecturesGDA.entries()) {
    if (cibles.has(entree.action)) cacheLecturesGDA.delete(cle);
  }
  sauvegarderCacheSessionGDA();
  if (
    cibles.has("recupererEffectif") &&
    typeof window.invaliderCacheEffectifGDA === "function"
  ) window.invaliderCacheEffectifGDA();
  if (
    cibles.has("recupererArchivesInstructeur") &&
    typeof window.invaliderCacheArchivesInstructeurGDA === "function"
  ) window.invaliderCacheArchivesInstructeurGDA();
  if (
    cibles.has("recupererRapportsInstructeur") &&
    typeof window.invaliderCacheRapportsInstructeurGDA === "function"
  ) window.invaliderCacheRapportsInstructeurGDA();
  if (
    (cibles.has("recupererSuivisFormationInstructeur") ||
      cibles.has("recupererMesSuivisInstructeur")) &&
    typeof window.invaliderCacheSuivisInstructeurGDA === "function"
  ) window.invaliderCacheSuivisInstructeurGDA();
}

window.gdaForcerActualisation = function(action) {
  if (action) actualisationsForceesGDA.add(action);
};

window.gdaReponseEnCache = function(action) {
  const maintenant = Date.now();
  const sessionToken = sessionStorage.getItem("sessionTokenDiscord") || "";
  hydraterCacheSessionGDA(sessionToken);
  for (const entree of cacheLecturesGDA.values()) {
    if (
      entree.action === action &&
      entree.sessionToken === sessionToken &&
      maintenant - entree.enregistreLe < DUREE_CACHE_LECTURE_GDA
    ) return true;
  }
  for (const entree of requetesLecturesGDA.values()) {
    if (entree.action === action && entree.sessionToken === sessionToken) return true;
  }
  return false;
};

window.fetch = function(ressource, options) {
  const adresse =
    typeof ressource === "string"
      ? ressource
      : ressource instanceof URL
        ? ressource.toString()
        : "";
  const sessionToken =
    sessionStorage.getItem("sessionTokenDiscord") || "";

  if (adresse && adresse.startsWith(API_URL) && sessionToken) {
    hydraterCacheSessionGDA(sessionToken);
    const url = new URL(adresse);
    url.searchParams.set("sessionToken", sessionToken);
    // L'identité provient exclusivement de la session Discord. Retirer ce
    // paramètre rend les URLs de préchargement et d'ouverture strictement
    // identiques, donc réellement partageables par le cache.
    url.searchParams.delete("identifiant");
    const action = url.searchParams.get("action") || "";
    const methode = String(
      options && options.method ? options.method : "GET"
    ).toUpperCase();
    const lecture = methode === "GET" && ACTIONS_LECTURE_GDA.has(action);

    if (!lecture) {
      if (action && INVALIDATIONS_CACHE_GDA[action]) {
        invaliderCacheLecturesActionsGDA(INVALIDATIONS_CACHE_GDA[action]);
      } else if (action) {
        viderCacheLecturesGDA();
      }
      return fetchApiAvecDelaiGDA(url.toString(), options).then(securiserReponseJsonGDA);
    }

    const forcee =
      actualisationsForceesGDA.delete(action) ||
      url.searchParams.has("_") ||
      url.searchParams.get("forcer") === "1";
    url.searchParams.delete("_");
    const cle = url.toString();
    const maintenant = Date.now();
    const cache = cacheLecturesGDA.get(cle);

    if (
      !forcee &&
      cache &&
      maintenant - cache.enregistreLe < DUREE_CACHE_LECTURE_GDA
    ) {
      return Promise.resolve(reconstruireReponseGDA(cache));
    }

    if (!forcee && requetesLecturesGDA.has(cle)) {
      return requetesLecturesGDA.get(cle).promesse.then(reconstruireReponseGDA);
    }

    const promesse = fetchApiAvecDelaiGDA(url.toString(), options)
      .then(async function(reponse) {
        const corps = await reponse.text();
        const entree = {
          action: action,
          sessionToken: sessionToken,
          corps: corps,
          statut: reponse.status,
          texteStatut: reponse.statusText,
          entetes: Array.from(reponse.headers.entries()),
          enregistreLe: Date.now()
        };
        let resultat = null;
        try { resultat = JSON.parse(corps); } catch (erreur) { /* Réponse non JSON. */ }
        if (!resultat) {
          entree.corps = JSON.stringify({
            success: false,
            message: "Google Apps Script a renvoyé une page HTML au lieu des données. Redéployez la dernière version du script, autorisez ses accès puis reconnectez-vous."
          });
          entree.statut = 502;
          entree.texteStatut = "Réponse serveur invalide";
          entree.entetes = [["content-type", "application/json; charset=utf-8"]];
        }
        if (reponse.ok && resultat && resultat.success !== false) {
          cacheLecturesGDA.set(cle, entree);
          sauvegarderCacheSessionGDA();
        }
        return entree;
      })
      .finally(function() {
        requetesLecturesGDA.delete(cle);
      });

    requetesLecturesGDA.set(cle, {
      action: action,
      sessionToken: sessionToken,
      promesse: promesse
    });
    return promesse.then(reconstruireReponseGDA);
  }

  return fetchNatifGDA(ressource, options);
};

function prechargerDonneesGDA() {
  const sessionToken = sessionStorage.getItem("sessionTokenDiscord") || "";
  if (!sessionToken || sessionPrechargeeGDA === sessionToken) return;
  hydraterCacheSessionGDA(sessionToken);
  sessionPrechargeeGDA = sessionToken;

  const actions = [
    "recupererEffectifPublic",
    "recupererMesRapports",
    "recupererMesDemandesAbsence"
  ];
  if (utilisateurEstOfficierGDA()) {
    actions.unshift("recupererEffectif");
    actions.push(
      "recupererEffectif",
      "recupererDisponibilites",
      "recupererDeparts",
      "recupererRapports",
      "recupererGestionPersonnel",
      "recupererRecommandationsObservations"
    );
    if (
      utilisateurAPermission("administration_staff") &&
      utilisateurAPermission("administration_permissions")
    ) {
      actions.push("recupererAdministration", "recupererListeBlanche");
    }
    if (
      utilisateurAPermission("administration_staff") &&
      utilisateurAPermission("administration_logs")
    ) {
      actions.push("recupererJournalActions");
    }
  }
  if (utilisateurPeutAccederEspaceInstructeurGDA()) {
    actions.push("recupererRapportsInstructeur", "recupererCandidatsRapportFormationInstructeur");
  }
  if (utilisateurPeutConsulterSuivisFormationGDA()) actions.push("recupererSuivisFormationInstructeur");
  if (utilisateurPeutConsulterArchivesInstructeurGDA()) actions.push("recupererArchivesInstructeur");

  const demarrer = function() {
    const file = Array.from(new Set(actions));
    const executerSuivante = async function() {
      while (file.length) {
        const action = file.shift();
        try {
          await window.fetch(API_URL + "?action=" + encodeURIComponent(action));
        } catch (erreur) {
          /* Le préchargement ne bloque jamais l'interface. */
        }
      }
    };
    // Deux lectures parallèles au maximum : Apps Script répond plus vite et
    // les clics restent fluides même lorsque plusieurs modules sont préchargés.
    Promise.allSettled([executerSuivante(), executerSuivante()]);
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(demarrer, { timeout: 800 });
  } else {
    window.setTimeout(demarrer, 300);
  }
}

loginForm.addEventListener("submit", async function(e) {
  e.preventDefault();

  const identifiant = username.value.trim();

  if (!identifiant) {
    alert("Veuillez saisir votre matricule.");
    return;
  }

  sessionStorage.removeItem("sessionTokenDiscord");
  localStorage.removeItem(CLE_SOUVENIR_DISCORD);

  const popupDiscord = window.open(
    "about:blank",
    "gdaDiscordOAuth",
    "width=520,height=760,resizable=yes,scrollbars=yes"
  );

  if (!popupDiscord) {
    alert("Autorisez les fenêtres surgissantes pour vous connecter avec Discord.");
    return;
  }

  try {
    popupDiscord.document.title = "Connexion Discord";
    popupDiscord.document.body.innerHTML =
      '<p style="font-family:Arial;text-align:center;margin-top:40px">Préparation de Discord...</p>';

    loginButton.disabled = true;
    username.disabled = true;
    rememberDiscord.disabled = true;
    loading.style.display = "block";
    bar.style.display = "none";
    percent.style.display = "none";
    bootText.textContent = "Vérification du nom dans l’effectif...";

    const url = API_URL +
      "?action=preparerConnexionDiscord" +
      "&identifiant=" + encodeURIComponent(identifiant) +
      "&resterConnecte=" + (rememberDiscord.checked ? "1" : "0");
    const reponse = await fetch(url);
    const preparation = await reponse.json();

    if (!preparation.success || !preparation.authorizeUrl) {
      throw new Error(
        preparation.message || "Impossible de préparer la connexion Discord."
      );
    }

    const attenteDiscord = attendreRetourDiscord(
      popupDiscord,
      preparation.tentative
    );
    bootText.textContent = "Connectez-vous avec le compte Discord associé...";
    popupDiscord.location.replace(preparation.authorizeUrl);
    const resultat = await attenteDiscord;

    if (!resultat.success) {
      afficherAccesRefuse(
        identifiant,
        "Discord non vérifié",
        resultat.message || "Ce compte Discord ne correspond pas."
      );
      return;
    }

    terminerConnexionDiscord(resultat, identifiant);
  } catch (erreur) {
    console.error(erreur);
    if (popupDiscord && !popupDiscord.closed) popupDiscord.close();
    loginButton.disabled = false;
    username.disabled = false;
    rememberDiscord.disabled = false;
    loading.style.display = "none";
    alert(erreur.message || "Impossible de contacter le serveur GDA.");
  }
});

async function tenterRestaurationDiscord() {
  let souvenir;
  try {
    souvenir = JSON.parse(localStorage.getItem(CLE_SOUVENIR_DISCORD) || "null");
  } catch (erreur) {
    souvenir = null;
  }

  if (
    !souvenir ||
    !souvenir.token ||
    !souvenir.expireLe ||
    Date.now() >= Number(souvenir.expireLe)
  ) {
    localStorage.removeItem(CLE_SOUVENIR_DISCORD);
    return;
  }

  rememberDiscord.checked = true;
  if (souvenir.nom) username.value = souvenir.nom;
  loginButton.disabled = true;
  username.disabled = true;
  rememberDiscord.disabled = true;
  loading.style.display = "block";
  bar.style.display = "none";
  percent.style.display = "none";
  bootText.textContent = "Restauration de votre connexion sécurisée...";

  try {
    const url = API_URL +
      "?action=restaurerSessionDiscord" +
      "&rememberToken=" + encodeURIComponent(souvenir.token);
    const reponse = await fetchNatifGDA(url);
    const resultat = await reponse.json();
    if (!resultat.success || !resultat.sessionToken) {
      throw new Error(resultat.message || "Connexion mémorisée invalide.");
    }
    terminerConnexionDiscord(resultat, resultat.nom || souvenir.nom || "");
  } catch (erreur) {
    console.warn("Connexion mémorisée non restaurée :", erreur);
    localStorage.removeItem(CLE_SOUVENIR_DISCORD);
    rememberDiscord.checked = false;
    loginButton.disabled = false;
    username.disabled = false;
    rememberDiscord.disabled = false;
    loading.style.display = "none";
  }
}

tenterRestaurationDiscord();

function attendreRetourDiscord(popupDiscord, tentative) {
  return new Promise(function(resolve, reject) {
    let termine = false;
    let verificationEnCours = false;
    let retourDiscordPret = false;
    let popupFermeeLe = 0;

    const nettoyer = function() {
      window.removeEventListener("message", recevoir);
      clearInterval(surveillance);
      clearTimeout(expiration);
    };

    const recevoir = function(event) {
      if (termine || event.source !== popupDiscord) return;
      let hote = "";
      try {
        hote = new URL(event.origin).hostname;
      } catch (erreur) {
        return;
      }
      if (
        hote !== "script.google.com" &&
        hote !== "script.googleusercontent.com" &&
        hote !== "gdadocument-cpu.github.io" &&
        !hote.endsWith(".googleusercontent.com")
      ) return;
      if (!event.data || event.data.type !== "GDA_DISCORD_AUTH_READY") return;
      retourDiscordPret = true;
    };

    window.addEventListener("message", recevoir);

    const surveillance = setInterval(async function() {
      if (termine || verificationEnCours) return;
      verificationEnCours = true;
      try {
        const url = API_URL +
          "?action=recupererConnexionDiscord" +
          "&tentative=" + encodeURIComponent(tentative || "");
        const reponse = await fetchNatifGDA(url);
        const resultat = await reponse.json();
        if (resultat.pending === false) {
          termine = true;
          nettoyer();
          if (!popupDiscord.closed) popupDiscord.close();
          resolve(resultat);
          return;
        }
        if (resultat.success === false) {
          termine = true;
          nettoyer();
          if (!popupDiscord.closed) popupDiscord.close();
          reject(new Error(
            resultat.message || "Impossible de vérifier la connexion Discord."
          ));
          return;
        }
      } catch (erreur) {
        console.warn("Vérification Discord en attente :", erreur);
      } finally {
        verificationEnCours = false;
      }

      if (!termine && popupDiscord.closed && !retourDiscordPret) {
        if (!popupFermeeLe) popupFermeeLe = Date.now();
        if (Date.now() - popupFermeeLe >= 15000) {
          termine = true;
          nettoyer();
          reject(new Error(
            "La fenêtre Discord a été fermée sans résultat de validation."
          ));
        }
      } else if (!popupDiscord.closed) {
        popupFermeeLe = 0;
      }
    }, 900);

    const expiration = setTimeout(function() {
      if (termine) return;
      termine = true;
      nettoyer();
      if (!popupDiscord.closed) popupDiscord.close();
      reject(new Error("La connexion Discord a expiré."));
    }, 5 * 60 * 1000);
  });
}

function terminerConnexionDiscord(resultat, identifiant) {
  const nom = resultat.nom || resultat.matricule || identifiant;
  sessionStorage.setItem("nomUtilisateur", nom);
  sessionStorage.setItem("gradeUtilisateur", resultat.grade || "");
  sessionStorage.setItem(
    "gradeEffectifPublicUtilisateur",
    resultat.gradeAffiche || resultat.grade || ""
  );
  sessionStorage.setItem(
    "specialisationUtilisateur",
    resultat.specialisation || ""
  );
  sessionStorage.setItem("identifiantUtilisateur", nom);
  sessionStorage.setItem("sessionTokenDiscord", resultat.sessionToken || "");
  sessionStorage.setItem(
    "permissionsUtilisateur",
    JSON.stringify(Array.isArray(resultat.permissions) ? resultat.permissions : [])
  );
  sessionStorage.setItem(
    "proprietaireUtilisateur",
    resultat.proprietaire === true ? "true" : "false"
  );
  sessionStorage.setItem(
    "coproprietaireUtilisateur",
    resultat.coproprietaire === true ? "true" : "false"
  );

  if (resultat.rememberToken && Number(resultat.rememberExpires) > Date.now()) {
    localStorage.setItem(CLE_SOUVENIR_DISCORD, JSON.stringify({
      token: resultat.rememberToken,
      expireLe: Number(resultat.rememberExpires),
      nom: nom
    }));
  }

  loginForm.style.display = "none";
  loading.style.display = "block";
  bar.style.display = "block";
  percent.style.display = "block";
  progress.style.width = "0%";
  percent.textContent = "0%";
  bootText.textContent = "Identité Discord vérifiée...";
  if (typeof chargerPostItsInstructeurGDA === "function") {
    chargerPostItsInstructeurGDA();
  }
  lancerChargement();
}


// Écran rouge fixe en cas de refus
function afficherAccesRefuse(nom, grade, message) {
  loginForm.style.display = "none";
  loading.style.display = "block";

  bar.style.display = "none";
  percent.style.display = "none";

  if (alertOverlay) {
    alertOverlay.classList.add("visible");
  }

  bootText.innerHTML = `
    <div style="position:relative; z-index:10; line-height:1.6;">

      <div style="
        color:#ff3030;
        font-size:40px;
        font-weight:800;
        letter-spacing:4px;
        text-shadow:
          0 0 10px #ff0000,
          0 0 25px rgba(255,0,0,.9);
      ">
        ACCÈS REFUSÉ
      </div>

      <div style="
        color:#ff9a9a;
        font-size:25px;
        font-weight:700;
        margin-top:18px;
      ">
        ${echapperHTML(grade)}
      </div>

      <div style="
        color:#ffffff;
        font-size:21px;
        margin-top:5px;
      ">
        ${echapperHTML(nom)}
      </div>

      <div style="
        color:#ffd0d0;
        font-size:18px;
        margin-top:22px;
      ">
        ${echapperHTML(message)}
      </div>

      <div style="
        color:#d68c8c;
        font-size:14px;
        margin-top:20px;
      ">
        Rechargez la page pour effectuer une nouvelle tentative.
      </div>

    </div>
  `;
}


// Chargement après validation
function lancerChargement() {
  let valeur = 0;

  const messages = [
    "Connexion au serveur sécurisé...",
    "Chargement des modules...",
    "Accès autorisé."
  ];

  const timer = setInterval(function () {
    valeur++;

    progress.style.width = valeur + "%";
    percent.textContent = valeur + "%";

    if (valeur === 35) {
      bootText.textContent = messages[1];
    }

    if (valeur === 70) {
      bootText.textContent = messages[2];
    }

    if (valeur >= 100) {
      clearInterval(timer);

      const nom =
        sessionStorage.getItem("nomUtilisateur") || "";

      const grade =
        sessionStorage.getItem("gradeEffectifPublicUtilisateur") ||
        sessionStorage.getItem("gradeUtilisateur") || "";

      bar.style.display = "none";
      percent.style.display = "none";

      bootText.innerHTML = `
        <div style="line-height:1.6">

          <div style="
            color:#44ff44;
            font-size:38px;
            font-weight:800;
            letter-spacing:4px;
            text-shadow:
              0 0 10px #00ff00,
              0 0 25px rgba(0,255,0,.8);
          ">
            ACCÈS AUTORISÉ
          </div>

          <div style="
            color:#83c5ff;
            font-size:25px;
            font-weight:700;
            margin-top:16px;
          ">
            ${echapperHTML(grade)}
          </div>

          <div style="
            color:#ffffff;
            font-size:21px;
            margin-top:4px;
          ">
            ${echapperHTML(nom)}
          </div>

        </div>
      `;

      const boot = document.getElementById("boot");
      const desktop = document.getElementById("desktop");

      setTimeout(function () {
        boot.classList.add("fade-out");

        setTimeout(function () {
          boot.style.display = "none";
          desktop.classList.add("visible");

          afficherUtilisateur();
        }, 300);

      }, 800);
    }

  }, 4);
}


// Affiche le grade au-dessus du nom
function afficherUtilisateur() {
  const nom =
    sessionStorage.getItem("nomUtilisateur") || "Utilisateur";

  const grade =
    sessionStorage.getItem("gradeEffectifPublicUtilisateur") ||
    sessionStorage.getItem("gradeUtilisateur") ||
    "Grade inconnu";

  let blocUtilisateur =
    document.getElementById("userInfo");

  if (!blocUtilisateur) {
    blocUtilisateur = document.createElement("div");
    blocUtilisateur.id = "userInfo";

    const topbar = document.getElementById("topbar");

    if (topbar) {
      topbar.appendChild(blocUtilisateur);
    }
  }

  blocUtilisateur.innerHTML = `
    <strong>${echapperHTML(grade)}</strong>
    <span>${echapperHTML(nom)}</span>
  `;

  initialiserPresenceEnLigne(blocUtilisateur);
  initialiserNotificationsAbsenceGDA(blocUtilisateur);
  appliquerVisibiliteModulesGDA();
  if (typeof chargerPostItsInstructeurGDA === "function") {
    chargerPostItsInstructeurGDA();
  }
  prechargerDonneesGDA();
}


function obtenirPermissionsUtilisateur() {
  try {
    const permissions = JSON.parse(
      sessionStorage.getItem(
        "permissionsUtilisateur"
      ) || "[]"
    );
    return Array.isArray(permissions)
      ? permissions
      : [];
  } catch (erreur) {
    return [];
  }
}


function utilisateurAPermission(permission) {
  const permissions = obtenirPermissionsUtilisateur();
  if (permissions.includes(permission)) return true;
  return permissions.includes("administration") && [
    "administration_staff",
    "administration_permissions",
    "administration_logs"
  ].includes(permission);
}


function utilisateurEstOfficierGDA() {
  if (utilisateurAPermission("role_staff_total")) return true;
  const grade = String(sessionStorage.getItem("gradeUtilisateur") || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const gradesOfficiers = [
    "LIEUTENANTCOLONEL",
    "COMMANDANT",
    "VICECOMMANDANT",
    "CAPITAINE",
    "LIEUTENANT",
    "SOUSLIEUTENANT",
    "ASPIRANT"
  ];
  return gradesOfficiers.includes(grade);
}

function utilisateurEstOfficierSuperieurGDA() {
  if (utilisateurAPermission("role_staff_total")) return true;
  const grade = String(sessionStorage.getItem("gradeUtilisateur") || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return ["LIEUTENANTCOLONEL", "COMMANDANT", "VICECOMMANDANT"].includes(grade);
}

function utilisateurEstProprietaireOuCoproprietaireGDA() {
  return sessionStorage.getItem("proprietaireUtilisateur") === "true" ||
    sessionStorage.getItem("coproprietaireUtilisateur") === "true" ||
    utilisateurAPermission("role_staff_total");
}

function utilisateurEstProprietaireOuCoproprietaireReelGDA() {
  return sessionStorage.getItem("proprietaireUtilisateur") === "true" ||
    sessionStorage.getItem("coproprietaireUtilisateur") === "true";
}

function normaliserSpecialisationsUtilisateurGDA() {
  return String(sessionStorage.getItem("specialisationUtilisateur") || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function utilisateurPossedeSpecialisationGDA(specialisation) {
  const specialisations = normaliserSpecialisationsUtilisateurGDA();
  const cible = String(specialisation || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  const geranceGDA =
    specialisations.includes("GERANT GDA") ||
    sessionStorage.getItem("proprietaireUtilisateur") === "true" ||
    sessionStorage.getItem("coproprietaireUtilisateur") === "true";
  const accesMedecin = geranceGDA ||
    specialisations.includes("RESPONSABLE MDC") ||
    specialisations.includes("MEDECIN");
  const accesInstructeur = geranceGDA ||
    specialisations.includes("RESPONSABLE INST") ||
    specialisations.includes("INSTRUCTEUR");

  if (cible === "MEDECIN") return accesMedecin;
  if (cible === "INSTRUCTEUR") return accesInstructeur;
  return !!cible && specialisations.includes(cible);
}

function utilisateurPossedeSpecialisationVisibleGDA() {
  return utilisateurPossedeSpecialisationGDA("Médecin") ||
    utilisateurPeutAccederEspaceInstructeurGDA();
}

function utilisateurPossedeRoleGestionInstructeurGDA() {
  const specialisations = normaliserSpecialisationsUtilisateurGDA();
  return specialisations.includes("RESPONSABLE INST") ||
    specialisations.includes("INSTRUCTEUR EN CHEF");
}

function utilisateurEstResponsableInstPrincipalGDA() {
  const specialisations = normaliserSpecialisationsUtilisateurGDA();
  const coResponsable = specialisations.includes("CO RESPONSABLE INST");
  return specialisations.includes("RESPONSABLE INST") && !coResponsable;
}

function utilisateurPeutConsulterSuivisFormationGDA() {
  return utilisateurEstProprietaireOuCoproprietaireGDA() ||
    utilisateurEstOfficierGDA() ||
    utilisateurPossedeRoleGestionInstructeurGDA() ||
    utilisateurAPermission("suivis_decider_tous");
}

function utilisateurPeutAdministrerSuivisFormationGDA() {
  return utilisateurEstProprietaireOuCoproprietaireGDA() ||
    utilisateurPossedeRoleGestionInstructeurGDA();
}

function utilisateurPeutConsulterArchivesInstructeurGDA() {
  return utilisateurEstProprietaireOuCoproprietaireGDA() ||
    utilisateurEstOfficierSuperieurGDA() ||
    utilisateurEstResponsableInstPrincipalGDA();
}

function utilisateurPeutAccederEspaceInstructeurGDA() {
  return utilisateurPossedeSpecialisationGDA("Instructeur") ||
    utilisateurPeutConsulterSuivisFormationGDA() ||
    utilisateurPeutConsulterArchivesInstructeurGDA();
}

function appliquerVisibiliteModulesGDA() {
  const officier = utilisateurEstOfficierGDA();
  const specialisationInstructeur =
    utilisateurPossedeSpecialisationGDA("Instructeur");
  const accesSuivisFormation = utilisateurPeutConsulterSuivisFormationGDA();
  const accesArchivesInstructeur = utilisateurPeutConsulterArchivesInstructeurGDA();
  const accesEspaceInstructeur = utilisateurPeutAccederEspaceInstructeurGDA();
  const specialisationMedecin =
    utilisateurPossedeSpecialisationGDA("Médecin");
  const specialisationVisible = accesEspaceInstructeur || specialisationMedecin;
  if (menuSpecialisationsOuvert && !specialisationVisible) {
    menuSpecialisationsOuvert = false;
    menuInstructeurOuvert = false;
  }
  if (menuInstructeurOuvert && !accesEspaceInstructeur) {
    menuInstructeurOuvert = false;
  }
  const accesStaffAdministration = utilisateurAPermission("administration_staff");
  if (menuAdministrationOuvert && !accesStaffAdministration) {
    menuAdministrationOuvert = false;
  }
  const sousMenuOuvert =
    menuOfficierOuvert ||
    menuEspaceGdaOuvert ||
    menuSpecialisationsOuvert ||
    menuLiensUtilesOuvert ||
    menuAdministrationOuvert;
  const boutonsOfficiers = [
    "effectifButton",
    "recommandationsObservationsButton",
    "disponibilitesButton",
    "rapportsButton",
    "departButton",
    "gestionPersonnelButton"
  ];

  boutonsOfficiers.forEach(function (id) {
    const bouton = document.getElementById(id);
    if (bouton) bouton.hidden = !officier || !menuOfficierOuvert;
  });

  const entreeOfficier = document.getElementById("officierGdaButton");
  const retourOfficier = document.getElementById("retourOfficierButton");
  if (entreeOfficier) entreeOfficier.hidden = !officier || sousMenuOuvert;
  if (retourOfficier) retourOfficier.hidden = !officier || !menuOfficierOuvert;

  const entreeEspaceGda = document.getElementById("espaceGdaButton");
  const boutonsEspaceGda = [
    "effectifMembreGdaButton",
    "rapportMembreGdaButton",
    "demandeAbsenceGdaButton",
    "retourEspaceGdaButton"
  ];
  if (entreeEspaceGda) {
    entreeEspaceGda.hidden = sousMenuOuvert;
  }
  boutonsEspaceGda.forEach(function (id) {
    const bouton = document.getElementById(id);
    if (bouton) bouton.hidden = !menuEspaceGdaOuvert;
  });

  const entreeSpecialisations = document.getElementById("specialisationsButton");
  if (entreeSpecialisations) {
    entreeSpecialisations.hidden = sousMenuOuvert || !specialisationVisible;
  }
  const instructeur = document.getElementById("instructeurButton");
  const medecin = document.getElementById("medecinButton");
  const retourSpecialisations = document.getElementById("retourSpecialisationsButton");
  if (instructeur) {
    instructeur.hidden =
      !menuSpecialisationsOuvert || menuInstructeurOuvert || !accesEspaceInstructeur;
  }
  if (medecin) {
    medecin.hidden =
      !menuSpecialisationsOuvert || menuInstructeurOuvert || !specialisationMedecin;
  }
  if (retourSpecialisations) {
    retourSpecialisations.hidden = !menuSpecialisationsOuvert || menuInstructeurOuvert;
  }
  if (suivisFormationInstructeurButton) {
    suivisFormationInstructeurButton.hidden =
      !menuInstructeurOuvert || !accesSuivisFormation;
  }
  if (rapportInstructeurButton) {
    rapportInstructeurButton.hidden =
      !menuInstructeurOuvert || !specialisationInstructeur;
  }
  if (reglementInstructeurButton) {
    reglementInstructeurButton.hidden =
      !menuInstructeurOuvert || !specialisationInstructeur;
  }
  if (archivesInstructeurButton) {
    archivesInstructeurButton.hidden =
      !menuInstructeurOuvert || !accesArchivesInstructeur;
  }
  if (retourInstructeurButton) {
    retourInstructeurButton.hidden = !menuInstructeurOuvert;
  }

  const entreeLiensUtiles = document.getElementById("liensUtilesButton");
  const boutonsLiensUtiles = [
    "reglementGdaButton",
    "guideGdaButton",
    "coursMartialButton",
    "retourLiensUtilesButton"
  ];
  if (entreeLiensUtiles) {
    entreeLiensUtiles.hidden = sousMenuOuvert;
  }
  boutonsLiensUtiles.forEach(function (id) {
    const bouton = document.getElementById(id);
    if (bouton) bouton.hidden = !menuLiensUtilesOuvert;
  });

  const administration = document.getElementById("administrationButton");
  const permissions = document.getElementById("permissionsButton");
  const logs = document.getElementById("logsButton");
  const listeBlanche = document.getElementById("listeBlancheButton");
  const retourAdministration = document.getElementById("retourAdministrationButton");
  if (administration) {
    administration.hidden =
      !accesStaffAdministration || sousMenuOuvert;
  }
  if (permissions) {
    permissions.hidden =
      !menuAdministrationOuvert ||
      !accesStaffAdministration ||
      !utilisateurAPermission("administration_permissions");
  }
  if (logs) {
    logs.hidden =
      !menuAdministrationOuvert ||
      !accesStaffAdministration ||
      !utilisateurAPermission("administration_logs");
  }
  if (listeBlanche) {
    listeBlanche.hidden =
      !menuAdministrationOuvert ||
      !(utilisateurEstProprietaireOuCoproprietaireReelGDA() ||
        utilisateurAPermission("role_staff_total"));
  }
  if (retourAdministration) {
    retourAdministration.hidden = !menuAdministrationOuvert;
  }

  const sidebar = document.getElementById("sidebar");
  const desktop = document.getElementById("desktop");
  const workspace = document.getElementById("workspace");
  if (sidebar) sidebar.hidden = false;
  if (desktop) desktop.classList.remove("mode-membre");

  if (!officier && workspace) {
    workspace.innerHTML = `
      <section id="welcomePanel" class="welcome-membre">
        <div class="welcome-membre-icone" aria-hidden="true">✓</div>
        <h3>Connexion validée</h3>
        <p>
          Bienvenue dans votre espace GDA.<br>
          Sélectionnez l’un des espaces disponibles dans le menu de gauche.
        </p>
      </section>
    `;
  }
}

function ouvrirMenuAdministrationGDA() {
  if (
    !utilisateurAPermission("administration_staff")
  ) return;

  menuOfficierOuvert = false;
  menuEspaceGdaOuvert = false;
  menuSpecialisationsOuvert = false;
  menuInstructeurOuvert = false;
  menuLiensUtilesOuvert = false;
  menuAdministrationOuvert = true;
  definirModuleGdaActif("");
  appliquerVisibiliteModulesGDA();

  const modules = [];
  if (utilisateurAPermission("administration_permissions")) {
    modules.push("Permissions");
  }
  if (utilisateurAPermission("administration_logs")) {
    modules.push("Logs");
  }
  if (utilisateurEstProprietaireOuCoproprietaireReelGDA()) {
    modules.push("Liste blanche");
  }
  afficherAccueilMenuGDA(
    "Administration",
    modules.length
      ? "Sélectionnez " + modules.join(" ou ") + " dans le menu de gauche."
      : "Aucun module d’administration supplémentaire ne vous a encore été attribué."
  );
}

function fermerMenuAdministrationGDA() {
  menuAdministrationOuvert = false;
  appliquerVisibiliteModulesGDA();
  afficherAccueilMenuGDA(
    "Bienvenue dans l’interface GDA",
    "Sélectionnez un espace dans le menu de gauche."
  );
}

function ouvrirMenuOfficierGDA() {
  if (!utilisateurEstOfficierGDA()) return;
  menuEspaceGdaOuvert = false;
  menuSpecialisationsOuvert = false;
  menuInstructeurOuvert = false;
  menuLiensUtilesOuvert = false;
  menuOfficierOuvert = true;
  definirModuleGdaActif("");
  appliquerVisibiliteModulesGDA();
  afficherAccueilMenuGDA(
    "Espace Officier GDA",
    "Sélectionnez un module dans le menu de gauche."
  );
}

function fermerMenuOfficierGDA() {
  menuOfficierOuvert = false;
  appliquerVisibiliteModulesGDA();
  afficherAccueilMenuGDA(
    "Bienvenue dans l’interface GDA",
    "Sélectionnez un espace dans le menu de gauche."
  );
}

function ouvrirMenuEspaceGDA() {
  menuOfficierOuvert = false;
  menuSpecialisationsOuvert = false;
  menuInstructeurOuvert = false;
  menuLiensUtilesOuvert = false;
  menuEspaceGdaOuvert = true;
  definirModuleGdaActif("menu-gda");
  appliquerVisibiliteModulesGDA();
  afficherAccueilMenuGDA(
    "Espace GDA",
    "Sélectionnez Effectif, Rapport ou Demande d’absence dans le menu de gauche."
  );
}

function fermerMenuEspaceGDA() {
  menuEspaceGdaOuvert = false;
  definirModuleGdaActif("");
  appliquerVisibiliteModulesGDA();
  afficherAccueilMenuGDA(
    "Bienvenue dans l’interface GDA",
    "Sélectionnez un espace dans le menu de gauche."
  );
}

function ouvrirEffectifMembreGDA() {
  if (typeof ouvrirEffectifPublicGDA === "function") {
    ouvrirEffectifPublicGDA();
    return;
  }
  afficherAccueilMenuGDA(
    "👥 Effectif GDA",
    "Le module Effectif GDA est momentanément indisponible."
  );
}

function ouvrirRapportMembreGDA() {
  if (typeof ouvrirRapportsPersonnelsGDA === "function") {
    ouvrirRapportsPersonnelsGDA();
    return;
  }
  afficherAccueilMenuGDA(
    "📝 Rapport GDA",
    "Le module Rapport GDA est momentanément indisponible."
  );
}

function ouvrirDemandeAbsenceGDA() {
  if (typeof ouvrirDemandesAbsenceGDA === "function") {
    ouvrirDemandesAbsenceGDA();
    return;
  }
  afficherAccueilMenuGDA("📅 Demande d’absence", "Le module est momentanément indisponible.");
}

function ouvrirMenuSpecialisationsGDA() {
  if (!utilisateurPossedeSpecialisationVisibleGDA()) return;
  menuOfficierOuvert = false;
  menuEspaceGdaOuvert = false;
  menuLiensUtilesOuvert = false;
  menuSpecialisationsOuvert = true;
  menuInstructeurOuvert = false;
  definirModuleGdaActif("");
  appliquerVisibiliteModulesGDA();
  const disponibles = [];
  if (utilisateurPossedeSpecialisationGDA("Instructeur")) {
    disponibles.push("Instructeur");
  }
  if (utilisateurPossedeSpecialisationGDA("Médecin")) {
    disponibles.push("Médecin");
  }
  afficherAccueilMenuGDA(
    "Spécialisations GDA",
    "Sélectionnez " + disponibles.join(" ou ") + " dans le menu de gauche."
  );
}

function fermerMenuSpecialisationsGDA() {
  menuSpecialisationsOuvert = false;
  menuInstructeurOuvert = false;
  appliquerVisibiliteModulesGDA();
  afficherAccueilMenuGDA(
    "Bienvenue dans l’interface GDA",
    "Sélectionnez un espace dans le menu de gauche."
  );
}

function ouvrirMenuLiensUtilesGDA() {
  menuOfficierOuvert = false;
  menuEspaceGdaOuvert = false;
  menuSpecialisationsOuvert = false;
  menuInstructeurOuvert = false;
  menuLiensUtilesOuvert = true;
  definirModuleGdaActif("");
  appliquerVisibiliteModulesGDA();
  afficherAccueilMenuGDA(
    "Liens utiles GDA",
    "Sélectionnez Règlement GDA, Guide GDA ou Cours martial dans le menu de gauche."
  );
}

function fermerMenuLiensUtilesGDA() {
  menuLiensUtilesOuvert = false;
  appliquerVisibiliteModulesGDA();
  afficherAccueilMenuGDA(
    "Bienvenue dans l’interface GDA",
    "Sélectionnez un espace dans le menu de gauche."
  );
}

function ouvrirReglementGDA() {
  ouvrirLienUtileGDA(
    "📜 Règlement GDA",
    REGLEMENT_GDA_URL,
    "Règlement GDA"
  );
}

function ouvrirGuideGDA() {
  const workspace = document.getElementById("workspace");
  if (!workspace) return;
  workspace.innerHTML = `
    <section id="welcomePanel">
      <h3>📘 Guide GDA</h3>
      <p>
        Le Guide GDA est disponible sur son site dédié.
      </p>
      <p>
        <a
          href="${echapperHTML(GUIDE_GDA_URL)}"
          target="_blank"
          rel="noopener noreferrer"
          class="bouton-lien-externe-gda"
        >Ouvrir le Guide GDA</a>
      </p>
    </section>
  `;
}

function ouvrirCoursMartialGDA() {
  ouvrirLienUtileGDA(
    "⚖️ Cours martial",
    COURS_MARTIAL_URL,
    "Cours martial"
  );
}

function ouvrirLienUtileGDA(titre, url, titreFenetre, rubrique) {
  if (!url) {
    afficherAccueilMenuGDA(
      titre,
      `Le lien ${titreFenetre} n’est pas encore configuré.`
    );
    return;
  }

  const workspace = document.getElementById("workspace");
  if (!workspace) return;
  workspace.innerHTML = `
    <section class="integration-specialisation">
      <header class="integration-specialisation-entete">
        <div>
          <span>${echapperHTML(rubrique || "Lien utile")}</span>
          <h3>${echapperHTML(titre)}</h3>
        </div>
      </header>
      <iframe
        class="integration-specialisation-frame"
        src="${echapperHTML(url)}"
        title="${echapperHTML(titreFenetre)}"
        loading="eager"
        referrerpolicy="strict-origin-when-cross-origin"
        allow="clipboard-write; fullscreen"
      ></iframe>
    </section>
  `;
}

function ouvrirEspaceInstructeurGDA() {
  if (!utilisateurPeutAccederEspaceInstructeurGDA()) return;
  menuInstructeurOuvert = true;
  definirModuleGdaActif("menu-instructeur");
  appliquerVisibiliteModulesGDA();
  afficherAccueilMenuGDA(
    "🎓 Espace Instructeur",
    "Sélectionnez Suivis de formation, Rapport Instructeur, Règlement instructeur ou Archives dans le menu de gauche."
  );
}

function fermerMenuInstructeurGDA() {
  menuInstructeurOuvert = false;
  definirModuleGdaActif("");
  appliquerVisibiliteModulesGDA();
  afficherAccueilMenuGDA(
    "Spécialisations GDA",
    "Sélectionnez Instructeur ou Médecin dans le menu de gauche."
  );
}

function ouvrirModuleInstructeurGDA(titre, message, cleModule) {
  if (!utilisateurPeutAccederEspaceInstructeurGDA()) return;
  definirModuleGdaActif(cleModule);
  afficherAccueilMenuGDA(titre, message);
}

function ouvrirSuivisFormationInstructeurGDA() {
  if (!utilisateurPeutConsulterSuivisFormationGDA()) return;
  if (typeof ouvrirSuivisFormationInstructeur === "function") {
    ouvrirSuivisFormationInstructeur();
    return;
  }
  ouvrirModuleInstructeurGDA(
    "📚 Suivis de formation",
    "Le suivi des formations Instructeur sera affiché dans cet espace.",
    "instructeur-suivis-formation"
  );
}

function ouvrirRapportInstructeurGDA() {
  if (!utilisateurPossedeSpecialisationGDA("Instructeur")) return;
  if (typeof ouvrirEspaceRapportsInstructeur === "function") {
    ouvrirEspaceRapportsInstructeur();
    return;
  }
  ouvrirModuleInstructeurGDA(
    "📝 Rapport Instructeur",
    "La rédaction et le suivi des rapports Instructeur seront disponibles dans cet espace.",
    "instructeur-rapport"
  );
}

function ouvrirReglementInstructeurGDA() {
  if (!utilisateurPossedeSpecialisationGDA("Instructeur")) return;
  definirModuleGdaActif("instructeur-reglement");
  ouvrirLienUtileGDA(
    "📜 Règlement instructeur",
    REGLEMENT_INSTRUCTEUR_URL,
    "Règlement instructeur",
    "Spécialisation Instructeur"
  );
}

function ouvrirArchivesInstructeurGDA() {
  if (!utilisateurPeutConsulterArchivesInstructeurGDA()) return;
  if (typeof ouvrirArchivesInstructeur === "function") {
    ouvrirArchivesInstructeur();
    return;
  }
  ouvrirModuleInstructeurGDA(
    "🗄️ Archives Instructeur",
    "Les anciens suivis et rapports Instructeur seront conservés dans cet espace.",
    "instructeur-archives"
  );
}

function ouvrirEspaceMedecinGDA() {
  if (!utilisateurPossedeSpecialisationGDA("Médecin")) return;
  const workspace = document.getElementById("workspace");
  if (!workspace) return;
  workspace.innerHTML = `
    <section class="integration-specialisation">
      <header class="integration-specialisation-entete">
        <div>
          <span>Spécialisation</span>
          <h3>⚕️ Médecin GDA</h3>
        </div>
      </header>
      <iframe
        id="medecinGdaFrame"
        class="integration-specialisation-frame"
        src="${MEDECIN_GDA_URL}"
        title="Bureau Médecin GDA"
        loading="eager"
        referrerpolicy="strict-origin-when-cross-origin"
        allow="clipboard-write; fullscreen"
        onload="transmettreIdentiteMedecinGDA(this)"
      ></iframe>
    </section>
  `;
}

function transmettreIdentiteMedecinGDA(frame) {
  if (!frame || !frame.contentWindow) return;
  frame.contentWindow.postMessage({
    type: "gda-session-medecin",
    identifiant: sessionStorage.getItem("identifiantUtilisateur") || "",
    grade: sessionStorage.getItem("gradeUtilisateur") || "",
    specialisation: sessionStorage.getItem("specialisationUtilisateur") || ""
  }, window.location.origin);
}

window.addEventListener("message", function(event) {
  if (event.origin !== window.location.origin || event.data?.type !== "gda-medecin-ready") return;
  const frame = document.getElementById("medecinGdaFrame");
  if (!frame || event.source !== frame.contentWindow) return;
  transmettreIdentiteMedecinGDA(frame);
});

function afficherAccueilMenuGDA(titre, message) {
  const workspace = document.getElementById("workspace");
  if (!workspace) return;
  workspace.innerHTML = `
    <section id="welcomePanel">
      <h3>${echapperHTML(titre)}</h3>
      <p>${echapperHTML(message)}</p>
    </section>
  `;
  if (typeof chargerPostItsInstructeurGDA === "function") {
    chargerPostItsInstructeurGDA();
  }
}

function afficherNotificationGDA(message, type) {
  if (!message) return;
  let zone = document.getElementById("notificationsGDA");
  if (!zone) {
    zone = document.createElement("div");
    zone.id = "notificationsGDA";
    zone.setAttribute("aria-live", "polite");
    document.body.appendChild(zone);
  }

  const notification = document.createElement("div");
  notification.className =
    "notification-gda notification-gda-" + (type || "info");
  notification.textContent = message;
  zone.appendChild(notification);

  requestAnimationFrame(function () {
    notification.classList.add("notification-gda-visible");
  });
  setTimeout(function () {
    notification.classList.remove("notification-gda-visible");
    setTimeout(function () {
      notification.remove();
    }, 220);
  }, 2800);
}

function initialiserNotificationsAbsenceGDA(blocUtilisateur) {
  const topbar = document.getElementById("topbar");
  if (!topbar || !blocUtilisateur) return;
  let bloc = document.getElementById("notificationsAbsenceCloche");
  if (!bloc) {
    bloc = document.createElement("div");
    bloc.id = "notificationsAbsenceCloche";
    bloc.innerHTML = `
      <button id="notificationsAbsenceBouton" type="button" aria-label="Voir mes notifications" aria-expanded="false"><span aria-hidden="true">🔔</span><strong id="notificationsAbsenceNombre" hidden>0</strong></button>
      <section id="notificationsAbsencePanneau" aria-label="Mes notifications" hidden></section>
    `;
    const presence = document.getElementById("presenceEnLigne");
    topbar.insertBefore(bloc, presence || blocUtilisateur);
    bloc.addEventListener("click", function (event) { event.stopPropagation(); });
    document.getElementById("notificationsAbsenceBouton").addEventListener("click", function (event) {
      event.stopPropagation();
      basculerNotificationsAbsenceGDA();
    });
    document.addEventListener("click", fermerNotificationsAbsenceGDA);
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") fermerNotificationsAbsenceGDA(); });
  }
  actualiserNotificationsAbsenceGDA(true);
  if (!minuteurNotificationsAbsence) {
    minuteurNotificationsAbsence = setInterval(function () { actualiserNotificationsAbsenceGDA(true); }, 30000);
  }
}

async function actualiserNotificationsAbsenceGDA(silencieux) {
  const identifiant = sessionStorage.getItem("identifiantUtilisateur") || "";
  if (!identifiant) return;
  try {
    const reponse = await fetch(API_URL + "?action=recupererNotifications" + (silencieux ? "&_=" + Date.now() : ""), { cache: "no-store" });
    const resultat = await reponse.json();
    if (!resultat.success) return;
    notificationsAbsenceGDA = Array.isArray(resultat.notifications) ? resultat.notifications : [];
    afficherNotificationsAbsenceGDA(Number(resultat.nonLues) || 0);
  } catch (erreur) {
    console.warn("Notifications indisponibles :", erreur);
  }
}

function afficherNotificationsAbsenceGDA(nonLues) {
  const nombre = document.getElementById("notificationsAbsenceNombre");
  const panneau = document.getElementById("notificationsAbsencePanneau");
  if (nombre) {
    nombre.textContent = String(nonLues);
    nombre.hidden = nonLues < 1;
  }
  if (!panneau) return;
  panneau.innerHTML = `
    <header><div><strong>Notifications</strong><span>${nonLues} non lue${nonLues > 1 ? "s" : ""}</span></div></header>
    <div class="notifications-absence-liste">
      ${notificationsAbsenceGDA.length ? notificationsAbsenceGDA.map(function (notification) {
        return `<article class="notification-absence-item ${notification.lue ? "lue" : "non-lue"}"><span aria-hidden="true">${notification.type === "refus" ? "✕" : "✓"}</span><div><strong>${echapperHTML(notification.titre)}</strong><p>${echapperHTML(notification.message)}</p><small>${echapperHTML(formaterDateHeureGDA(notification.date))}</small></div></article>`;
      }).join("") : '<p class="notifications-absence-vide">Vous n’avez aucune notification.</p>'}
    </div>
    ${notificationsAbsenceGDA.length ? '<footer><button id="notificationsToutLire" type="button">Tout marquer comme lu</button><button id="notificationsToutEffacer" type="button">Tout effacer</button></footer>' : ""}
  `;
  document.getElementById("notificationsToutLire")?.addEventListener("click", function () { actionNotificationsAbsenceGDA("marquerNotificationsLues"); });
  document.getElementById("notificationsToutEffacer")?.addEventListener("click", function () { actionNotificationsAbsenceGDA("effacerNotifications"); });
}

async function actionNotificationsAbsenceGDA(action) {
  try {
    const donnees = new URLSearchParams({ identifiant: sessionStorage.getItem("identifiantUtilisateur") || "" });
    const reponse = await fetch(API_URL + "?action=" + action, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: donnees.toString() });
    const resultat = await reponse.json();
    if (!resultat.success) throw new Error(resultat.message || "Action impossible.");
    notificationsAbsenceGDA = Array.isArray(resultat.notifications) ? resultat.notifications : [];
    afficherNotificationsAbsenceGDA(Number(resultat.nonLues) || 0);
  } catch (erreur) {
    afficherNotificationGDA(erreur.message, "erreur");
  }
}

function basculerNotificationsAbsenceGDA() {
  const bouton = document.getElementById("notificationsAbsenceBouton");
  const panneau = document.getElementById("notificationsAbsencePanneau");
  if (!bouton || !panneau) return;
  const ouvrir = panneau.hidden;
  panneau.hidden = !ouvrir;
  bouton.setAttribute("aria-expanded", String(ouvrir));
  if (ouvrir) {
    fermerPanneauPresenceEnLigne();
    actualiserNotificationsAbsenceGDA(true);
  }
}

function fermerNotificationsAbsenceGDA() {
  const bouton = document.getElementById("notificationsAbsenceBouton");
  const panneau = document.getElementById("notificationsAbsencePanneau");
  if (!bouton || !panneau) return;
  panneau.hidden = true;
  bouton.setAttribute("aria-expanded", "false");
}


function initialiserPresenceEnLigne(blocUtilisateur) {
  const topbar = document.getElementById("topbar");
  if (!topbar || !blocUtilisateur) return;

  let blocPresence =
    document.getElementById("presenceEnLigne");

  if (!blocPresence) {
    blocPresence = document.createElement("div");
    blocPresence.id = "presenceEnLigne";
    blocPresence.innerHTML = `
      <button
        id="presenceEnLigneBouton"
        type="button"
        aria-label="Voir les personnes connectées"
        aria-expanded="false"
      >
        <span class="presence-emoji" aria-hidden="true">👤</span>
        <strong id="presenceEnLigneNombre">1</strong>
      </button>

      <section
        id="presenceEnLignePanneau"
        aria-label="Personnes connectées"
        hidden
      ></section>
    `;

    topbar.insertBefore(blocPresence, blocUtilisateur);

    const bouton = document.getElementById(
      "presenceEnLigneBouton"
    );
    bouton.addEventListener("click", function (event) {
      event.stopPropagation();
      basculerPanneauPresenceEnLigne();
    });
    blocPresence.addEventListener("click", function (event) {
      event.stopPropagation();
    });
    document.addEventListener("click", fermerPanneauPresenceEnLigne);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        fermerPanneauPresenceEnLigne();
      }
    });
  }

  afficherPresenceEnLigne(1);
  actualiserPresenceEnLigne();

  if (!minuteurPresenceEnLigne) {
    minuteurPresenceEnLigne = setInterval(
      actualiserPresenceEnLigne,
      15000
    );
  }
}


async function actualiserPresenceEnLigne() {
  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";
  if (!identifiant) return;

  try {
    const url = API_URL +
      "?action=presenceEnLigne" +
      "&identifiant=" +
      encodeURIComponent(identifiant) +
      "&_=" + Date.now();
    const reponse = await fetch(url, {
      cache: "no-store"
    });
    const resultat = await reponse.json();

    if (!resultat.success) return;

    utilisateursEnLigne =
      Array.isArray(resultat.utilisateurs)
        ? resultat.utilisateurs
        : [];

    afficherPresenceEnLigne(
      Number(resultat.total) ||
      utilisateursEnLigne.length ||
      1
    );
  } catch (erreur) {
    console.warn(
      "Présence en ligne indisponible :",
      erreur
    );
  }
}


function afficherPresenceEnLigne(total) {
  const nombre = document.getElementById(
    "presenceEnLigneNombre"
  );
  const panneau = document.getElementById(
    "presenceEnLignePanneau"
  );
  const identifiant =
    sessionStorage.getItem(
      "identifiantUtilisateur"
    ) || "";
  const cleUtilisateur =
    normaliserPresenceEnLigne(identifiant);
  const autres = utilisateursEnLigne.filter(
    utilisateur =>
      normaliserPresenceEnLigne(utilisateur.nom) !==
      cleUtilisateur
  );

  if (nombre) {
    nombre.textContent = String(Math.max(1, total));
  }

  if (!panneau) return;

  panneau.innerHTML = `
    <header>
      <strong>Connectés</strong>
      <span>${Math.max(1, total)} en ligne</span>
    </header>

    <div class="presence-liste">
      ${autres.length
        ? autres.map(function (utilisateur) {
            return `
              <div class="presence-personne">
                <span aria-hidden="true">👤</span>
                <div>
                  <strong>${echapperHTML(utilisateur.nom)}</strong>
                  <small>${echapperHTML(
                    utilisateur.grade || "Grade non renseigné"
                  )}</small>
                </div>
              </div>
            `;
          }).join("")
        : `
          <p class="presence-seul">
            Vous êtes actuellement la seule personne connectée.
          </p>
        `}
    </div>
  `;
}


function basculerPanneauPresenceEnLigne() {
  const bouton = document.getElementById(
    "presenceEnLigneBouton"
  );
  const panneau = document.getElementById(
    "presenceEnLignePanneau"
  );
  if (!bouton || !panneau) return;

  const ouvrir = panneau.hidden;
  panneau.hidden = !ouvrir;
  bouton.setAttribute(
    "aria-expanded",
    String(ouvrir)
  );

  if (ouvrir) {
    fermerNotificationsAbsenceGDA();
    actualiserPresenceEnLigne();
  }
}


function fermerPanneauPresenceEnLigne() {
  const bouton = document.getElementById(
    "presenceEnLigneBouton"
  );
  const panneau = document.getElementById(
    "presenceEnLignePanneau"
  );
  if (!bouton || !panneau) return;

  panneau.hidden = true;
  bouton.setAttribute("aria-expanded", "false");
}


function normaliserPresenceEnLigne(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}


// Protège les textes affichés
function echapperHTML(texte) {
  return String(texte)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
