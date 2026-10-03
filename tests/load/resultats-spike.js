import http from "k6/http";
import { check } from "k6";

/**
 * Scenario de charge "pic de consultation de la page publique de
 * resultats a la cloture" (doc 06 §7.2). Simule un grand nombre de
 * visiteurs anonymes qui rafraichissent /resultats en meme temps.
 *
 * Usage : BASE_URL=http://localhost:3100 k6 run tests/load/resultats-spike.js
 */

const BASE_URL = __ENV.BASE_URL || "http://localhost:3100";

export const options = {
  scenarios: {
    pic_cloture_resultats: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 100 },
        { duration: "20s", target: 100 },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/resultats`);
  check(res, {
    "page des resultats chargee": (r) => r.status === 200,
    "bandeau de simulation present": (r) => r.body.includes("SIMULATION"),
  });
}
