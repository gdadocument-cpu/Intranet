const logsButton = document.getElementById("logsButton");
const logsWorkspace = document.getElementById("workspace");
const LOGS_API_URL = API_URL;

let journalActionsGDA = [];
let journalActionsTotalGDA = 0;
let journalActionsChargeGDA = false;
let rechercheJournalActionsGDA = "";
let filtreJournalActionsGDA = "";
let journalActionsPeutSupprimerGDA = false;

if (logsButton) {
  logsButton.addEventListener("click", function () {
    if (
      !utilisateurAPermission("administration_staff") ||
      !utilisateurAPermission("administration_logs")
    ) return;
    definirModuleGdaActif("administration-logs");
    if (journalActionsChargeGDA) {
      afficherJournalActionsGDA();
      chargerJournalActionsGDA(false, true);
    } else {
      chargerJournalActionsGDA();
    }
  });
}

async function chargerJournalActionsGDA(forcer, silencieux) {
  if (
    !utilisateurAPermission("administration_staff") ||
    !utilisateurAPermission("administration_logs")
  ) return;

  if (forcer && typeof gdaForcerActualisation === "function") {
    gdaForcerActualisation("recupererJournalActions");
  }

  if (
    !silencieux &&
    (
      forcer ||
      !(typeof gdaReponseEnCache === "function" &&
        gdaReponseEnCache("recupererJournalActions"))
    )
  ) {
    logsWorkspace.innerHTML = `
      <section id="logsModule">
        <div class="logs-message">Chargement du journal d’actions...</div>
      </section>
    `;
  }

  try {
    const identifiant =
      sessionStorage.getItem("identifiantUtilisateur") || "";
    const reponse = await fetch(
      LOGS_API_URL +
      "?action=recupererJournalActions" +
      "&identifiant=" + encodeURIComponent(identifiant)
    );
    const resultat = await reponse.json();
    if (!reponse.ok || !resultat.success) {
      throw new Error(resultat.message || "Impossible de charger les logs.");
    }

    journalActionsGDA = Array.isArray(resultat.logs) ? resultat.logs : [];
    journalActionsTotalGDA = Number(resultat.total) || journalActionsGDA.length;
    journalActionsPeutSupprimerGDA = resultat.peutSupprimer === true;
    journalActionsChargeGDA = true;
    afficherJournalActionsGDA();
  } catch (erreur) {
    if (!moduleGdaEstActif("administration-logs")) return;
    logsWorkspace.innerHTML = `
      <section id="logsModule">
        <div class="logs-message logs-erreur">
          ${echapperHTMLLogsGDA(erreur.message)}
        </div>
      </section>
    `;
  }
}

function afficherJournalActionsGDA() {
  if (!moduleGdaEstActif("administration-logs")) return;
  if (
    !utilisateurAPermission("administration_staff") ||
    !utilisateurAPermission("administration_logs")
  ) return;

  const actions = Array.from(new Set(
    journalActionsGDA.map(function (log) {
      return String(log.action || "").trim();
    }).filter(Boolean)
  )).sort(function (a, b) {
    return a.localeCompare(b, "fr");
  });

  logsWorkspace.innerHTML = `
    <section id="logsModule">
      <header class="logs-entete">
        <div>
          <h3>📋 LOGS</h3>
          <p>Historique des actions importantes effectuées depuis le site.</p>
        </div>
        <div class="logs-actions-entete">
          <button id="logsActualiser" type="button">↻ Actualiser</button>
          ${journalActionsPeutSupprimerGDA && journalActionsTotalGDA
            ? '<button id="logsToutSupprimer" class="logs-danger" type="button">Supprimer tous les logs</button>'
            : ""}
        </div>
      </header>

      <div class="logs-resume">
        <div><strong>${journalActionsTotalGDA}</strong><span>actions enregistrées</span></div>
        <div><strong>${journalActionsGDA.length}</strong><span>actions chargées</span></div>
      </div>

      <div class="logs-filtres">
        <label class="logs-recherche">
          <span>⌕</span>
          <input
            id="logsRecherche"
            type="search"
            placeholder="Rechercher une personne, une action ou une cible..."
            value="${echapperHTMLLogsGDA(rechercheJournalActionsGDA)}"
          >
        </label>
        <label class="logs-type">
          <span>Type d’action</span>
          <select id="logsFiltreAction">
            <option value="">Toutes les actions</option>
            ${actions.map(function (action) {
              return `
                <option
                  value="${echapperHTMLLogsGDA(action)}"
                  ${action === filtreJournalActionsGDA ? "selected" : ""}
                >${echapperHTMLLogsGDA(action)}</option>
              `;
            }).join("")}
          </select>
        </label>
      </div>

      ${journalActionsTotalGDA > journalActionsGDA.length
        ? `<p class="logs-limite">Affichage des ${journalActionsGDA.length} actions les plus récentes sur ${journalActionsTotalGDA}.</p>`
        : ""}

      <div id="logsListe" class="logs-liste"></div>
    </section>
  `;

  document.getElementById("logsActualiser")
    .addEventListener("click", function () {
      chargerJournalActionsGDA(true);
    });
  document.getElementById("logsToutSupprimer")?.addEventListener("click", function () {
    viderJournalActionsGDA();
  });
  document.getElementById("logsRecherche")
    .addEventListener("input", function (evenement) {
      rechercheJournalActionsGDA = evenement.target.value || "";
      afficherListeJournalActionsGDA();
    });
  document.getElementById("logsFiltreAction")
    .addEventListener("change", function (evenement) {
      filtreJournalActionsGDA = evenement.target.value || "";
      afficherListeJournalActionsGDA();
    });

  afficherListeJournalActionsGDA();
}

function afficherListeJournalActionsGDA() {
  const conteneur = document.getElementById("logsListe");
  if (!conteneur) return;

  const recherche = normaliserLogsGDA(rechercheJournalActionsGDA);
  const filtres = journalActionsGDA.filter(function (log) {
    if (filtreJournalActionsGDA && log.action !== filtreJournalActionsGDA) {
      return false;
    }
    if (!recherche) return true;
    return normaliserLogsGDA([
      log.date,
      log.auteur,
      log.grade,
      log.action,
      log.cible,
      log.details
    ].join(" ")).includes(recherche);
  });

  if (!filtres.length) {
    conteneur.innerHTML = `
      <div class="logs-message">Aucune action ne correspond à la recherche.</div>
    `;
    return;
  }

  conteneur.innerHTML = filtres.map(function (log) {
    return `
      <article class="logs-carte">
        <div class="logs-date">${echapperHTMLLogsGDA(formaterDateHeureGDA(log.date, "Date inconnue"))}</div>
        <div class="logs-identite">
          <strong>${echapperHTMLLogsGDA(log.auteur || "Auteur inconnu")}</strong>
          <span>${echapperHTMLLogsGDA(log.grade || "Grade non renseigné")}</span>
        </div>
        <div class="logs-action">
          <strong>${echapperHTMLLogsGDA(log.action || "Action")}</strong>
          <span>Cible : ${echapperHTMLLogsGDA(log.cible || "—")}</span>
        </div>
        <div class="logs-details">${echapperHTMLLogsGDA(log.details || "—")}</div>
        ${journalActionsPeutSupprimerGDA
          ? `<button class="logs-supprimer-ligne" type="button" data-supprimer-log="${Number(log.ligne)}" aria-label="Supprimer cette ligne">✕</button>`
          : ""}
      </article>
    `;
  }).join("");

  conteneur.querySelectorAll("[data-supprimer-log]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      supprimerLigneJournalActionsGDA(Number(bouton.dataset.supprimerLog), bouton);
    });
  });
}

async function supprimerLigneJournalActionsGDA(ligne, bouton) {
  if (!journalActionsPeutSupprimerGDA || !Number.isInteger(ligne)) return;
  if (!confirm("Supprimer définitivement cette ligne des logs ?")) return;
  bouton.disabled = true;
  await executerSuppressionJournalActionsGDA("supprimerJournalAction", { ligne: String(ligne) });
}

async function viderJournalActionsGDA() {
  if (!journalActionsPeutSupprimerGDA || !journalActionsTotalGDA) return;
  if (!confirm("Supprimer définitivement tous les logs ? Cette action est irréversible.")) return;
  await executerSuppressionJournalActionsGDA("viderJournalActions", {});
}

async function executerSuppressionJournalActionsGDA(action, valeurs) {
  try {
    const donnees = new URLSearchParams(Object.assign({
      identifiant: sessionStorage.getItem("identifiantUtilisateur") || ""
    }, valeurs || {}));
    const reponse = await fetch(LOGS_API_URL + "?action=" + action, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: donnees.toString()
    });
    const resultat = await reponse.json();
    if (!reponse.ok || !resultat.success) {
      throw new Error(resultat.message || "Suppression impossible.");
    }
    journalActionsGDA = Array.isArray(resultat.logs) ? resultat.logs : [];
    journalActionsTotalGDA = Number(resultat.total) || 0;
    journalActionsPeutSupprimerGDA = resultat.peutSupprimer === true;
    afficherJournalActionsGDA();
    afficherNotificationGDA(resultat.message || "Logs supprimés.", "succes");
  } catch (erreur) {
    afficherNotificationGDA(erreur.message || "Suppression impossible.", "erreur");
    afficherListeJournalActionsGDA();
  }
}

function normaliserLogsGDA(valeur) {
  return String(valeur || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function echapperHTMLLogsGDA(valeur) {
  return String(valeur === null || valeur === undefined ? "" : valeur)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
