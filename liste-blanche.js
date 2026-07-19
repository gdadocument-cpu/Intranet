const listeBlancheButton = document.getElementById("listeBlancheButton");
let listeBlanchePersonnes = [];
let listeBlanchePermissions = [];
let listeBlancheSelectionId = "";
let listeBlancheModeEdition = false;

listeBlancheButton?.addEventListener("click", chargerListeBlancheGDA);

function utilisateurPeutGererListeBlancheGDA() {
  return sessionStorage.getItem("proprietaireUtilisateur") === "true" ||
    sessionStorage.getItem("coproprietaireUtilisateur") === "true";
}

async function requeteListeBlancheGDA(action, donnees) {
  const parametres = new URLSearchParams({
    action,
    identifiant: sessionStorage.getItem("identifiantUtilisateur") || ""
  });
  Object.entries(donnees || {}).forEach(([cle, valeur]) => {
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
    if (!listeBlanchePersonnes.some(p => p.id === listeBlancheSelectionId)) {
      listeBlancheSelectionId = listeBlanchePersonnes[0]?.id || "";
      listeBlancheModeEdition = false;
    }
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
        <div><span>Administration</span><h3>🛡️ Liste blanche</h3>
          <p>Autorisez des personnes extérieures à se connecter avec leur compte Discord.</p></div>
        <button id="listeBlancheActualiser" type="button">↻ Actualiser</button>
      </header>
      <form id="listeBlancheAjout" class="liste-blanche-ajout">
        <label><span>Identifiant *</span><input name="nouvelIdentifiant" maxlength="80" required autocomplete="off"></label>
        <label><span>Discord ID *</span><input name="discordId" inputmode="numeric" pattern="[0-9]{15,22}" required autocomplete="off"></label>
        <button type="submit">＋ Ajouter</button>
        <p class="liste-blanche-retour" aria-live="polite"></p>
      </form>
      <div class="liste-blanche-colonnes">
        <section class="liste-blanche-membres">
          <div class="liste-blanche-titre"><h4>Membres autorisés</h4><span>${listeBlanchePersonnes.length}</span></div>
          <div class="liste-blanche-liste">
            ${listeBlanchePersonnes.length ? listeBlanchePersonnes.map(creerLigneListeBlancheGDA).join("") :
              '<div class="liste-blanche-message">La liste blanche est vide.</div>'}
          </div>
        </section>
        <section class="liste-blanche-droite">${creerPanneauListeBlancheGDA()}</section>
      </div>
    </section>`;
  brancherListeBlancheGDA();
}

function creerLigneListeBlancheGDA(personne) {
  return `<div class="liste-blanche-ligne ${personne.id === listeBlancheSelectionId ? "active" : ""}">
    <button type="button" class="liste-blanche-selection" data-liste-blanche-selection="${echapperListeBlancheGDA(personne.id)}">
      <span><strong>${echapperListeBlancheGDA(personne.identifiant)}</strong><small>${echapperListeBlancheGDA(personne.discordId)}</small></span>
      ${personne.roleStaff ? '<b class="liste-blanche-badge">Staff</b>' : ""}
    </button>
    <button type="button" class="liste-blanche-crayon" data-liste-blanche-editer="${echapperListeBlancheGDA(personne.id)}"
      title="Modifier cette personne" aria-label="Modifier ${echapperListeBlancheGDA(personne.identifiant)}">✎</button>
  </div>`;
}

function creerPanneauListeBlancheGDA() {
  const personne = listeBlanchePersonnes.find(p => p.id === listeBlancheSelectionId);
  if (!personne) return '<div class="liste-blanche-message">Sélectionnez une personne pour gérer ses permissions.</div>';
  const accordees = Array.isArray(personne.permissions) ? personne.permissions : [];
  const cases = listeBlanchePermissions.map(permission => {
    const staff = permission.cle === "role_staff_total";
    return `<label class="liste-blanche-permission ${staff ? "role-staff" : ""}">
      <input type="checkbox" data-permission="${echapperListeBlancheGDA(permission.cle)}"
        ${staff ? "data-role-staff-total" : ""} ${accordees.includes(permission.cle) ? "checked" : ""}>
      <span>${echapperListeBlancheGDA(permission.libelle)}</span>
    </label>`;
  }).join("");
  return `<article class="liste-blanche-panneau" data-liste-blanche-id="${echapperListeBlancheGDA(personne.id)}">
    <div class="liste-blanche-identite">
      <div><strong>${echapperListeBlancheGDA(personne.identifiant)}</strong><span>Compte extérieur</span></div>
      ${personne.roleStaff ? '<b class="liste-blanche-badge">Staff</b>' : ""}
    </div>
    <div class="liste-blanche-champs" ${listeBlancheModeEdition ? "" : "hidden"}>
      <label><span>Identifiant</span><input data-liste-blanche-identifiant maxlength="80" value="${echapperListeBlancheGDA(personne.identifiant)}" required></label>
      <label><span>Discord ID</span><input data-liste-blanche-discord inputmode="numeric" value="${echapperListeBlancheGDA(personne.discordId)}" required></label>
    </div>
    <h4>Permissions accordées</h4>
    <div class="liste-blanche-permissions">${cases}</div>
    <div class="liste-blanche-actions">
      <span class="liste-blanche-retour" aria-live="polite"></span>
      <button type="button" data-liste-blanche-enregistrer>Enregistrer</button>
      ${listeBlancheModeEdition ? '<button type="button" data-liste-blanche-annuler>Annuler</button><button type="button" class="danger" data-liste-blanche-supprimer>Supprimer</button>' : ""}
    </div>
  </article>`;
}

function brancherListeBlancheGDA() {
  document.getElementById("listeBlancheActualiser")?.addEventListener("click", chargerListeBlancheGDA);
  document.getElementById("listeBlancheAjout")?.addEventListener("submit", ajouterPersonneListeBlancheGDA);
  document.querySelectorAll("[data-liste-blanche-selection]").forEach(bouton => bouton.addEventListener("click", () => {
    listeBlancheSelectionId = bouton.dataset.listeBlancheSelection;
    listeBlancheModeEdition = false;
    afficherListeBlancheGDA();
  }));
  document.querySelectorAll("[data-liste-blanche-editer]").forEach(bouton => bouton.addEventListener("click", () => {
    listeBlancheSelectionId = bouton.dataset.listeBlancheEditer;
    listeBlancheModeEdition = true;
    afficherListeBlancheGDA();
  }));
  document.querySelector("[data-liste-blanche-enregistrer]")?.addEventListener("click", modifierPersonneListeBlancheGDA);
  document.querySelector("[data-liste-blanche-supprimer]")?.addEventListener("click", supprimerPersonneListeBlancheGDA);
  document.querySelector("[data-liste-blanche-annuler]")?.addEventListener("click", () => {
    listeBlancheModeEdition = false;
    afficherListeBlancheGDA();
  });
  const staff = document.querySelector("[data-role-staff-total]");
  staff?.addEventListener("change", () => appliquerEtatRoleStaffListeBlancheGDA(staff.closest(".liste-blanche-panneau")));
  appliquerEtatRoleStaffListeBlancheGDA(staff?.closest(".liste-blanche-panneau"));
}

function appliquerEtatRoleStaffListeBlancheGDA(panneau) {
  if (!panneau) return;
  const staff = panneau.querySelector("[data-role-staff-total]");
  panneau.querySelectorAll("[data-permission]").forEach(casePermission => {
    if (casePermission !== staff) casePermission.disabled = !!staff?.checked;
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
    const resultat = await requeteListeBlancheGDA("ajouterListeBlanche", Object.fromEntries(new FormData(formulaire).entries()));
    afficherNotificationGDA(resultat.message, "succes");
    await chargerListeBlancheGDA();
  } catch (erreur) {
    retour.textContent = erreur.message;
    retour.classList.add("erreur");
  } finally { bouton.disabled = false; }
}

async function modifierPersonneListeBlancheGDA(evenement) {
  const bouton = evenement.currentTarget;
  const panneau = bouton.closest(".liste-blanche-panneau");
  const personne = listeBlanchePersonnes.find(p => p.id === panneau.dataset.listeBlancheId);
  const retour = panneau.querySelector(".liste-blanche-retour");
  const permissions = Array.from(panneau.querySelectorAll("[data-permission]:checked")).map(el => el.dataset.permission);
  bouton.disabled = true;
  try {
    const resultat = await requeteListeBlancheGDA("modifierListeBlanche", {
      id: personne.id,
      nouvelIdentifiant: panneau.querySelector("[data-liste-blanche-identifiant]")?.value || personne.identifiant,
      discordId: panneau.querySelector("[data-liste-blanche-discord]")?.value || personne.discordId,
      permissions: permissions.join(",")
    });
    listeBlancheModeEdition = false;
    afficherNotificationGDA(resultat.message, "succes");
    await chargerListeBlancheGDA();
  } catch (erreur) {
    retour.textContent = erreur.message;
    retour.classList.add("erreur");
    bouton.disabled = false;
  }
}

async function supprimerPersonneListeBlancheGDA(evenement) {
  const bouton = evenement.currentTarget;
  const panneau = bouton.closest(".liste-blanche-panneau");
  const personne = listeBlanchePersonnes.find(p => p.id === panneau.dataset.listeBlancheId);
  if (!window.confirm("Retirer " + personne.identifiant + " de la liste blanche ? Son accès sera immédiatement révoqué.")) return;
  bouton.disabled = true;
  try {
    const resultat = await requeteListeBlancheGDA("supprimerListeBlanche", { id: personne.id });
    listeBlancheSelectionId = "";
    listeBlancheModeEdition = false;
    afficherNotificationGDA(resultat.message, "succes");
    await chargerListeBlancheGDA();
  } catch (erreur) {
    panneau.querySelector(".liste-blanche-retour").textContent = erreur.message;
    bouton.disabled = false;
  }
}

function echapperListeBlancheGDA(valeur) {
  return String(valeur == null ? "" : valeur).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

