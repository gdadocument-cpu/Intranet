const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://opensheet.elk.sh",
    "frame-src 'self' https://dashboardmdcgda.github.io https://docs.google.com https://sites.google.com",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests"
  ].join("; "),

  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
};

const CACHE_POLICIES = {
  // Le HTML doit toujours être revalidé afin qu'une mise à jour soit visible
  // immédiatement, tout en autorisant une réponse 304 très légère.
  document: "public, max-age=0, must-revalidate",
  // Les scripts et styles restent instantanés lors des changements de page,
  // puis se mettent à jour discrètement en arrière-plan.
  code: "public, max-age=300, stale-while-revalidate=86400",
  // Les images du dépôt changent rarement. Cloudflare peut les conserver à
  // l'edge et le navigateur pendant une semaine.
  image: "public, max-age=604800, stale-while-revalidate=2592000",
  font: "public, max-age=2592000, stale-while-revalidate=2592000",
  other: "public, max-age=3600, stale-while-revalidate=86400"
};

function cachePolicyFor(pathname, contentType) {
  const path = pathname.toLowerCase();
  const type = String(contentType || "").toLowerCase();

  if (path.endsWith(".html") || type.includes("text/html")) {
    return CACHE_POLICIES.document;
  }
  if (/\.(?:js|mjs|css)$/.test(path) ||
      type.includes("javascript") || type.includes("text/css")) {
    return CACHE_POLICIES.code;
  }
  if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/.test(path) ||
      type.startsWith("image/")) {
    return CACHE_POLICIES.image;
  }
  if (/\.(?:woff2?|ttf|otf)$/.test(path) || type.startsWith("font/")) {
    return CACHE_POLICIES.font;
  }
  return CACHE_POLICIES.other;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...SECURITY_HEADERS
    }
  });
}

function cleanText(value, maxLength = 4000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function nullableText(value, maxLength) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function normalizedKey(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

function uniqueTexts(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => cleanText(value, 250))
      .filter(Boolean)
  )];
}

function expandSpecializations(values) {
  const result = [];
  uniqueTexts(values).forEach((value) => {
    if (normalizedKey(value) === "instructeur et medecin") {
      result.push("Instructeur", "Médecin");
    } else {
      result.push(value);
    }
  });
  return uniqueTexts(result);
}

function authorizedSync(request, env) {
  const expected = cleanText(env.D1_SYNC_SECRET, 1000);
  const supplied = cleanText(
    request.headers.get("Authorization"),
    1200
  ).replace(/^Bearer\s+/i, "");
  return expected.length >= 32 && supplied === expected;
}

async function syncEffectif(request, env) {
  if (!env.DB) {
    return jsonResponse(
      { success: false, message: "Binding D1 DB absent." },
      503
    );
  }
  if (!authorizedSync(request, env)) {
    return jsonResponse(
      { success: false, message: "Synchronisation non autorisée." },
      401
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      { success: false, message: "Corps JSON invalide." },
      400
    );
  }

  const sourceMembers = Array.isArray(payload?.membres)
    ? payload.membres
    : [];
  if (!sourceMembers.length || sourceMembers.length > 500) {
    return jsonResponse(
      { success: false, message: "Effectif vide ou trop volumineux." },
      400
    );
  }

  const seen = new Set();
  const members = sourceMembers.map((source) => {
    const matricule = cleanText(source?.matricule, 120);
    const key = normalizedKey(matricule);
    if (!matricule || seen.has(key)) {
      throw new Error(
        !matricule
          ? "Un matricule est vide."
          : `Matricule dupliqué : ${matricule}`
      );
    }
    seen.add(key);
    return {
      matricule,
      grade: cleanText(source?.grade, 80),
      steamId: nullableText(source?.steamId, 40),
      discordId: nullableText(source?.discordId, 40),
      presence: normalizedKey(source?.presence) === "absent"
        ? "Absent"
        : "Présent",
      nombreRapports: positiveInteger(source?.nombreRapports),
      nombreObservations: positiveInteger(source?.nombreObservations),
      nombreRecommandations: positiveInteger(source?.nombreRecommandations),
      datePromotionRetrogradation: nullableText(
        source?.datePromotionRetrogradation,
        30
      ),
      dateEntreeGda: nullableText(source?.dateEntreeGda, 30),
      sanction: cleanText(source?.sanction, 250) || "Clean",
      notes: nullableText(source?.notes, 4000),
      periodeProbatoire: source?.periodeProbatoire ? 1 : 0,
      medailles: uniqueTexts(source?.medailles),
      specialisations: expandSpecializations(source?.specialisations)
    };
  });

  const now = new Date().toISOString();
  const baseStatements = [
    env.DB.prepare(
      "UPDATE effectif SET actif = 0, date_modification = ?"
    ).bind(now)
  ];
  for (const member of members) {
    baseStatements.push(
      env.DB.prepare(`
        INSERT INTO effectif (
          matricule, grade, steam_id, discord_id, presence,
          nombre_rapports, nombre_observations, nombre_recommandations,
          date_promotion_retrogradation, date_entree_gda, sanction, notes,
          periode_probatoire, actif, date_modification
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(matricule) DO UPDATE SET
          grade = excluded.grade,
          steam_id = excluded.steam_id,
          discord_id = excluded.discord_id,
          presence = excluded.presence,
          nombre_rapports = excluded.nombre_rapports,
          nombre_observations = excluded.nombre_observations,
          nombre_recommandations = excluded.nombre_recommandations,
          date_promotion_retrogradation =
            excluded.date_promotion_retrogradation,
          date_entree_gda = excluded.date_entree_gda,
          sanction = excluded.sanction,
          notes = excluded.notes,
          periode_probatoire = excluded.periode_probatoire,
          actif = 1,
          date_modification = excluded.date_modification
      `).bind(
        member.matricule,
        member.grade,
        member.steamId,
        member.discordId,
        member.presence,
        member.nombreRapports,
        member.nombreObservations,
        member.nombreRecommandations,
        member.datePromotionRetrogradation,
        member.dateEntreeGda,
        member.sanction,
        member.notes,
        member.periodeProbatoire,
        now
      )
    );
  }
  await env.DB.batch(baseStatements);

  const medalNames = uniqueTexts(
    members.flatMap((member) => member.medailles)
  );
  const specializationNames = uniqueTexts(
    members.flatMap((member) => member.specialisations)
  );
  const catalogStatements = [];
  medalNames.forEach((name) => {
    catalogStatements.push(
      env.DB.prepare(
        "INSERT OR IGNORE INTO medailles (nom, actif) VALUES (?, 1)"
      ).bind(name)
    );
  });
  specializationNames.forEach((name) => {
    catalogStatements.push(
      env.DB.prepare(
        "INSERT OR IGNORE INTO specialisations (nom, actif) VALUES (?, 1)"
      ).bind(name)
    );
  });
  if (catalogStatements.length) {
    await env.DB.batch(catalogStatements);
  }

  const [effectifRows, medalRows, specializationRows] = await Promise.all([
    env.DB.prepare(
      "SELECT id, matricule FROM effectif WHERE actif = 1"
    ).all(),
    env.DB.prepare("SELECT id, nom FROM medailles WHERE actif = 1").all(),
    env.DB.prepare(
      "SELECT id, nom FROM specialisations WHERE actif = 1"
    ).all()
  ]);
  const effectifIds = new Map(
    effectifRows.results.map((row) => [normalizedKey(row.matricule), row.id])
  );
  const medalIds = new Map(
    medalRows.results.map((row) => [normalizedKey(row.nom), row.id])
  );
  const specializationIds = new Map(
    specializationRows.results.map(
      (row) => [normalizedKey(row.nom), row.id]
    )
  );

  const linkStatements = [
    env.DB.prepare("DELETE FROM effectif_medailles"),
    env.DB.prepare("DELETE FROM effectif_specialisations")
  ];
  members.forEach((member) => {
    const effectifId = effectifIds.get(normalizedKey(member.matricule));
    member.medailles.forEach((name) => {
      const medalId = medalIds.get(normalizedKey(name));
      if (effectifId && medalId) {
        linkStatements.push(
          env.DB.prepare(`
            INSERT INTO effectif_medailles (
              effectif_id, medaille_id, date_attribution, actif
            ) VALUES (?, ?, ?, 1)
          `).bind(effectifId, medalId, now)
        );
      }
    });
    member.specialisations.forEach((name) => {
      const specializationId = specializationIds.get(normalizedKey(name));
      if (effectifId && specializationId) {
        linkStatements.push(
          env.DB.prepare(`
            INSERT INTO effectif_specialisations (
              effectif_id, specialisation_id, date_attribution
            ) VALUES (?, ?, ?)
          `).bind(effectifId, specializationId, now)
        );
      }
    });
  });
  await env.DB.batch(linkStatements);

  return jsonResponse({
    success: true,
    membresSynchronises: members.length,
    medaillesLiees: members.reduce(
      (total, member) => total + member.medailles.length,
      0
    ),
    specialisationsLiees: members.reduce(
      (total, member) => total + member.specialisations.length,
      0
    ),
    synchroniseLe: now
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (
      url.pathname === "/api/synchronisation/effectif" &&
      request.method === "POST"
    ) {
      try {
        return await syncEffectif(request, env);
      } catch (error) {
        console.error("Synchronisation effectif D1", error);
        return jsonResponse(
          {
            success: false,
            message: error instanceof Error
              ? error.message
              : "Erreur de synchronisation D1."
          },
          500
        );
      }
    }

    // Seuls GET et HEAD servent les ressources statiques. Les futures routes
    // d'API ne seront donc jamais mises en cache accidentellement.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Méthode non autorisée", {
        status: 405,
        headers: { Allow: "GET, HEAD", ...SECURITY_HEADERS }
      });
    }

    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value);
    }

    headers.set(
      "Cache-Control",
      cachePolicyFor(url.pathname, headers.get("Content-Type"))
    );

    // Évite qu'un cache intermédiaire mélange des variantes compressées.
    headers.append("Vary", "Accept-Encoding");

    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers
    });
  }
};
