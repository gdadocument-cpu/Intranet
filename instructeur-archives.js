const INSTRUCTEUR_ARCHIVES_API_URL = API_URL;

let archivesInstructeur = [];
let archivesInstructeurChargees = false;
let categorieArchivesInstructeur = "ACCEPTE";
let rechercheArchivesInstructeur = "";
let archiveInstructeurOuverte = "";
let archivesInstructeurPeutSupprimer = false;
const CACHE_ARCHIVES_INSTRUCTEUR = "gdaArchivesInstructeur:";
const DUREE_CACHE_ARCHIVES_INSTRUCTEUR = 5 * 60 * 1000;
let archivesInstructeurChargeesLe = 0;

window.invaliderCacheArchivesInstructeurGDA = function() {
  try { localStorage.removeItem(cleCacheArchivesInstructeur()); } catch (erreur) { /* Facultatif. */ }
  archivesInstructeurChargeesLe = 0;
};

function sessionPeutSupprimerArchivesInstructeur() {
  return sessionStorage.getItem("proprietaireUtilisateur") === "true" ||
    sessionStorage.getItem("coproprietaireUtilisateur") === "true";
}

function cleCacheArchivesInstructeur() {
  return CACHE_ARCHIVES_INSTRUCTEUR + normaliserRechercheArchiveInstructeur(
    sessionStorage.getItem("identifiantUtilisateur") || ""
  );
}

function lireCacheArchivesInstructeur() {
  try {
    const cache = JSON.parse(localStorage.getItem(cleCacheArchivesInstructeur()) || "null");
    if (!cache || !Array.isArray(cache.archives) || Date.now() - Number(cache.date || 0) > DUREE_CACHE_ARCHIVES_INSTRUCTEUR) return null;
    return cache;
  } catch (erreur) {
    return null;
  }
}

function enregistrerCacheArchivesInstructeur() {
  try {
    localStorage.setItem(cleCacheArchivesInstructeur(), JSON.stringify({
      date: Date.now(),
      archives: archivesInstructeur,
      peutSupprimer: archivesInstructeurPeutSupprimer
    }));
  } catch (erreur) {
    /* Le cache local reste facultatif. */
  }
}

async function ouvrirArchivesInstructeur(forcer) {
  if (
    typeof utilisateurPeutConsulterArchivesInstructeurGDA === "function" &&
    !utilisateurPeutConsulterArchivesInstructeurGDA()
  ) return;
  definirModuleGdaActif("instructeur-archives");
  if (!archivesInstructeurChargees && !forcer) {
    const cache = lireCacheArchivesInstructeur();
    if (cache) {
      archivesInstructeur = cache.archives.slice().sort(comparerArchivesInstructeur);
      archivesInstructeurPeutSupprimer =
        cache.peutSupprimer === true || sessionPeutSupprimerArchivesInstructeur();
      archivesInstructeurChargees = true;
      archivesInstructeurChargeesLe = Date.now();
    }
  }
  const donneesAffichees = archivesInstructeurChargees;
  if (donneesAffichees) {
    afficherArchivesInstructeur();
    if (!forcer && Date.now() - archivesInstructeurChargeesLe < DUREE_CACHE_ARCHIVES_INSTRUCTEUR) {
      return;
    }
  }
  const workspace = document.getElementById("workspace");
  if (!workspace) return;
  if (!donneesAffichees && !(typeof gdaReponseEnCache === "function" &&
        gdaReponseEnCache("recupererArchivesInstructeur"))) {
    workspace.innerHTML = `
      <section class="archives-instructeur-module">
        <div class="archives-instructeur-message">
          <span class="archives-instructeur-chargeur" aria-hidden="true"></span>
          Chargement des archives Instructeur…
        </div>
      </section>
    `;
  }
  try {
    if (forcer && typeof gdaForcerActualisation === "function") {
      gdaForcerActualisation("recupererArchivesInstructeur");
    }
    const identifiant = sessionStorage.getItem("identifiantUtilisateur") || "";
    const reponse = await fetch(
      INSTRUCTEUR_ARCHIVES_API_URL +
      "?action=recupererArchivesInstructeur&identifiant=" +
      encodeURIComponent(identifiant)
    );
    const resultat = await reponse.json();
    if (!reponse.ok || !resultat.success) {
      throw new Error(resultat.message || "Impossible de charger les archives.");
    }
    archivesInstructeur = Array.isArray(resultat.archives)
      ? resultat.archives.slice().sort(comparerArchivesInstructeur)
      : [];
    archivesInstructeurPeutSupprimer =
      resultat.peutSupprimer === true || sessionPeutSupprimerArchivesInstructeur();
    archivesInstructeurChargees = true;
    archivesInstructeurChargeesLe = Date.now();
    enregistrerCacheArchivesInstructeur();
    afficherArchivesInstructeur();
  } catch (erreur) {
    if (donneesAffichees) {
      if (typeof afficherNotificationGDA === "function") {
        afficherNotificationGDA("Actualisation des archives indisponible.", "erreur");
      }
      return;
    }
    workspace.innerHTML = `
      <section class="archives-instructeur-module">
        <div class="archives-instructeur-message archives-instructeur-erreur">
          <strong>Archives indisponibles</strong>
          <span>${echapperArchiveInstructeur(erreur.message || "Erreur serveur.")}</span>
          <button id="archivesInstructeurReessayer" type="button">Réessayer</button>
        </div>
      </section>
    `;
    const bouton = document.getElementById("archivesInstructeurReessayer");
    if (bouton) bouton.addEventListener("click", function () {
      ouvrirArchivesInstructeur(true);
    });
  }
}

function afficherArchivesInstructeur() {
  const workspace = document.getElementById("workspace");
  if (!workspace || !moduleGdaEstActif("instructeur-archives")) return;
  archivesInstructeurPeutSupprimer =
    archivesInstructeurPeutSupprimer || sessionPeutSupprimerArchivesInstructeur();
  const acceptes = archivesInstructeur.filter(function (archive) {
    return archive.resultat === "ACCEPTE";
  });
  const refuses = archivesInstructeur.filter(function (archive) {
    return archive.resultat === "REFUSE";
  });
  const selection = (categorieArchivesInstructeur === "REFUSE" ? refuses : acceptes)
    .filter(archiveCorrespondRechercheInstructeur);

  workspace.innerHTML = `
    <section class="archives-instructeur-module">
      <header class="archives-instructeur-entete">
        <div>
          <span>Spécialisation Instructeur</span>
          <h3>🗄️ Archives des périodes probatoires</h3>
          <p>${archivesInstructeur.length} archive${archivesInstructeur.length > 1 ? "s" : ""} conservée${archivesInstructeur.length > 1 ? "s" : ""}</p>
        </div>
        <button id="archivesInstructeurActualiser" type="button">↻ Actualiser</button>
      </header>

      <label class="archives-instructeur-recherche">
        <span>🔎</span>
        <input
          id="archivesInstructeurRecherche"
          type="search"
          placeholder="Rechercher par matricule, Steam ID ou Discord ID…"
          value="${echapperArchiveInstructeur(rechercheArchivesInstructeur)}"
          autocomplete="off"
        >
      </label>

      <div class="archives-instructeur-categories" role="tablist" aria-label="Résultat des périodes probatoires">
        ${creerCategorieArchiveInstructeur("ACCEPTE", "✓", "Acceptés", acceptes.length)}
        ${creerCategorieArchiveInstructeur("REFUSE", "✕", "Refusés", refuses.length)}
      </div>

      <div class="archives-instructeur-liste">
        ${selection.length
          ? selection.map(creerCarteArchiveInstructeur).join("")
          : `<div class="archives-instructeur-vide">
              Aucune archive ${categorieArchivesInstructeur === "REFUSE" ? "refusée" : "acceptée"}${rechercheArchivesInstructeur.trim() ? " pour cette recherche" : ""}.
            </div>`}
      </div>
    </section>
  `;
  installerEvenementsArchivesInstructeur();
}

function creerCategorieArchiveInstructeur(cle, icone, libelle, total) {
  const active = categorieArchivesInstructeur === cle;
  return `
    <button
      class="archives-instructeur-categorie ${active ? "active" : ""} ${cle === "REFUSE" ? "refuse" : "accepte"}"
      type="button"
      role="tab"
      aria-selected="${active}"
      data-archive-categorie="${cle}"
    >
      <span>${icone}</span>
      <strong>${libelle}</strong>
      <b>${total}</b>
    </button>
  `;
}

function creerCarteArchiveInstructeur(archive) {
  const ouverte = archiveInstructeurOuverte === archive.id;
  const classeResultat = archive.resultat === "REFUSE" ? "refuse" : "accepte";
  return `
    <article class="archive-instructeur-carte ${ouverte ? "ouverte" : ""} ${classeResultat}">
      <button
        class="archive-instructeur-resume"
        type="button"
        data-archive-id="${echapperArchiveInstructeur(archive.id)}"
        aria-expanded="${ouverte}"
      >
        <span class="archive-instructeur-statut">${archive.resultat === "REFUSE" ? "✕" : "✓"}</span>
        <span class="archive-instructeur-identite">
          <strong>${echapperArchiveInstructeur(archive.matricule)}</strong>
          <small>Fin de période : ${valeurArchiveInstructeur(archive.dateFin)}</small>
        </span>
        <span class="archive-instructeur-compact">
          <b>${Number(archive.nombreRapports || 0)}</b> rapports
        </span>
        <span class="archive-instructeur-chevron">⌄</span>
      </button>
      ${ouverte ? creerDetailsArchiveInstructeur(archive) : ""}
    </article>
  `;
}

function creerDetailsArchiveInstructeur(archive) {
  return `
    <div class="archive-instructeur-details">
      <div class="archive-instructeur-grille">
        ${champArchiveInstructeur("Steam ID", archive.steamId)}
        ${champArchiveInstructeur("Discord ID", archive.discordId)}
        ${champArchiveInstructeur("Rapports effectués", archive.nombreRapports)}
        ${champArchiveInstructeur("Prises de service", archive.prisesService)}
        ${champArchiveInstructeur("Date de fin", archive.dateFin)}
        ${champArchiveInstructeur("Instructeur chargé du suivi", archive.instructeur)}
        ${champArchiveInstructeur("Gérant ayant validé", archive.gerant)}
        ${champArchiveInstructeur("Sanction", archive.sanction)}
      </div>
      <div class="archive-instructeur-textes">
        ${champTexteArchiveInstructeur("Commentaire", archive.commentaire)}
        ${champTexteArchiveInstructeur("Raison", archive.raison)}
      </div>
      ${archivesInstructeurPeutSupprimer && ["ACCEPTE", "REFUSE"].includes(archive.resultat) ? `
        <div class="archive-instructeur-actions">
          <button type="button" data-supprimer-archive-instructeur="${echapperArchiveInstructeur(archive.id)}">
            🗑 Supprimer cette archive
          </button>
        </div>` : ""}
    </div>
  `;
}

function champArchiveInstructeur(libelle, valeur) {
  return `<div><span>${libelle}</span><strong>${valeurArchiveInstructeur(valeur)}</strong></div>`;
}

function champTexteArchiveInstructeur(libelle, valeur) {
  return `<section><span>${libelle}</span><p>${valeurArchiveInstructeur(valeur)}</p></section>`;
}

function valeurArchiveInstructeur(valeur) {
  if (valeur === null || valeur === undefined || String(valeur).trim() === "") {
    return "Non renseigné";
  }
  return echapperArchiveInstructeur(String(valeur));
}

function installerEvenementsArchivesInstructeur() {
  const actualiser = document.getElementById("archivesInstructeurActualiser");
  if (actualiser) actualiser.addEventListener("click", function () {
    ouvrirArchivesInstructeur(true);
  });
  const recherche = document.getElementById("archivesInstructeurRecherche");
  if (recherche) recherche.addEventListener("input", function (evenement) {
    rechercheArchivesInstructeur = evenement.target.value || "";
    archiveInstructeurOuverte = "";
    afficherArchivesInstructeur();
    const nouveauChamp = document.getElementById("archivesInstructeurRecherche");
    if (nouveauChamp) {
      nouveauChamp.focus();
      nouveauChamp.setSelectionRange(
        rechercheArchivesInstructeur.length,
        rechercheArchivesInstructeur.length
      );
    }
  });
  document.querySelectorAll("[data-archive-categorie]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      categorieArchivesInstructeur = bouton.dataset.archiveCategorie;
      archiveInstructeurOuverte = "";
      afficherArchivesInstructeur();
    });
  });
  document.querySelectorAll("[data-archive-id]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      archiveInstructeurOuverte =
        archiveInstructeurOuverte === bouton.dataset.archiveId
          ? ""
          : bouton.dataset.archiveId;
      afficherArchivesInstructeur();
    });
  });
  document.querySelectorAll("[data-supprimer-archive-instructeur]").forEach(function (bouton) {
    bouton.addEventListener("click", supprimerArchiveInstructeurDepuisHTML);
  });
}

async function supprimerArchiveInstructeurDepuisHTML(evenement) {
  const bouton = evenement.currentTarget;
  const archiveId = bouton.dataset.supprimerArchiveInstructeur;
  const archive = archivesInstructeur.find(function (element) {
    return element.id === archiveId;
  });
  const categorie = archive && archive.resultat === "REFUSE"
    ? "archives refusées"
    : "archives acceptées";
  if (!archive || !window.confirm(
    "Supprimer définitivement " + archive.matricule + " de la liste des " + categorie + " ?"
  )) return;
  bouton.disabled = true;
  bouton.textContent = "Suppression…";
  try {
    const resultat = await requeteRapportInstructeur(
      "supprimerArchiveInstructeur",
      { archiveId: archiveId },
      "POST"
    );
    archivesInstructeur = archivesInstructeur.filter(function (element) {
      return element.id !== archiveId;
    });
    archiveInstructeurOuverte = "";
    enregistrerCacheArchivesInstructeur();
    afficherArchivesInstructeur();
    if (typeof afficherNotificationGDA === "function") {
      afficherNotificationGDA(resultat.message || "Archive supprimée.", "succes");
    }
  } catch (erreur) {
    bouton.disabled = false;
    bouton.textContent = "🗑 Supprimer cette archive";
    if (typeof afficherNotificationGDA === "function") {
      afficherNotificationGDA(erreur.message || "Suppression impossible.", "erreur");
    }
  }
}

function archiveCorrespondRechercheInstructeur(archive) {
  const recherche = normaliserRechercheArchiveInstructeur(rechercheArchivesInstructeur);
  if (!recherche) return true;
  return [archive.matricule, archive.steamId, archive.discordId]
    .some(function (valeur) {
      return normaliserRechercheArchiveInstructeur(valeur).includes(recherche);
    });
}

function comparerArchivesInstructeur(a, b) {
  return dateArchiveInstructeur(b.dateFin) - dateArchiveInstructeur(a.dateFin);
}

function dateArchiveInstructeur(valeur) {
  const morceaux = String(valeur || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return morceaux
    ? new Date(Number(morceaux[3]), Number(morceaux[2]) - 1, Number(morceaux[1])).getTime()
    : 0;
}

function normaliserRechercheArchiveInstructeur(valeur) {
  return String(valeur || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function echapperArchiveInstructeur(valeur) {
  return String(valeur === null || valeur === undefined ? "" : valeur)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
