const permissionsButton =
  document.getElementById("permissionsButton");

const administrationWorkspace =
  document.getElementById("workspace");

const ADMINISTRATION_API_URL = API_URL;

let administrationUtilisateurs = [];
let administrationPermissions = [];
let rechercheAdministration = "";
let administrationPersonneOuverte = "";
let administrationAuteurProprietaire = false;
let administrationProprietaireNom = "Milo";
let administrationChargee = false;

function appliquerVisibiliteAdministration() {
  if (typeof appliquerVisibiliteModulesGDA === "function") {
    appliquerVisibiliteModulesGDA();
  }
}

if (permissionsButton) {
  permissionsButton.addEventListener(
    "click",
    function () {
      if (administrationChargee) {
        afficherAdministration();
      } else {
        chargerAdministration();
      }
    }
  );
}

async function chargerAdministration() {
  if (
    !utilisateurAPermission("administration_staff") ||
    !utilisateurAPermission("administration_permissions")
  ) {
    appliquerVisibiliteAdministration();
    return;
  }

  if (!(typeof gdaReponseEnCache === "function" && gdaReponseEnCache("recupererAdministration"))) {
    administrationWorkspace.innerHTML = `
      <section id="administrationModule">
        <div class="administration-message">
          Chargement des droits d’accès...
        </div>
      </section>
    `;
  }

  const identifiant =
    sessionStorage.getItem("identifiantUtilisateur") || "";

  try {
    const url =
      ADMINISTRATION_API_URL +
      "?action=recupererAdministration" +
      "&identifiant=" + encodeURIComponent(identifiant);
    const reponse = await fetch(url);
    const resultat = await reponse.json();

    if (!reponse.ok || !resultat.success) {
      throw new Error(
        resultat.message || "Impossible de charger les permissions."
      );
    }

    administrationUtilisateurs = (Array.isArray(resultat.utilisateurs)
      ? resultat.utilisateurs
      : []).sort(comparerGradesAdministration);
    administrationPermissions = Array.isArray(resultat.permissions)
      ? resultat.permissions
      : [];
    administrationAuteurProprietaire =
      resultat.auteurProprietaire === true;
    administrationProprietaireNom =
      resultat.proprietaireNom || "Milo";
    rechercheAdministration = "";
    administrationPersonneOuverte = "";
    administrationChargee = true;
    afficherAdministration();
  } catch (erreur) {
    administrationWorkspace.innerHTML = `
      <section id="administrationModule">
        <div class="administration-message administration-erreur">
          ${echapperHTMLAdministration(erreur.message)}
        </div>
      </section>
    `;
  }
}

function afficherAdministration() {
  const totalStaff = administrationUtilisateurs.filter(function (utilisateur) {
    return Array.isArray(utilisateur.permissions) &&
      utilisateur.permissions.includes("administration_staff");
  }).length;

  administrationWorkspace.innerHTML = `
    <section id="administrationModule">
      <header class="administration-header">
        <div>
          <h3>🔐 PERMISSIONS</h3>
          <p>Attribuez les rôles et droits d’accès de chaque membre.</p>
        </div>
        <button id="administrationActualiser" type="button">
          ↻ Actualiser
        </button>
      </header>

      <div class="administration-resume">
        <div><strong>${administrationUtilisateurs.length}</strong><span>personnes</span></div>
        <div><strong>${totalStaff}</strong><span>membres du staff</span></div>
        <div><strong>${echapperHTMLAdministration(administrationProprietaireNom)}</strong><span>propriétaire</span></div>
      </div>

      <label class="administration-recherche">
        <span>⌕</span>
        <input
          id="administrationRecherche"
          type="search"
          placeholder="Rechercher un nom ou un grade..."
          autocomplete="off"
          value="${echapperHTMLAdministration(rechercheAdministration)}"
        >
      </label>

      <div id="administrationListe" class="administration-liste"></div>
    </section>
  `;

  afficherListeAdministration();

  document.getElementById("administrationActualiser")
    .addEventListener("click", function() {
      if (typeof gdaForcerActualisation === "function") {
        gdaForcerActualisation("recupererAdministration");
      }
      chargerAdministration();
    });

  document.getElementById("administrationRecherche")
    .addEventListener("input", function (evenement) {
      rechercheAdministration = evenement.target.value || "";
      afficherListeAdministration();
    });
}

function afficherListeAdministration() {
  const liste = document.getElementById("administrationListe");
  if (!liste) return;

  const recherche = normaliserAdministration(rechercheAdministration);
  const utilisateurs = administrationUtilisateurs.filter(function (utilisateur) {
    return !recherche || normaliserAdministration(
      (utilisateur.nom || "") + " " + (utilisateur.grade || "")
    ).includes(recherche);
  });

  if (!utilisateurs.length) {
    liste.innerHTML = `
      <div class="administration-message">Aucune personne trouvée.</div>
    `;
    return;
  }

  liste.innerHTML = utilisateurs.map(creerCarteAdministration).join("");

  liste.querySelectorAll("[data-enregistrer-permissions]")
    .forEach(function (bouton) {
      bouton.addEventListener("click", enregistrerPermissionsAdministration);
    });

  liste.querySelectorAll("[data-ouvrir-permissions]")
    .forEach(function (bouton) {
      bouton.addEventListener("click", function () {
        const personne = bouton.dataset.ouvrirPermissions || "";
        administrationPersonneOuverte =
          administrationPersonneOuverte === personne ? "" : personne;
        afficherListeAdministration();
      });
    });

  liste.querySelectorAll("[data-coproprietaire]")
    .forEach(function (bouton) {
      bouton.addEventListener("click", changerCoproprietaireAdministration);
    });

  liste.querySelectorAll("[data-transferer-propriete]")
    .forEach(function (bouton) {
      bouton.addEventListener("click", transfererProprieteAdministration);
    });
}

function creerCarteAdministration(utilisateur) {
  const index = administrationUtilisateurs.indexOf(utilisateur);
  const permissions = Array.isArray(utilisateur.permissions)
    ? utilisateur.permissions
    : [];
  const clePersonne = normaliserAdministration(utilisateur.nom);
  const estOuverte = administrationPersonneOuverte === clePersonne;
  const iconeGrade = obtenirIconeGradeAdministration(utilisateur.grade);
  const accesPermanent = utilisateur.proprietaire || utilisateur.coproprietaire;

  const cases = administrationPermissions.map(function (permission) {
    const cochee = accesPermanent || permissions.includes(permission.cle);
    return `
      <label class="administration-permission">
        <input
          type="checkbox"
          data-permission="${echapperHTMLAdministration(permission.cle)}"
          ${cochee ? "checked" : ""}
          ${accesPermanent ? "disabled" : ""}
        >
        <span>${echapperHTMLAdministration(permission.libelle)}</span>
      </label>
    `;
  }).join("");

  return `
    <article class="administration-carte ${estOuverte ? "administration-carte-ouverte" : ""}" data-utilisateur-index="${index}">
      <button
        class="administration-identite"
        type="button"
        data-ouvrir-permissions="${echapperHTMLAdministration(clePersonne)}"
        aria-expanded="${estOuverte ? "true" : "false"}"
      >
        <span class="administration-avatar">
          <img
            src="${echapperHTMLAdministration(iconeGrade)}"
            alt="Insigne ${echapperHTMLAdministration(utilisateur.grade || "grade inconnu")}"
            loading="lazy"
          >
        </span>
        <div>
          <h4>${echapperHTMLAdministration(utilisateur.nom)}</h4>
          <p>${echapperHTMLAdministration(utilisateur.grade || "Grade non renseigné")}</p>
        </div>
        ${utilisateur.proprietaire
          ? '<span class="administration-badge-proprietaire">Propriétaire</span>'
          : utilisateur.coproprietaire
            ? '<span class="administration-badge-proprietaire administration-badge-coproprietaire">Co-propriétaire</span>'
          : ""}
        <span class="administration-chevron" aria-hidden="true">⌄</span>
      </button>

      <div class="administration-panneau" ${estOuverte ? "" : "hidden"}>
        <div class="administration-permissions">${cases}</div>

        <div class="administration-actions">
          <span class="administration-retour" aria-live="polite"></span>
          ${accesPermanent
            ? '<span class="administration-verrou">Tous les droits sont permanents</span>'
            : `<button type="button" data-enregistrer-permissions="${index}">Enregistrer</button>`}
        </div>

        ${administrationAuteurProprietaire && !utilisateur.proprietaire
          ? `
            <div class="administration-actions-propriete">
              <button
                type="button"
                class="administration-bouton-coproprietaire"
                data-coproprietaire="${index}"
                data-actif="${utilisateur.coproprietaire ? "false" : "true"}"
              >
                ${utilisateur.coproprietaire
                  ? "Retirer le statut de co-propriétaire"
                  : "Nommer co-propriétaire"}
              </button>
              <button
                type="button"
                class="administration-bouton-transfert"
                data-transferer-propriete="${index}"
              >
                Transférer la propriété
              </button>
            </div>
          `
          : ""}
      </div>
    </article>
  `;
}

function obtenirIconeGradeAdministration(grade) {
  if (typeof obtenirIconeGradeEffectif === "function") {
    return obtenirIconeGradeEffectif(grade);
  }
  return "images/logo.png";
}

function comparerGradesAdministration(a, b) {
  const rangA = obtenirRangGradeAdministration(a.grade);
  const rangB = obtenirRangGradeAdministration(b.grade);
  if (rangA !== rangB) return rangA - rangB;
  return normaliserAdministration(a.nom)
    .localeCompare(normaliserAdministration(b.nom), "fr");
}

function obtenirRangGradeAdministration(grade) {
  const ordre = [
    "LIEUTENANT-COLONEL",
    "COMMANDANT",
    "VICE-COMMANDANT",
    "CAPITAINE",
    "LIEUTENANT",
    "SOUS-LIEUTENANT",
    "ASPIRANT"
  ];
  const rang = ordre.indexOf(
    normaliserAdministration(grade)
      .replace(/_/g, "-")
      .replace(/\s+/g, "-")
  );
  return rang < 0 ? ordre.length : rang;
}

async function changerCoproprietaireAdministration(evenement) {
  const bouton = evenement.currentTarget;
  const index = Number(bouton.dataset.coproprietaire);
  const utilisateur = administrationUtilisateurs[index];
  const actif = bouton.dataset.actif === "true";
  const action = actif ? "nommer" : "retirer";

  if (!window.confirm(
    `Voulez-vous ${action} ${utilisateur.nom} ${actif ? "comme co-propriétaire" : "des co-propriétaires"} ?`
  )) return;

  const resultat = await executerActionProprieteAdministration(
    bouton,
    "definirCoproprietaire",
    utilisateur.nom,
    "&actif=" + encodeURIComponent(actif ? "true" : "false"),
    false
  );
  if (resultat) {
    utilisateur.coproprietaire = resultat.coproprietaire === true;
    utilisateur.permissions = Array.isArray(resultat.permissions)
      ? resultat.permissions
      : utilisateur.permissions;
    afficherListeAdministration();
    afficherNotificationGDA(resultat.message, "succes");
  }
}

async function transfererProprieteAdministration(evenement) {
  const bouton = evenement.currentTarget;
  const index = Number(bouton.dataset.transfererPropriete);
  const utilisateur = administrationUtilisateurs[index];

  if (!window.confirm(
    `Confirmer le transfert de la propriété à ${utilisateur.nom} ? Vous perdrez votre statut de propriétaire et vos droits permanents.`
  )) return;

  const resultat = await executerActionProprieteAdministration(
    bouton,
    "transfererPropriete",
    utilisateur.nom,
    "",
    false
  );
  if (resultat) {
    sessionStorage.setItem("proprietaireUtilisateur", "false");
    sessionStorage.setItem("coproprietaireUtilisateur", "false");
    sessionStorage.setItem(
      "permissionsUtilisateur",
      JSON.stringify(
        Array.isArray(resultat.permissionsAuteur)
          ? resultat.permissionsAuteur
          : []
      )
    );
    appliquerVisibiliteAdministration();
    if (
      utilisateurAPermission("administration_staff") &&
      utilisateurAPermission("administration_permissions")
    ) {
      const identifiant = sessionStorage.getItem("identifiantUtilisateur") || "";
      const ancienProprietaire = administrationUtilisateurs.find(function (personne) {
        return normaliserAdministration(personne.nom) ===
          normaliserAdministration(identifiant);
      });
      if (ancienProprietaire) {
        ancienProprietaire.proprietaire = false;
        ancienProprietaire.coproprietaire = false;
        ancienProprietaire.permissions = Array.isArray(resultat.permissionsAuteur)
          ? resultat.permissionsAuteur
          : [];
      }
      utilisateur.proprietaire = true;
      utilisateur.coproprietaire = false;
      utilisateur.permissions = administrationPermissions.map(function (permission) {
        return permission.cle;
      });
      administrationAuteurProprietaire = false;
      administrationProprietaireNom = utilisateur.nom;
      administrationUtilisateurs.sort(comparerGradesAdministration);
      afficherAdministration();
      afficherNotificationGDA(resultat.message, "succes");
    } else {
      administrationWorkspace.innerHTML = `
        <section id="administrationModule">
          <div class="administration-message">
            La propriété a été transférée à ${echapperHTMLAdministration(utilisateur.nom)}.
          </div>
        </section>
      `;
    }
  }
}

async function executerActionProprieteAdministration(
  bouton,
  action,
  personne,
  supplement,
  actualiser = true
) {
  const texteInitial = bouton.textContent;
  const identifiant =
    sessionStorage.getItem("identifiantUtilisateur") || "";
  bouton.disabled = true;
  bouton.textContent = "Traitement...";

  try {
    const url =
      ADMINISTRATION_API_URL +
      "?action=" + encodeURIComponent(action) +
      "&identifiant=" + encodeURIComponent(identifiant) +
      "&personne=" + encodeURIComponent(personne) +
      (supplement || "");
    const reponse = await fetch(url);
    const resultat = await reponse.json();
    if (!reponse.ok || !resultat.success) {
      throw new Error(resultat.message || "L’action a échoué.");
    }
    if (actualiser) await chargerAdministration();
    return resultat;
  } catch (erreur) {
    window.alert(erreur.message);
    return false;
  } finally {
    bouton.disabled = false;
    bouton.textContent = texteInitial;
  }
}

async function enregistrerPermissionsAdministration(evenement) {
  const bouton = evenement.currentTarget;
  const index = Number(bouton.dataset.enregistrerPermissions);
  const utilisateur = administrationUtilisateurs[index];
  const carte = bouton.closest(".administration-carte");
  const retour = carte.querySelector(".administration-retour");
  const permissions = Array.from(
    carte.querySelectorAll("[data-permission]:checked")
  ).map(function (casePermission) {
    return casePermission.dataset.permission;
  });
  const identifiant =
    sessionStorage.getItem("identifiantUtilisateur") || "";

  bouton.disabled = true;
  bouton.textContent = "Enregistrement...";
  retour.textContent = "";

  try {
    const url =
      ADMINISTRATION_API_URL +
      "?action=enregistrerPermissions" +
      "&identifiant=" + encodeURIComponent(identifiant) +
      "&personne=" + encodeURIComponent(utilisateur.nom) +
      "&permissions=" + encodeURIComponent(permissions.join(","));
    const reponse = await fetch(url);
    const resultat = await reponse.json();

    if (!reponse.ok || !resultat.success) {
      throw new Error(resultat.message || "La modification a échoué.");
    }

    utilisateur.permissions = Array.isArray(resultat.permissions)
      ? resultat.permissions
      : permissions;
    retour.textContent = "✓ Permissions enregistrées";
    retour.classList.remove("administration-retour-erreur");

    if (normaliserAdministration(utilisateur.nom) === normaliserAdministration(identifiant)) {
      sessionStorage.setItem(
        "permissionsUtilisateur",
        JSON.stringify(utilisateur.permissions)
      );
      appliquerVisibiliteAdministration();
      if (
        !utilisateur.permissions.includes("administration_staff") ||
        !utilisateur.permissions.includes("administration_permissions")
      ) {
        administrationWorkspace.innerHTML = `
          <section id="administrationModule">
            <div class="administration-message">
              Votre accès à la gestion des permissions a été retiré.
            </div>
          </section>
        `;
        return;
      }
    }
  } catch (erreur) {
    retour.textContent = erreur.message;
    retour.classList.add("administration-retour-erreur");
  } finally {
    bouton.disabled = false;
    bouton.textContent = "Enregistrer";
  }
}

function normaliserAdministration(valeur) {
  return String(valeur || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function echapperHTMLAdministration(valeur) {
  return String(valeur == null ? "" : valeur)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
