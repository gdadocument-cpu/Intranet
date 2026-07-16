let effectifPublicMembres = [];
let effectifPublicProchaineActualisation = 0;
let effectifPublicMinuteur = null;
let effectifPublicActualisationEnCours = false;
let effectifPublicCharge = false;
let effectifPublicDernierResultat = null;

function ouvrirEffectifPublicGDA() {
  definirModuleGdaActif("effectif-public");
  const zone = document.getElementById("workspace");
  if (!zone) return;

  if (effectifPublicCharge && effectifPublicDernierResultat) {
    afficherEffectifPublicGDA(effectifPublicDernierResultat);
    chargerEffectifPublicGDA(false, true);
    return;
  }

  if (!document.getElementById("effectifPublicModule")) {
    zone.innerHTML = `
      <section id="effectifPublicModule" class="effectif-public-module">
        <div class="effectif-public-message">Chargement de l’effectif GDA…</div>
      </section>
    `;
  }
  chargerEffectifPublicGDA(false, false);
}

async function chargerEffectifPublicGDA(forcer, silencieux) {
  if (effectifPublicActualisationEnCours) return;
  effectifPublicActualisationEnCours = true;

  const module = document.getElementById("effectifPublicModule");
  if (!silencieux && forcer && module) {
    module.classList.add("effectif-public-chargement");
  }

  try {
    const action = forcer
      ? "actualiserEffectifPublic"
      : "recupererEffectifPublic";
    const reponse = await fetch(
      API_URL + "?action=" + encodeURIComponent(action) + (forcer ? "&_=" + Date.now() : ""),
      { cache: "no-store" }
    );
    const resultat = await reponse.json();

    if (!resultat.success) {
      throw new Error(
        resultat.message || "Impossible de récupérer l’effectif GDA."
      );
    }

    effectifPublicMembres = Array.isArray(resultat.membres)
      ? resultat.membres
      : [];
    effectifPublicProchaineActualisation = Number(
      resultat.prochaineActualisation || 0
    );
    effectifPublicCharge = true;
    effectifPublicDernierResultat = Object.assign({}, resultat, {
      membres: effectifPublicMembres
    });
    if (moduleGdaEstActif("effectif-public")) {
      afficherEffectifPublicGDA(effectifPublicDernierResultat);
    }

    if (forcer && moduleGdaEstActif("effectif-public")) {
      afficherNotificationGDA(
        "L’effectif public a été actualisé.",
        "succes"
      );
    }
  } catch (erreur) {
    console.error(erreur);
    const zone = document.getElementById("workspace");
    if (
      zone &&
      moduleGdaEstActif("effectif-public") &&
      !effectifPublicCharge
    ) {
      zone.innerHTML = `
        <section id="effectifPublicModule" class="effectif-public-module">
          <div class="effectif-public-message effectif-public-erreur">
            ${echapperHTML(erreur.message || "Effectif indisponible.")}
          </div>
        </section>
      `;
    } else if (moduleGdaEstActif("effectif-public") && forcer) {
      afficherNotificationGDA(
        erreur.message || "Actualisation impossible.",
        "erreur"
      );
    }
  } finally {
    effectifPublicActualisationEnCours = false;
    const moduleActuel = document.getElementById("effectifPublicModule");
    if (moduleActuel) {
      moduleActuel.classList.remove("effectif-public-chargement");
    }
  }
}

function afficherEffectifPublicGDA(resultat) {
  if (!moduleGdaEstActif("effectif-public")) return;
  const zone = document.getElementById("workspace");
  if (!zone) return;

  const derniereMiseAJour = Number(resultat.actualiseLe || 0);
  zone.innerHTML = `
    <section id="effectifPublicModule" class="effectif-public-module">
      <header class="effectif-public-entete">
        <div>
          <span class="effectif-public-sur-titre">Espace GDA</span>
          <h3>👥 Effectif</h3>
          <p>
            ${effectifPublicMembres.length} membre${effectifPublicMembres.length > 1 ? "s" : ""}
            · mise à jour quotidienne à 20 h 00
          </p>
        </div>

        <div class="effectif-public-actions">
          <div class="effectif-public-compteur" title="Prochaine mise à jour automatique">
            <span>Prochaine actualisation</span>
            <strong id="effectifPublicCompteARebours">--:--:--</strong>
            <small>
              Dernière : ${derniereMiseAJour
                ? echapperHTML(formaterDateEffectifPublic(derniereMiseAJour))
                : "non renseignée"}
            </small>
          </div>
          ${resultat.peutActualiser
            ? `
              <button
                id="effectifPublicForcer"
                class="effectif-public-forcer"
                type="button"
                title="Forcer la mise à jour maintenant"
              >↻ Actualiser</button>
            `
            : ""}
        </div>
      </header>

      <div class="effectif-public-legende">
        <span><i class="present"></i> Présent</span>
        <span><i class="absent"></i> Absent</span>
        <small>Cliquez sur une personne pour afficher ses informations.</small>
      </div>

      <div class="effectif-public-liste">
        ${effectifPublicMembres.length
          ? creerSectionsEffectifPublicGDA(effectifPublicMembres)
          : '<div class="effectif-public-message">Aucun membre enregistré.</div>'}
      </div>
    </section>
  `;

  document.querySelectorAll("[data-effectif-public-index]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      basculerFicheEffectifPublicGDA(Number(bouton.dataset.effectifPublicIndex));
    });
  });

  const boutonForcer = document.getElementById("effectifPublicForcer");
  if (boutonForcer) {
    boutonForcer.addEventListener("click", function () {
      boutonForcer.disabled = true;
      boutonForcer.textContent = "Actualisation…";
      chargerEffectifPublicGDA(true, false);
    });
  }

  demarrerCompteAReboursEffectifPublicGDA();
}

function creerSectionsEffectifPublicGDA(membres) {
  const categories = [
    {
      cle: "officiers-superieurs",
      titre: "Officiers supérieurs",
      icone: "🪐"
    },
    {
      cle: "officiers",
      titre: "Officiers",
      icone: "🎖️"
    },
    {
      cle: "sous-officiers",
      titre: "Sous-Officiers",
      icone: "⚔️"
    },
    {
      cle: "hommes-du-rang",
      titre: "Hommes du rang",
      icone: "🪖"
    }
  ];
  const membresIndexes = membres.map(function (membre, index) {
    return { membre: membre, index: index };
  });

  return categories.map(function (categorie) {
    const membresCategorie = membresIndexes.filter(function (entree) {
      return obtenirCategorieEffectifPublicGDA(entree.membre.grade) === categorie.cle;
    });
    const total = membresCategorie.length;

    return `
      <section class="effectif-public-section effectif-public-section-${categorie.cle}">
        <header class="effectif-public-banniere">
          <div>
            <span aria-hidden="true">${categorie.icone}</span>
            <strong>${categorie.titre}</strong>
          </div>
          <span class="effectif-public-total-categorie">
            ${total} membre${total > 1 ? "s" : ""}
          </span>
        </header>
        <div class="effectif-public-section-liste">
          ${total
            ? membresCategorie.map(function (entree) {
                return creerLigneEffectifPublicGDA(entree.membre, entree.index);
              }).join("")
            : '<p class="effectif-public-categorie-vide">Aucun membre dans cette catégorie.</p>'}
        </div>
      </section>
    `;
  }).join("");
}

function obtenirCategorieEffectifPublicGDA(grade) {
  if (typeof obtenirCategorieGrade === "function") {
    return obtenirCategorieGrade(grade);
  }

  const normalise = normaliserEffectifPublic(grade)
    .replace(/[^A-Z]/g, "");
  if (["LIEUTENANTCOLONEL", "COMMANDANT", "VICECOMMANDANT"].includes(normalise)) {
    return "officiers-superieurs";
  }
  if (["CAPITAINE", "LIEUTENANT", "SOUSLIEUTENANT", "ASPIRANT"].includes(normalise)) {
    return "officiers";
  }
  if (["MAJOR", "ADJUDANTCHEF", "ADJUDANT", "SERGENTCHEF", "SERGENT"].includes(normalise)) {
    return "sous-officiers";
  }
  return "hommes-du-rang";
}

function creerLigneEffectifPublicGDA(membre, index) {
  const present = normaliserEffectifPublic(membre.presence) !== "ABSENT";
  const icone = typeof obtenirIconeGradeEffectif === "function"
    ? obtenirIconeGradeEffectif(membre.grade)
    : "images/logo.png";

  return `
    <article class="effectif-public-personne">
      <button
        class="effectif-public-resume"
        type="button"
        data-effectif-public-index="${index}"
        aria-expanded="false"
      >
        <span class="effectif-public-identite">
          <strong>${echapperHTML(membre.nom || "Nom non renseigné")}</strong>
        </span>
        <span class="effectif-public-grade">
          <img src="${echapperHTML(icone)}" alt="" loading="lazy">
          ${echapperHTML(membre.grade || "Grade non renseigné")}
        </span>
        <span class="effectif-public-statut ${present ? "present" : "absent"}">
          <i></i>${present ? "Présent" : "Absent"}
        </span>
        <span class="effectif-public-chevron" aria-hidden="true">⌄</span>
      </button>
      <div class="effectif-public-details" id="effectifPublicDetails${index}" hidden>
        ${creerDetailsEffectifPublicGDA(membre)}
      </div>
    </article>
  `;
}

function creerDetailsEffectifPublicGDA(membre) {
  const medailles = Array.isArray(membre.medailles)
    ? membre.medailles.filter(Boolean)
    : String(membre.medailles || "")
        .split(/[;,\n]/)
        .map(function (valeur) { return valeur.trim(); })
        .filter(Boolean);

  return `
    <div class="effectif-public-detail-champ">
      <span>Steam ID</span>
      <strong>${echapperHTML(membre.steamId || "Non renseigné")}</strong>
    </div>
    <div class="effectif-public-detail-champ">
      <span>Discord ID</span>
      <strong>${echapperHTML(membre.discordId || "Non renseigné")}</strong>
    </div>
    <div class="effectif-public-detail-medailles">
      <span>Médailles</span>
      <div>
        ${medailles.length
          ? medailles.map(function (medaille) {
              return `<strong>${echapperHTML(medaille)}</strong>`;
            }).join("")
          : "<em>Aucune médaille</em>"}
      </div>
    </div>
  `;
}

function basculerFicheEffectifPublicGDA(index) {
  const bouton = document.querySelector(
    `[data-effectif-public-index="${index}"]`
  );
  const details = document.getElementById("effectifPublicDetails" + index);
  if (!bouton || !details) return;

  const ouvrir = details.hidden;
  document.querySelectorAll(".effectif-public-details").forEach(function (fiche) {
    fiche.hidden = true;
  });
  document.querySelectorAll("[data-effectif-public-index]").forEach(function (autre) {
    autre.setAttribute("aria-expanded", "false");
  });

  details.hidden = !ouvrir;
  bouton.setAttribute("aria-expanded", String(ouvrir));
}

function demarrerCompteAReboursEffectifPublicGDA() {
  if (effectifPublicMinuteur) clearInterval(effectifPublicMinuteur);

  const actualiser = function () {
    const affichage = document.getElementById("effectifPublicCompteARebours");
    if (!affichage) {
      clearInterval(effectifPublicMinuteur);
      effectifPublicMinuteur = null;
      return;
    }

    const reste = effectifPublicProchaineActualisation - Date.now();
    if (reste <= 0) {
      affichage.textContent = "Mise à jour…";
      if (!effectifPublicActualisationEnCours) {
        chargerEffectifPublicGDA(false, true);
      }
      return;
    }

    const secondes = Math.floor(reste / 1000);
    const heures = Math.floor(secondes / 3600);
    const minutes = Math.floor((secondes % 3600) / 60);
    const secondesRestantes = secondes % 60;
    affichage.textContent =
      String(heures).padStart(2, "0") + ":" +
      String(minutes).padStart(2, "0") + ":" +
      String(secondesRestantes).padStart(2, "0");
  };

  actualiser();
  effectifPublicMinuteur = setInterval(actualiser, 1000);
}

function formaterDateEffectifPublic(timestamp) {
  return formaterDateHeureGDA(timestamp, "Non renseignée");
}

function normaliserEffectifPublic(valeur) {
  return String(valeur || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

window.ouvrirEffectifPublicGDA = ouvrirEffectifPublicGDA;
