import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Scenario de charge "pic d'identification simultanee en ouverture de
 * scrutin" (doc 06 §7.2). Simule de nombreux electeurs qui s'identifient
 * au meme instant sur /connexion. N'effectue pas de vote (qui est a
 * usage unique par electeur de demonstration, donc pas representatif
 * d'une charge soutenue) — seulement l'identification elle-meme, qui est
 * le goulot d'etranglement reel a l'ouverture d'un scrutin.
 *
 * Usage : BASE_URL=http://localhost:3100 k6 run tests/load/identification-spike.js
 * Necessite `npm run dev` (ou `npm run build && npm run start`) lance a
 * part, en mode demonstration (sans Supabase).
 */

const BASE_URL = __ENV.BASE_URL || "http://localhost:3100";

// Comptes de demonstration seedes par lib/demo/store.ts — la verification
// de code ne limite pas le nombre de connexions, seul le vote est a
// usage unique ; reutiliser ces 3 comptes en boucle est donc valide pour
// mesurer la charge d'identification.
const DEMO_VOTERS = ["0000001", "0000002", "0000003"];

export const options = {
  scenarios: {
    pic_ouverture_scrutin: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 50 },  // montee en charge a l'ouverture
        { duration: "20s", target: 50 },  // maintien du pic
        { duration: "10s", target: 0 },   // redescente
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],       // moins de 1% d'echecs
    http_req_duration: ["p(95)<2000"],    // 95% des requetes sous 2s
  },
};

function extractActionId(html) {
  const match = html.match(/name="(\$ACTION_ID_[a-f0-9]+)"/);
  return match ? match[1] : null;
}

/**
 * Next.js n'accepte la soumission d'une Server Action que si le corps
 * est reellement multipart/form-data (comme le formulaire HTML genere
 * le declare, encType="multipart/form-data") — un corps urlencoded est
 * ignore silencieusement (200, meme page, aucune action declenchee).
 * k6 ne construit du multipart automatiquement que via http.file(), donc
 * on l'encode a la main pour des champs texte simples.
 */
function buildMultipartBody(fields) {
  const boundary = "----k6Boundary" + Math.random().toString(16).slice(2);
  let body = "";
  for (const [key, value] of Object.entries(fields)) {
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
    body += `${value}\r\n`;
  }
  body += `--${boundary}--\r\n`;
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

export default function () {
  const getRes = http.get(`${BASE_URL}/connexion`);
  check(getRes, { "page de connexion chargee": (r) => r.status === 200 });

  const actionId = extractActionId(getRes.body);
  if (!actionId) {
    console.error("Impossible d'extraire l'identifiant de la Server Action — page modifiee ?");
    return;
  }

  const voterNumber = DEMO_VOTERS[Math.floor(Math.random() * DEMO_VOTERS.length)];

  const { body, contentType } = buildMultipartBody({
    [actionId]: "",
    voterNumber,
    verificationCode: "123456",
  });

  const postRes = http.post(`${BASE_URL}/connexion`, body, {
    headers: { "Content-Type": contentType },
    redirects: 0,
  });

  check(postRes, {
    "identification redirige vers /espace": (r) =>
      r.status === 303 && (r.headers["Location"] || "").includes("/espace"),
  });

  sleep(Math.random() * 0.5);
}
