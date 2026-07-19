let recommandationsObservationsDonnees = null;
let recommandationsObservationsCharge = false;

function ouvrirRecommandationsObservationsGDA() {
  definirModuleGdaActif("recommandations-observations");
  if (recommandationsObservationsCharge && recommandationsObservationsDonnees) {
    afficherRecommandationsObservationsGDA(recommandationsObservationsDonnees);
    chargerRecommandationsObservationsGDA(true);
    return;
  }
  const espace = document.getElementById("workspace");
  if (espace) espace.innerHTML = '<section class="ro-module"><div class="ro-message">Chargement…</div></section>';
  chargerRecommandationsObservationsGDA(false);
}

async function chargerRecommandationsObservationsGDA(silencieux) {
  try {
    const reponse = await fetch(API_URL + "?action=recupererRecommandationsObservations");
    const resultat = await reponse.json();
    if (!resultat.success) throw new Error(resultat.message || "Données indisponibles.");
    recommandationsObservationsDonnees = resultat;
    recommandationsObservationsCharge = true;
    if (moduleGdaEstActif("recommandations-observations")) {
      afficherRecommandationsObservationsGDA(resultat);
    }
  } catch (erreur) {
    if (!silencieux && moduleGdaEstActif("recommandations-observations")) {
      const espace = document.getElementById("workspace");
      if (espace) espace.innerHTML = `<section class="ro-module"><div class="ro-message ro-erreur">${roEchapper(erreur.message)}</div></section>`;
    }
  }
}

function afficherRecommandationsObservationsGDA(resultat) {
  const espace = document.getElementById("workspace");
  if (!espace) return;
  const membres = Array.isArray(resultat.membres) ? resultat.membres : [];
  const historique = Array.isArray(resultat.historique) ? resultat.historique : [];
  const options = membres.map(function (membre) {
    return `<option value="${roEchapper(membre.nom)}">${roEchapper(membre.nom)} — ${roEchapper(membre.grade)}</option>`;
  }).join("");
  const personnesAvecDonnees = membres.filter(function (membre) {
    return Number(membre.recommandations || 0) > 0 || Number(membre.observations || 0) > 0;
  });

  espace.innerHTML = `
    <section class="ro-module">
      <header class="ro-entete">
        <div><span>Espace Officier GDA</span><h3>⭐ Recommandations et observations</h3><p>Enregistrez et suivez les éléments de la semaine.</p></div>
        <div class="ro-actions-entete">
          <button type="button" id="roActualiser">↻ Actualiser</button>
          ${resultat.peutPurger ? '<button type="button" id="roPurger" class="ro-danger">🗑 Nouvelle semaine</button>' : ''}
        </div>
      </header>

      <form id="roFormulaire" class="ro-formulaire">
        <label><span>Personne concernée *</span><select name="personne" required><option value="">Choisir…</option>${options}</select></label>
        <label><span>Type *</span><select name="type" id="roType" required><option value="">Choisir…</option><option value="RECOMMANDATION">Recommandation</option><option value="OBSERVATION">Observation</option></select></label>
        <label id="roNatureBloc" hidden><span>Type d’observation *</span><select name="nature" id="roNature"><option value="">Choisir…</option><option value="POSITIVE">Positive</option><option value="NEGATIVE">Négative</option></select></label>
        <label id="roEmetteurBloc" hidden><span>Transmis par *</span><select name="emetteur" id="roEmetteur"><option value="">Choisir…</option>${options}<option value="AUTRE">Autre personne…</option></select></label>
        <label id="roEmetteurAutreBloc" hidden><span>Nom extérieur *</span><input name="emetteurAutre" maxlength="120" placeholder="Nom de la personne"></label>
        <label id="roDateBloc" hidden><span>Date *</span><input name="date" id="roDate" type="date" value="${roDateAujourdhui()}"></label>
        <label id="roRaisonTypeBloc" hidden><span>Motif *</span><select name="raisonType" id="roRaisonType"><option value="">Choisir…</option><option value="RECOMPENSE DE MISSION">Récompense de mission</option><option value="AUTRE">Autre…</option></select></label>
        <label id="roRaisonBloc" class="ro-large" hidden><span id="roRaisonLibelle">Raison *</span><textarea name="raison" maxlength="3000" placeholder="Décrivez précisément la raison…"></textarea></label>
        <input type="hidden" name="id" id="roEditionId">
        <div class="ro-validation" id="roValidation" hidden><button type="button" id="roAnnulerEdition" class="ro-secondaire" hidden>Annuler</button><button type="submit" id="roEnregistrer">✓ Enregistrer</button></div>
      </form>

      <section class="ro-liste">
        <div class="ro-titre-liste"><div><span>Récapitulatif hebdomadaire</span><h4>${personnesAvecDonnees.length} personne${personnesAvecDonnees.length > 1 ? "s" : ""} concernée${personnesAvecDonnees.length > 1 ? "s" : ""}</h4></div></div>
        <div class="ro-resumes">
          ${personnesAvecDonnees.length ? personnesAvecDonnees.map(function (membre) { return roCreerResume(membre, historique); }).join("") : '<div class="ro-vide">Aucune recommandation ou observation enregistrée cette semaine.</div>'}
        </div>
      </section>
    </section>`;

  roBrancherInterface();
}

function roBrancherInterface() {
  const type = document.getElementById("roType");
  const nature = document.getElementById("roNature");
  const emetteur = document.getElementById("roEmetteur");
  const emetteurAutre = document.querySelector('[name="emetteurAutre"]');
  const date = document.getElementById("roDate");
  const raisonType = document.getElementById("roRaisonType");
  const raison = document.querySelector('[name="raison"]');
  if (type) type.addEventListener("change", roActualiserChamps);
  if (nature) nature.addEventListener("change", roActualiserChamps);
  if (emetteur) emetteur.addEventListener("change", roActualiserChamps);
  if (emetteurAutre) emetteurAutre.addEventListener("input", roActualiserChamps);
  if (date) date.addEventListener("change", roActualiserChamps);
  if (raisonType) raisonType.addEventListener("change", roActualiserChamps);
  if (raison) raison.addEventListener("input", roActualiserChamps);
  const formulaire = document.getElementById("roFormulaire");
  if (formulaire) formulaire.addEventListener("submit", roEnregistrer);
  const annulerEdition = document.getElementById("roAnnulerEdition");
  if (annulerEdition) annulerEdition.addEventListener("click", roAnnulerEdition);
  document.querySelectorAll(".ro-resume-entete").forEach(function (entete) {
    entete.addEventListener("click", function () { entete.closest(".ro-resume").classList.toggle("ouvert"); });
  });
  document.querySelectorAll(".ro-modifier").forEach(function (bouton) {
    bouton.addEventListener("click", function (evenement) { evenement.stopPropagation(); roCommencerEdition(bouton.dataset.id); });
  });
  const actualiser = document.getElementById("roActualiser");
  if (actualiser) actualiser.addEventListener("click", function () {
    if (typeof gdaForcerActualisation === "function") gdaForcerActualisation("recupererRecommandationsObservations");
    chargerRecommandationsObservationsGDA(false);
  });
  const purger = document.getElementById("roPurger");
  if (purger) purger.addEventListener("click", roPurger);
  roActualiserChamps();
}

function roActualiserChamps() {
  const type = document.getElementById("roType");
  const nature = document.getElementById("roNature");
  const emetteur = document.getElementById("roEmetteur");
  const emetteurAutre = document.querySelector('[name="emetteurAutre"]');
  const date = document.getElementById("roDate");
  const raisonType = document.getElementById("roRaisonType");
  const raison = document.querySelector('[name="raison"]');
  const valeurType = type ? type.value : "";
  const observation = valeurType === "OBSERVATION";
  const recommandation = valeurType === "RECOMMANDATION";
  const typeChoisi = observation || recommandation;
  const natureChoisie = !observation || !!(nature && nature.value);
  const afficherEmetteur = typeChoisi && natureChoisie;
  const estAutre = afficherEmetteur && emetteur && emetteur.value === "AUTRE";
  const emetteurChoisi = afficherEmetteur && emetteur && !!emetteur.value;
  const nomExterieurValide = !estAutre || !!(emetteurAutre && emetteurAutre.value.trim());
  const afficherDate = emetteurChoisi && nomExterieurValide;
  const dateChoisie = afficherDate && date && !!date.value;
  const afficherMotif = recommandation && dateChoisie;
  const afficherRaison = observation
    ? dateChoisie
    : afficherMotif && raisonType && raisonType.value === "AUTRE";
  const raisonValide = !afficherRaison || !!(raison && raison.value.trim());
  const motifValide = observation || (afficherMotif && raisonType && !!raisonType.value);
  const formulaireComplet = dateChoisie && motifValide && raisonValide;

  roAfficher("roNatureBloc", observation);
  roAfficher("roEmetteurBloc", afficherEmetteur);
  roAfficher("roEmetteurAutreBloc", estAutre);
  roAfficher("roDateBloc", afficherDate);
  roAfficher("roRaisonTypeBloc", afficherMotif);
  roAfficher("roRaisonBloc", afficherRaison);
  roAfficher("roValidation", formulaireComplet);
  const libelle = document.getElementById("roRaisonLibelle");
  if (libelle) libelle.textContent = observation ? "Raison de l’observation *" : "Autre raison *";
}

function roAfficher(id, visible) {
  const element = document.getElementById(id);
  if (!element) return;
  element.hidden = !visible;
  element.querySelectorAll("input,select,textarea").forEach(function (champ) {
    champ.required = visible;
  });
}

async function roEnregistrer(evenement) {
  evenement.preventDefault();
  const formulaire = evenement.currentTarget;
  const bouton = document.getElementById("roEnregistrer");
  const donnees = new URLSearchParams(new FormData(formulaire));
  const edition = !!donnees.get("id");
  donnees.set("action", edition ? "modifierRecommandationObservation" : "ajouterRecommandationObservation");
  try {
    if (bouton) { bouton.disabled = true; bouton.textContent = "Enregistrement…"; }
    const reponse = await fetch(API_URL, {method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}, body:donnees.toString()});
    const resultat = await reponse.json();
    if (!resultat.success) throw new Error(resultat.message || "Enregistrement impossible.");
    if (typeof invaliderCacheEffectifGDA === "function") invaliderCacheEffectifGDA();
    recommandationsObservationsCharge = false;
    await chargerRecommandationsObservationsGDA(false);
  } catch (erreur) {
    alert(erreur.message || "Enregistrement impossible.");
  } finally {
    if (bouton && document.body.contains(bouton)) { bouton.disabled = false; bouton.textContent = "✓ Enregistrer"; }
  }
}

async function roPurger() {
  if (!confirm("Commencer une nouvelle semaine ? Tous les compteurs de recommandations et d’observations seront remis à zéro.")) return;
  const bouton = document.getElementById("roPurger");
  try {
    if (bouton) bouton.disabled = true;
    const reponse = await fetch(API_URL + "?action=purgerRecommandationsObservations", {method:"POST"});
    const resultat = await reponse.json();
    if (!resultat.success) throw new Error(resultat.message || "Purge impossible.");
    if (typeof invaliderCacheEffectifGDA === "function") invaliderCacheEffectifGDA();
    recommandationsObservationsCharge = false;
    await chargerRecommandationsObservationsGDA(false);
  } catch (erreur) {
    alert(erreur.message || "Purge impossible.");
  } finally {
    if (bouton && document.body.contains(bouton)) bouton.disabled = false;
  }
}

function roCommencerEdition(id) {
  const entree = (recommandationsObservationsDonnees.historique || []).find(function (item) { return String(item.id) === String(id); });
  if (!entree) return alert("Entrée introuvable. Actualisez la page.");
  const formulaire = document.getElementById("roFormulaire");
  if (!formulaire) return;
  formulaire.personne.value = entree.personne || "";
  formulaire.type.value = String(entree.type || "").toUpperCase().includes("OBSERVATION") ? "OBSERVATION" : "RECOMMANDATION";
  formulaire.nature.value = String(entree.nature || "").toUpperCase().includes("POSITIVE") ? "POSITIVE" : "NEGATIVE";
  const noms = (recommandationsObservationsDonnees.membres || []).map(function (m) { return String(m.nom).toLowerCase(); });
  if (noms.includes(String(entree.emetteur || "").toLowerCase())) {
    formulaire.emetteur.value = entree.emetteur; formulaire.emetteurAutre.value = "";
  } else {
    formulaire.emetteur.value = "AUTRE"; formulaire.emetteurAutre.value = entree.emetteur || "";
  }
  formulaire.date.value = roDateVersISO(entree.date);
  if (formulaire.type.value === "RECOMMANDATION") {
    const mission = String(entree.nature || "").toUpperCase().includes("MISSION");
    formulaire.raisonType.value = mission ? "RECOMPENSE DE MISSION" : "AUTRE";
    formulaire.raison.value = mission ? "" : (entree.raison || "");
  } else formulaire.raison.value = entree.raison || "";
  document.getElementById("roEditionId").value = entree.id;
  document.getElementById("roAnnulerEdition").hidden = false;
  document.getElementById("roEnregistrer").textContent = "✓ Enregistrer la modification";
  roActualiserChamps();
  formulaire.scrollIntoView({behavior:"smooth", block:"center"});
}

function roAnnulerEdition() {
  const formulaire = document.getElementById("roFormulaire");
  if (!formulaire) return;
  formulaire.reset();
  document.getElementById("roEditionId").value = "";
  document.getElementById("roAnnulerEdition").hidden = true;
  document.getElementById("roEnregistrer").textContent = "✓ Enregistrer";
  const date = document.getElementById("roDate");
  if (date) date.value = roDateAujourdhui();
  roActualiserChamps();
}

function roCreerResume(membre, historique) {
  const entrees = historique.filter(function (entree) { return String(entree.personne).toLowerCase() === String(membre.nom).toLowerCase(); });
  return `<article class="ro-resume"><button type="button" class="ro-resume-entete"><div><strong>${roEchapper(membre.nom)}</strong><span>${roEchapper(membre.grade)}</span></div><div class="ro-compteurs"><span class="ro-reco">⭐ ${Number(membre.recommandations || 0)} recommandation${Number(membre.recommandations || 0) > 1 ? "s" : ""}</span><span class="ro-obs">👁 ${Number(membre.observations || 0)} observation${Number(membre.observations || 0) > 1 ? "s" : ""}</span></div><b class="ro-chevron">⌄</b></button><div class="ro-details">${entrees.map(roCreerHistorique).join("")}</div></article>`;
}

function roCreerHistorique(entree) {
  const classe = String(entree.type || "").toLowerCase().includes("observation") ? "observation" : "recommandation";
  const utilisateur = String(sessionStorage.getItem("identifiantUtilisateur") || sessionStorage.getItem("nomUtilisateur") || "").trim().toLowerCase();
  const peutModifier = utilisateur !== String(entree.personne || "").trim().toLowerCase();
  return `<article class="ro-entree ${classe}"><div class="ro-entree-haut"><span><strong>${roEchapper(entree.type)}</strong> · ${roEchapper(entree.nature)}</span><time>${roEchapper(entree.date)}</time>${peutModifier ? `<button type="button" class="ro-modifier" data-id="${roEchapper(entree.id)}">✎ Modifier</button>` : '<em>Entrée vous concernant</em>'}</div><p>${roEchapper(entree.raison)}</p><small>Transmis par ${roEchapper(entree.emetteur)} · enregistré par ${roEchapper(entree.enregistrePar)} le ${roEchapper(entree.creeLe || "")}</small></article>`;
}

function roDateVersISO(valeur) {
  const texte = String(valeur || "").trim();
  const fr = texte.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (fr) return fr[3] + "-" + fr[2] + "-" + fr[1];
  return /^\d{4}-\d{2}-\d{2}$/.test(texte) ? texte : roDateAujourdhui();
}

function roDateAujourdhui() {
  const date = new Date();
  const decalage = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - decalage).toISOString().slice(0, 10);
}

function roEchapper(valeur) {
  if (typeof echapperHTML === "function") return echapperHTML(String(valeur == null ? "" : valeur));
  return String(valeur == null ? "" : valeur).replace(/[&<>"']/g, function (caractere) {
    return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[caractere];
  });
}

window.ouvrirRecommandationsObservationsGDA = ouvrirRecommandationsObservationsGDA;
