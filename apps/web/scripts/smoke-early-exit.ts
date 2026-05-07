// Smoke test del módulo early-exit del firewall.
// Run: npx tsx scripts/smoke-early-exit.ts
//
// Recorre los caller_ids canónicos del demo-config y verifica que:
// - blacklist hits → blacklist_match con severity HIGH + denuncia.
// - whitelist hits → whitelist_match con severity dependiente de policy.
// - default sentinel y números desconocidos → null (no match → cascada normal).

import demoConfig from "../data/demo-config.json" with { type: "json" };
import {
  buildEarlyExitSuccess,
  matchCallerIdAgainstFirewall,
} from "../lib/firewall/early-exit";

const cases: Array<{ caller: string; label: string; expect: "match" | "miss" }> = [
  {
    caller: "+56222119988",
    label: "blacklist banco impostor (CMF)",
    expect: "match",
  },
  {
    caller: "+56229447766",
    label: "blacklist falso reembolso SII (Sernac)",
    expect: "match",
  },
  {
    caller: "+56224431122",
    label: "blacklist falso Carabineros (PDI)",
    expect: "match",
  },
  {
    caller: "+56987654321",
    label: "whitelist Pedro pass_after_verification",
    expect: "match",
  },
  {
    caller: "+56912345678",
    label: "whitelist Carla always_pass",
    expect: "match",
  },
  {
    caller: "+56222555888",
    label: "whitelist Centro Médico take_message_only",
    expect: "match",
  },
  {
    caller: "+56000000000",
    label: "default sentinel (no debe matchear)",
    expect: "miss",
  },
  {
    caller: "+56999999999",
    label: "número desconocido (cascada normal)",
    expect: "miss",
  },
];

let failed = 0;

for (const c of cases) {
  const match = matchCallerIdAgainstFirewall(c.caller, demoConfig);
  if (match === null) {
    if (c.expect === "miss") {
      console.log(`OK · ${c.label}: NO MATCH`);
    } else {
      console.log(`FAIL · ${c.label}: esperaba match pero null`);
      failed += 1;
    }
    continue;
  }
  if (c.expect === "miss") {
    console.log(`FAIL · ${c.label}: esperaba null pero match=${match.reason}`);
    failed += 1;
    continue;
  }

  const success = buildEarlyExitSuccess({
    match,
    callerId: c.caller,
    protectedName: "María",
    audioId: "smoke-test-uuid",
    startedAt: Date.now() - 5,
  });

  const sev = success.caregiver_message?.severity;
  const action = success.decision.action;
  const head = success.caregiver_message?.headline;
  const dn = success.denuncia ? "sí" : "no";

  console.log(
    `OK · ${c.label}: ${match.reason} · severity=${sev} · action=${action} · denuncia=${dn} · "${head}"`,
  );
}

if (failed > 0) {
  console.error(`\n${failed} caso(s) fallaron`);
  process.exit(1);
}
console.log("\nTodos los casos pasaron.");
