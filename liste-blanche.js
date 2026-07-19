const listeBlancheButton = document.getElementById("listeBlancheButton");
let listeBlanchePersonnes = [];
let listeBlanchePermissions = [];

if (listeBlancheButton) {
  listeBlancheButton.addEventListener("click", chargerListeBlancheGDA);
}

function utilisateurPeutGererListeBlancheGDA() {
  return sessionStorage.getItem("proprietaireUtilisateur") === "true" ||
    sessionStorage.getItem("coproprietaireUtilisateur") === "true";
}

async function requeteListeBlancheGDA(action, donnees) {
  const parametres = new URLSearchParams({
    action: action,
    identifiant: sessionStorage.getItem("identifiantUtilisateur") || ""
  });
  Object.entries(donnees || {}).forEach(function ([cle, valeur]) {
    parametres.set(cle, valeur == null ? "" : String(valeur));
  });
  const reponse = await fetch(API_URL + "?" + parametres.toString());
  const resultat = await reponse.json();
  if (!reponse.ok || !resultat.success) {
    throw new Error(resultat.message || "Impossible de contacter la liste blanche.");
  }
  return resultat;
}

async function chargerListeBlancheGDA() {
  if (!utilisateurPeutGererListeBlancheGDA()) return;
  definirModuleGdaActif("administration-liste-blanche");
  const workspace = document.getElementById("workspace");
  if (!workspace) return;
  workspace.innerHTML = '<section class="liste-blanche-module"><div class="liste-blanche-message">Chargement de la liste blanche…</div></section>';
  try {
    const resultat = await requeteListeBlancheGDA("recupererListeBlanche");
    listeBlanchePersonnes = Array.isArray(resultat.personnes) ? resultat.personnes : [];
    listeBlanchePermissions = Array.isArray(resultat.permissions) ? resultat.permissions : [];
    afficherListeBlancheGDA();
  } catch (erreur) {
    workspace.innerHTML = `<section class="liste-blanche-module"><div class="liste-blanche-message erreur">${echapperListeBlancheGDA(erreur.message)}</div></section>`;
  }
}

function afficherListeBlancheGDA() {
  const workspace = document.getElementById("workspace");
  if (!workspace || !moduleGdaEstActif("administration-liste-blanche")) return;
  workspace.innerHTML = `
    <section class="liste-blanche-module">
      <header class="liste-blanche-entete">
        <div>
          <span>Administration</span>
          <h3>🛡️ Liste blanche</h3>
          <p>Autorisez des personnes extérieures à se connecter avec leur compte Discord.</p>
        </div>
        <button id="listeBlancheActualiser" type="button">↻ Actualiser</button>
      </header>
      <form id="listeBlancheAjout" class="liste-blanche-ajout">
        <label><span>Identifiant *</span><input name="nouvelIdentifiant" maxlength="80" required autocomplete="off"></label>
        <label><span>Discord ID *</span><input name="discordId" inputmode="numeric" pattern="[0-9]{15,22}" required autocomplete="off"></label>
        <button type="submit">＋ Ajouter</button>
        <p class="liste-blanche-retour" aria-live="polite"></p>
      </form>
      <div class="liste-blanche-resume">${listeBlanchePersonnes.length} personne(s) extérieure(s) autorisée(s)</div>
      <div class="liste-blanche-liste">
        ${listeBlanchePersonnes.length
          ? listeBlanchePersonnes.map(creerCarteListeBlancheGDA).join("")
          : '<div class="liste-blanche-message">La liste blanche est vide.</div>'}
      </div>
    </section>
  `;
  document.getElementById("listeBlancheActualiser")?.addEventListener("click", chargerListeBlancheGDA);
  document.getElementById("listeBlancheAjout")?.addEventListener("submit", ajouterPersonneListeBlancheGDA);
  document.querySelectorAll("[data-liste-blanche-enregistrer]").forEach(function (bouton) {
    bouton.addEventListener("click", modifierPersonneListeBlancheGDA);
  });
  document.querySelectorAll("[data-liste-blanche-supprimer]").forEach(function (bouton) {
    bouton.addEventListener("click", supprimerPersonneListeBlancheGDA);
  });
  document.querySelectorAll("[data-role-staff-total]").forEach(function (caseStaff) {
    caseStaff.addEventListener("change", function () {
      appliquerEtatRoleStaffListeBlancheGDA(caseStaff.closest(".liste-blanche-carte"));
    });
    appliquerEtatRoleStaffListeBlancheGDA(caseStaff.closest(".liste-blanche-carte"));
  });
}

function creerCarteListeBlancheGDA(personne) {
  const permissions = Array.isArray(personne.permissions) ? personne.permissions : [];
  const cases = listeBlanchePermissions.map(function (permission) {
    const staff = permission.cle === "role_staff_total";
    return `
      <label class="liste-blanche-permission ${staff ? "role-staff" : ""}">
        <input type="checkbox" data-permission="${echapperListeBlancheGDA(permission.cle)}"
          ${staff ? "data-role-staff-total" : ""}
          ${permissions.includes(permission.cle) ? "checked" : ""}>
        <span>${echapperListeBlancheGDA(permission.libelle)}</span>
      </label>
    `;
  }).join("");
  return `
    <article class="liste-blanche-carte" data-liste-blanche-id="${echapperListeBlancheGDA(personne.id)}">
      <div class="liste-blanche-identite">
        <div><strong>${echapperListeBlancheGDA(personne.identifiant)}</strong><span>Compte extérieur</span></div>
        ${personne.roleStaff ? '<b class="liste-blanche-badge">Staff</b>' : ""}
      </div>
      <div class="liste-blanche-champs">
        <label><span>Identifiant</span><input data-liste-blanche-identifiant maxlength="80" value="${echapperListeBlancheGDA(personne.identifiant)}" required></label>
        <label><span>Discord ID</span><input data-liste-blanche-discord inputmode="numeric" value="${echapperListeBlancheGDA(personne.discordId)}" required></label>
      </div>
      <details>
        <summary>Gérer les permissions</summary>
        <div class="liste-blanche-permissions">${cases}</div>
      </details>
      <div class="liste-blanche-actions">
        <span class="liste-blanche-retour" aria-live="polite"></span>
        <button type="button" data-liste-blanche-enregistrer>Enregistrer</button>
        <button type="button" class="danger" data-liste-blanche-supprimer>Supprimer</button>
      </div>
    </article>
  `;
}

function appliquerEtatRoleStaffListeBlancheGDA(carte) {
  if (!carte) return;
  const staff = carte.querySelector("[data-role-staff-total]");
  carte.querySelectorAll("[data-permission]").forEach(function (casePermission) {
    if (casePermission === staff) return;
    casePermission.disabled = !!staff?.checked;
  });
}

async function ajouterPersonneListeBlancheGDA(evenement) {
  evenement.preventDefault();
  const formulaire = evenement.currentTarget;
  if (!formulaire.reportValidity()) return;
  const bouton = formulaire.querySelector("button[type=submit]");
  const retour = formulaire.querySelector(".liste-blanche-retour");
  bouton.disabled = true;
  try {
    const donnees = Object.fromEntries(new FormData(formulaire).entries());
    const resultat = await requeteListeBlancheGDA("ajouterListeBlanche", donnees);
    afficherNotificationGDA(resultat.message, "succes");
    await chargerListeBlancheGDA();
  } catch (erreur) {
    retour.textContent = erreur.message;
    retour.classList.add("erreur");
  } finally {
    bouton.disabled = false;
  }
}

async function modifierPersonneListeBlancheGDA(evenement) {
  const bouton = evenement.currentTarget;
  const carte = bouton.closest(".liste-blanche-carte");
  const retour = carte.querySelector(".liste-blanche-retour");
  const permissions = Array.from(carte.querySelectorAll("[data-permission]:checked"))
    .map(function (element) { return element.dataset.permission; });
  bouton.disabled = true;
  try {
    const resultat = await requeteListeBlancheGDA("modifierListeBlanche", {
      id: carte.dataset.listeBlancheId,
      nouvelIdentifiant: carte.querySelector("[data-liste-blanche-identifiant]").value,
      discordId: carte.querySelector("[data-liste-blanche-discord]").value,
      permissions: permissions.join(",")
    });
    afficherNotificationGDA(resultat.message, "succes");
    await chargerListeBlancheGDA();
  } catch (erreur) {
    retour.textContent = erreur.message;
    retour.classList.add("erreur");
  } finally {
    bouton.disabled = false;
  }
}

async function supprimerPersonneListeBlancheGDA(evenement) {
  const bouton = evenement.currentTarget;
  const carte = bouton.closest(".liste-blanche-carte");
  const nom = carte.querySelector("[data-liste-blanche-identifiant]").value;
  if (!window.confirm("Retirer " + nom + " de la liste blanche ? Son accès sera immédiatement révoqué.")) return;
  bouton.disabled = true;
  try {
    const resultat = await requeteListeBlancheGDA("supprimerListeBlanche", {
      id: carte.dataset.listeBlancheId
    });
    afficherNotificationGDA(resultat.message, "succes");
    await chargerListeBlancheGDA();
  } catch (erreur) {
    const retour = carte.querySelector(".liste-blanche-retour");
    retour.textContent = erreur.message;
    retour.classList.add("erreur");
    bouton.disabled = false;
  }
}

function echapperListeBlancheGDA(valeur) {
  return String(valeur == null ? "" : valeur)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

