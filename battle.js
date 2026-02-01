// battle.js
import { clamp, pick, typeMultiplier, effText, statusCatchBonus, now } from "./data.js";
import { activeIndex, firstNonFaintedIndex } from "./state.js";

function tryHit(move){
  const acc = clamp(move.accuracy || 95, 30, 100);
  return Math.random()*100 <= acc;
}

function critMultiplier(){
  return (Math.random() < 0.0625) ? 1.5 : 1.0; // ~6.25%
}

function speedWithStatus(p){
  let s = p.spd || 55;
  if(p.status === "paralyze") s = Math.floor(s * 0.5);
  return s;
}

export function damage(attacker, defender, move){
  const power = clamp(move.power || 45, 10, 140);

  let atk = attacker.atk || 55;
  const def = defender.def || 55;
  const lvl = attacker.level || 20;

  // Burn reduces physical attack (simple rule)
  if(attacker.status === "burn") atk = Math.floor(atk * 0.85);

  let base = (((2*lvl/5 + 2) * power * (atk/def)) / 50) + 2;

  // STAB
  if((attacker.types||[]).includes(move.type)) base *= 1.2;

  // Type effectiveness
  const mult = typeMultiplier(move.type, defender.types || []);
  base *= mult;

  // Crit
  const crit = critMultiplier();
  base *= crit;

  // Random
  const random = 0.85 + Math.random()*0.15;

  const dmg = Math.max(1, Math.floor(base * random));
  return { dmg, mult, crit: crit > 1.0 };
}

export function statusLine(p){
  if(!p?.status || p.status==="none") return "Status: —";
  if(p.status==="sleep") return `Status: SLP (${p.sleepTurns||1})`;
  return `Status: ${p.status.toUpperCase()}`;
}

export function applyEndTurnStatus(p){
  if(!p || p.fainted) return { text:"", changed:false };

  if(p.status === "poison"){
    const dot = Math.max(1, Math.floor(p.maxHp * 0.07));
    p.hp = Math.max(0, p.hp - dot);
    if(p.hp === 0) p.fainted = true;
    return { text:`${p.name} is hurt by poison (-${dot}).`, changed:true };
  }

  if(p.status === "burn"){
    const dot = Math.max(1, Math.floor(p.maxHp * 0.05));
    p.hp = Math.max(0, p.hp - dot);
    if(p.hp === 0) p.fainted = true;
    return { text:`${p.name} is hurt by burn (-${dot}).`, changed:true };
  }

  // Sleep decreases turns at end of that Pokémon's action
  return { text:"", changed:false };
}

export function canAct(p){
  if(!p || p.fainted) return { ok:false, reason:"fainted" };

  if(p.status === "sleep"){
    p.sleepTurns = Math.max(0, (p.sleepTurns||1) - 1);
    if(p.sleepTurns > 0){
      return { ok:false, reason:`${p.name} is asleep.` };
    }
    p.status = "none";
    return { ok:true, reason:`${p.name} woke up!` };
  }

  if(p.status === "freeze"){
    // 20% thaw each turn
    if(Math.random() < 0.20){
      p.status = "none";
      return { ok:true, reason:`${p.name} thawed out!` };
    }
    return { ok:false, reason:`${p.name} is frozen solid!` };
  }

  if(p.status === "paralyze"){
    // 25% full para
    if(Math.random() < 0.25){
      return { ok:false, reason:`${p.name} is fully paralyzed!` };
    }
  }

  return { ok:true, reason:"" };
}

export function maybeInflictStatus(moveType){
  // Tiny simple chances (you can tune later)
  // Fire -> burn, Electric -> para, Ice -> freeze, Poison -> poison
  const r = Math.random();
  if(moveType==="fire" && r < 0.12) return "burn";
  if(moveType==="electric" && r < 0.12) return "paralyze";
  if(moveType==="ice" && r < 0.10) return "freeze";
  if(moveType==="poison" && r < 0.12) return "poison";
  return "none";
}

export function ensureBattleReady(state){
  const enc = state.encounter;
  if(!enc) return { ok:false, msg:"Start a wild encounter first." };
  if(state.party.length===0) return { ok:false, msg:"You have no Pokémon. Catch one first." };

  let idx = activeIndex(state);
  if(state.party[idx]?.fainted){
    idx = firstNonFaintedIndex(state);
    if(idx === -1){
      state.encounter = null;
      return { ok:false, msg:"All your Pokémon fainted… wild ran away." };
    }
    state.activePartyIndex = idx;
  }
  return { ok:true, msg:"" };
}

export function decideTurnOrder(me, wild){
  const sMe = speedWithStatus(me);
  const sW  = speedWithStatus(wild);
  if(sMe === sW) return (Math.random() < 0.5) ? "me" : "wild";
  return (sMe > sW) ? "me" : "wild";
}

export function doAttack(attacker, defender, move, { allowStatus=true } = {}){
  if(move.ppLeft <= 0) return { text:`${move.name} is out of PP!`, hit:false };

  move.ppLeft--;

  // Status check (sleep/freeze/para)
  const act = canAct(attacker);
  if(!act.ok){
    return { text: act.reason, hit:false };
  }

  // If woke/thawed message exists, include it before attack
  let prefix = act.reason ? (act.reason + " ") : "";

  if(!tryHit(move)){
    return { text: `${prefix}${attacker.name} used ${move.name}… it missed!`, hit:false };
  }

  const { dmg, mult, crit } = damage(attacker, defender, move);
  defender.hp = Math.max(0, defender.hp - dmg);
  if(defender.hp === 0) defender.fainted = true;

  let extra = effText(mult);
  if(crit) extra = (extra ? `Critical hit! ${extra}` : "Critical hit!");
  const line = `${prefix}${attacker.name} used ${move.name}! It did ${dmg}. ${extra}`.trim();

  // Chance to inflict status if allowed and defender not already statused
  if(allowStatus && (!defender.status || defender.status==="none")){
    const st = maybeInflictStatus(move.type);
    if(st !== "none"){
      defender.status = st;
      if(st==="sleep") defender.sleepTurns = 2;
      return { text: `${line} ${defender.name} is now ${st.toUpperCase()}!`, hit:true, mult };
    }
  }

  return { text: line, hit:true, mult };
}

export function endTurnWildRunCheck(state){
  // Rare chance wild runs after many turns
  const enc = state.encounter;
  if(!enc) return null;
  enc.turns = (enc.turns||0);
  if(enc.turns >= 7 && Math.random() < 0.12){
    const msg = `Wild ${enc.name} ran away!`;
    state.encounter = null;
    return msg;
  }
  return null;
}

// Catch math used for both encounter/battle
export function computeCatchChance(state, ball){
  const enc = state.encounter;
  if(!enc) return 0;

  const hpRatio = enc.hp / enc.maxHp;
  const hpFactor = clamp(1.35 - hpRatio, 0.35, 1.1);

  let chance = enc.catchBase * ball.mult * hpFactor;

  // status bonus
  chance *= statusCatchBonus(enc.status || "none");

  // special ball rules
  if(ball.key==="repeat_ball" && state.dexCaught[enc.id]) chance *= 1.25;
  if(ball.key==="quick_ball" && (enc.throws||0) === 0) chance *= 1.25;
  if(ball.key==="timer_ball" && (enc.turns||0) >= 4) chance *= 1.20;

  if(state.items.catch_spray_active){
    chance *= 1.10;
  }

  if(ball.key==="master_ball") return 1.0;

  // clamp (not 100%)
  return clamp(chance, 0.03, 0.85);
}

export function healPartyAll(state){
  for(const p of state.party){
    p.hp = p.maxHp;
    p.fainted = false;
    p.status = "none";
    p.sleepTurns = 0;
    for(const mv of p.moves){ mv.ppLeft = mv.pp; }
  }
  state.healCooldownUntil = now() + 5*60*1000;
}

export function reviveOne(p){
  p.fainted = false;
  p.hp = Math.max(1, Math.floor(p.maxHp * 0.5));
  p.status = "none";
  p.sleepTurns = 0;
}
