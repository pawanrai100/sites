// ui.js
import { BALLS, ITEMS, TYPE_ICON, cap, pick, randInt, clamp } from "./data.js";
import {
  loadState, saveState,
  canSpawn, spawnLeft,
  canHeal, healLeft,
  ballCount, activeIndex, firstNonFaintedIndex
} from "./state.js";

import { fetchPokemonById } from "./pokeapi.js";

import {
  ensureBattleReady, doAttack, decideTurnOrder, applyEndTurnStatus,
  computeCatchChance, healPartyAll, reviveOne, endTurnWildRunCheck
} from "./battle.js";

const $ = (id) => document.getElementById(id);

// ---------- UI helpers ----------
export function setTab(name){
  document.querySelectorAll(".tabbtn[data-tab]").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.tab === name);
  });
  for(const t of ["encounter","battle","pokedex","pc"]){
    $(`tab-${t}`).style.display = (t === name) ? "" : "none";
  }
}

export function logBattle(text){
  $("battleLog").textContent = text;
}

export function spriteHit(which){
  const el = which === "wild" ? $("wildSprite") : $("meSprite");
  el.classList.remove("hit");
  void el.offsetWidth;
  el.classList.add("hit");
}

export function renderChips(state){
  $("coins").textContent = state.coins;
  $("streak").textContent = state.streak;
  $("ballCount").textContent = ballCount(state);
  $("caughtCount").textContent = Object.keys(state.dexCaught).length;

  $("healBtn").textContent = canHeal(state) ? "Heal (ready)" : `Heal (${healLeft(state)}s)`;
  $("spawnBtn").textContent = canSpawn(state) ? "Spawn Pokémon" : `Spawn (${spawnLeft(state)}s)`;
}

export function renderBallSelect(state){
  const sel = $("ballSelect");
  sel.innerHTML = BALLS.map(b=>{
    const qty = state.inventory[b.key] || 0;
    return `<option value="${b.key}">${b.name} (x${qty})</option>`;
  }).join("");
}

export function currentBall(state){
  const key = $("ballSelect").value;
  return BALLS.find(b=>b.key===key) || BALLS[0];
}

export function renderEncounter(state){
  const enc = state.encounter;
  const meta = $("encMeta");

  if(!enc){
    meta.innerHTML = "";
    $("encArt").style.display = "none";
    $("encArtFallback").style.display = "";
    $("encArtFallback").textContent = "Spawn a Pokémon";
    return;
  }

  const typeText = (enc.types||[]).map(t=>`${TYPE_ICON[t]||""} ${t.toUpperCase()}`).join(" / ");
  const statusText = enc.status && enc.status!=="none" ? `• Status ${enc.status.toUpperCase()}` : "";

  meta.innerHTML = `
    <span class="badge">⭐ Rarity: <b>${enc.rarity}</b></span>
    <span class="badge">Lv: <b>${enc.level}</b></span>
    <span class="badge">Type: <b>${typeText || "—"}</b></span>
    <span class="badge">❤️ HP: <b>${enc.hp}/${enc.maxHp}</b></span>
    <span class="badge">🪙 Reward: <b>${enc.rewardCoins}</b> ${statusText}</span>
  `;

  const img = $("encArt");
  const fallback = $("encArtFallback");
  const src = enc.art || enc.front || "";

  if(src){
    img.src = src;
    img.style.display = "";
    fallback.style.display = "none";
    img.onerror = ()=>{
      const alt = enc.front || enc.back || "";
      if(alt && img.src !== alt){
        img.src = alt;
      } else {
        img.style.display = "none";
        fallback.style.display = "";
        fallback.textContent = "Image not available";
      }
    };
  } else {
    img.style.display = "none";
    fallback.style.display = "";
    fallback.textContent = "Image not available";
  }
}

export function renderParty(state){
  const box = $("party");
  const slots = [];
  const aIdx = activeIndex(state);

  for(let i=0;i<6;i++){
    const p = state.party[i];
    if(!p){
      slots.push(`<div class="slot" data-party="${i}"><div class="mini" style="flex:1;">Empty slot</div></div>`);
      continue;
    }
    const pct = p.maxHp ? Math.round((p.hp/p.maxHp)*100) : 0;
    const active = (i === aIdx);
    const types = (p.types||[]).map(t=>`${TYPE_ICON[t]||""}${t.toUpperCase()}`).join(" ");
    const st = p.status && p.status!=="none" ? ` • ${p.status.toUpperCase()}` : "";
    slots.push(`
      <div class="slot ${active ? "active":""}" data-party="${i}">
        <img src="${p.front || p.art || ""}" alt="${p.name}" onerror="this.style.display='none'">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:900; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${p.name} <span class="mini">(Lv ${p.level})</span>
          </div>
          <div class="mini">${types} • ${p.fainted ? "Fainted" : `HP ${p.hp}/${p.maxHp}`}${st}</div>
          <div class="hpbar"><div class="hpfill" style="width:${Math.max(0,Math.min(100,pct))}%"></div></div>
        </div>
      </div>
    `);
  }
  box.innerHTML = slots.join("");
}

export function renderShop(state, { onBuyBall, onBuyItem, onUseItem }){
  const ballsBox = $("shopBalls");
  ballsBox.innerHTML = BALLS.map(b=>`
    <div class="itemRow">
      <div class="left">
        <strong>${b.name}</strong>
        <span>${b.note} • Cost ${b.cost}</span>
      </div>
      <button class="blue" data-buyball="${b.key}">Buy</button>
    </div>
  `).join("");

  const itemsBox = $("shopItems");
  itemsBox.innerHTML = ITEMS.map(it=>{
    const qty = state.items[it.key]||0;
    const canUse = qty > 0 && (it.key==="catch_spray" || it.key==="rarity_booster");
    return `
      <div class="itemRow">
        <div class="left">
          <strong>${it.name}</strong>
          <span>${it.note} • Cost ${it.cost} • You have x${qty}</span>
        </div>
        <div style="display:flex; gap:8px;">
          ${canUse ? `<button class="gray" data-useitem="${it.key}">Use</button>` : ``}
          <button class="blue" data-buyitem="${it.key}">Buy</button>
        </div>
      </div>
    `;
  }).join("");

  ballsBox.querySelectorAll("[data-buyball]").forEach(btn=>{
    btn.addEventListener("click", ()=> onBuyBall(btn.dataset.buyball));
  });
  itemsBox.querySelectorAll("[data-buyitem]").forEach(btn=>{
    btn.addEventListener("click", ()=> onBuyItem(btn.dataset.buyitem));
  });
  itemsBox.querySelectorAll("[data-useitem]").forEach(btn=>{
    btn.addEventListener("click", ()=> onUseItem(btn.dataset.useitem));
  });
}

export function renderDex(state){
  const box = $("dexList");
  const ids = Object.keys(state.dexSeen).map(Number).sort((a,b)=>a-b);

  if(ids.length===0){
    box.innerHTML = `<div class="toast">No Pokémon seen yet. Spawn one!</div>`;
    return;
  }

  box.innerHTML = ids.slice(0, 260).map(id=>{
    const caught = !!state.dexCaught[id];
    return `
      <div class="itemRow">
        <div class="left">
          <strong>#${id} ${caught ? "✅ Caught" : "👀 Seen"}</strong>
          <span>${caught ? "In your collection" : "Not caught yet"}</span>
        </div>
        <button class="gray">View</button>
      </div>
    `;
  }).join("");
}

export function renderPC(state, { onSendToParty }){
  const box = $("pcList");
  if(state.pc.length===0){
    box.innerHTML = `<div class="toast">PC empty. Catch more Pokémon.</div>`;
    return;
  }
  box.innerHTML = state.pc.map((p,i)=>`
    <div class="itemRow">
      <div class="left">
        <strong>${p.name} (${p.rarity})</strong>
        <span>Lv ${p.level} • HP ${p.hp}/${p.maxHp}</span>
      </div>
      <button class="gray" data-toparty="${i}">To Party</button>
    </div>
  `).join("");

  box.querySelectorAll("[data-toparty]").forEach(btn=>{
    btn.addEventListener("click", ()=> onSendToParty(Number(btn.dataset.toparty)));
  });
}

export function showCaptureOverlay(show, text="Throw!"){
  const ov = $("capOverlay");
  const t = $("capText");
  if(!show){ ov.style.display = "none"; return; }
  t.textContent = text;
  ov.style.display = "flex";
}

function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

export async function captureAnimation(textFn){
  showCaptureOverlay(true, "Throw!");
  const ball = $("capBall");
  ball.textContent = "🔴";

  for(let i=1;i<=3;i++){
    await wait(400);
    ball.classList.remove("shake");
    void ball.offsetWidth;
    ball.classList.add("shake");
    $("capText").textContent = `Shake ${i}…`;
    await wait(420);
  }
  await wait(200);
  $("capText").textContent = textFn();
  await wait(700);
  showCaptureOverlay(false);
}

// NOTE: this is intentionally a smaller battle UI updater for now.
// Your battle logic still works. We’re fixing your crash first.
export function updateBattleUI(state){
  const enc = state.encounter;
  const me = state.party[activeIndex(state)];

  const wildImg = $("wildSprite");
  const meImg = $("meSprite");

  if(enc){
    wildImg.src = enc.front || enc.art || "";
    wildImg.classList.add("show");
  } else wildImg.classList.remove("show");

  if(me){
    meImg.src = me.back || me.front || me.art || "";
    meImg.classList.add("show");
  } else meImg.classList.remove("show");
}

// ---------- GAME ----------
let state = loadState();
let busy = false;

const RARITIES = [
  { name:"Common",    weight: 70, catchBase: 0.52, reward:[8,14],  lvl:[4,18] },
  { name:"Uncommon",  weight: 20, catchBase: 0.38, reward:[14,22], lvl:[10,26] },
  { name:"Rare",      weight: 8,  catchBase: 0.24, reward:[22,35], lvl:[18,36] },
  { name:"Epic",      weight: 1.7,catchBase: 0.14, reward:[35,55], lvl:[28,48] },
  { name:"Legendary", weight: 0.3,catchBase: 0.08, reward:[55,95], lvl:[40,70] }
];

function rollRarity(){
  const boost = state.items.rarity_booster_uses || 0;
  const mod = boost > 0 ? 1.35 : 1.0;

  const weights = RARITIES.map(r=>{
    const rareBoost = (r.name==="Rare"||r.name==="Epic"||r.name==="Legendary") ? mod : 1.0;
    return r.weight * rareBoost;
  });
  const total = weights.reduce((a,b)=>a+b,0);
  let x = Math.random()*total;
  for(let i=0;i<RARITIES.length;i++){
    x -= weights[i];
    if(x<=0) return RARITIES[i];
  }
  return RARITIES[0];
}

function pickBiasedId(rarityName){
  const ID_MAX = 1025;
  const r = Math.random();
  if(rarityName==="Legendary") return randInt(144, 898);
  if(rarityName==="Epic") return randInt(1, 898);
  if(rarityName==="Rare") return (r<0.6) ? randInt(1, 493) : randInt(494, 898);
  if(rarityName==="Uncommon") return (r<0.75) ? randInt(1, 649) : randInt(650, ID_MAX);
  return randInt(1, ID_MAX);
}

function rarityMult(r){ return ({Common:1.0,Uncommon:1.1,Rare:1.25,Epic:1.45,Legendary:1.7}[r]||1.0); }

function addCaught(mon){
  if(state.party.length < 6) state.party.push(mon);
  else state.pc.push(mon);
}

function save(){
  saveState(state);
  renderAll();
}

function renderAll(){
  renderChips(state);
  renderBallSelect(state);
  renderEncounter(state);
  renderParty(state);
  renderDex(state);
  renderPC(state, { onSendToParty });
  renderShop(state, { onBuyBall, onBuyItem, onUseItemFromShop });
  updateBattleUI(state);
}

async function spawnPokemon(){
  if(busy) return;
  if(!canSpawn(state)) return;

  busy = true;
  state.spawnCooldownUntil = Date.now() + 5000;
  if((state.items.rarity_booster_uses||0) > 0) state.items.rarity_booster_uses--;

  $("encText").textContent = "Spawning…";

  const rarity = rollRarity();
  const id = pickBiasedId(rarity.name);

  try{
    const p = await fetchPokemonById(id);
    state.dexSeen[p.id] = true;

    const lvl = randInt(rarity.lvl[0], rarity.lvl[1]);
    const maxHp = Math.round(clamp(p.base.hp, 35, 140) * rarityMult(rarity.name) * (0.9 + Math.random()*0.2));
    const rewardCoins = randInt(rarity.reward[0], rarity.reward[1]);

    state.encounter = {
      id: p.id,
      name: p.name,
      rarity: rarity.name,
      level: lvl,
      types: p.types,
      status: "none",
      sleepTurns: 0,
      catchBase: rarity.catchBase,
      rewardCoins,
      turns: 0,
      throws: 0,

      maxHp,
      hp: maxHp,
      atk: Math.round(p.base.atk * (0.9 + Math.random()*0.2) * (0.9 + rarityMult(rarity.name)*0.25)),
      def: Math.round(p.base.def * (0.9 + Math.random()*0.2) * (0.9 + rarityMult(rarity.name)*0.25)),
      spd: Math.round(p.base.spd * (0.9 + Math.random()*0.2) * (0.9 + rarityMult(rarity.name)*0.15)),

      art: p.art,
      front: p.front,
      back: p.back,
      moves: p.moves.map(m=>({ ...m, ppLeft: m.pp }))
    };

    $("encText").textContent = `A wild ${state.encounter.name} appeared!`;
    save();
  }catch(e){
    console.error(e);
    $("encText").textContent = "Spawn failed. Try again.";
    state.encounter = null;
    save();
  }finally{
    busy = false;
  }
}

async function throwBall(){
  const enc = state.encounter;
  if(!enc) return;

  const ball = currentBall(state);
  if((state.inventory[ball.key]||0) <= 0){
    $("encText").textContent = `You're out of ${ball.name}.`;
    return save();
  }

  state.inventory[ball.key]--;
  enc.throws = (enc.throws||0) + 1;

  const chance = computeCatchChance(state, ball);
  const roll = Math.random();

  await captureAnimation(()=> (roll < chance ? "Gotcha!" : "Broke free!"));

  if(state.items.catch_spray_active){
    state.items.catch_spray_active = false;
  }

  if(roll < chance){
    state.dexCaught[enc.id] = true;
    state.coins += enc.rewardCoins;
    state.streak += 1;

    const mon = {
      id: enc.id,
      name: enc.name,
      rarity: enc.rarity,
      level: enc.level,
      types: enc.types,
      status: "none",
      sleepTurns: 0,
      maxHp: enc.maxHp,
      hp: enc.maxHp,
      atk: enc.atk,
      def: enc.def,
      spd: enc.spd,
      fainted: false,
      front: enc.front,
      back: enc.back,
      art: enc.art,
      moves: enc.moves.map(m=>({ ...m, ppLeft: m.pp }))
    };

    addCaught(mon);
    $("encText").textContent = `Caught ${enc.name}! +${enc.rewardCoins} coins ✅`;
    state.encounter = null;
    save();
    return;
  }

  $("encText").textContent = `${enc.name} broke free… (${Math.round(chance*100)}% chance)`;
  if(enc.throws >= 5 && Math.random() < 0.18){
    $("encText").textContent = `${enc.name} ran away!`;
    state.encounter = null;
  }
  save();
}

function runFromEncounter(){
  if(state.encounter){
    $("encText").textContent = `${state.encounter.name} ran away.`;
    state.encounter = null;
    save();
  }
}

function heal(){
  if(!canHeal(state)){
    alert(`Heal on cooldown. Wait ${healLeft(state)}s`);
    return;
  }
  healPartyAll(state);
  alert("Party healed ✅ (cooldown 5 min)");
  save();
}

function resetAll(){
  if(!confirm("Reset everything?")) return;
  localStorage.removeItem("pawanmon_save_v4");
  state = loadState();
  renderAll();
}

function onBuyBall(key){
  const b = BALLS.find(x=>x.key===key);
  if(!b) return;
  if(state.coins < b.cost){ alert("Not enough coins"); return; }
  state.coins -= b.cost;
  state.inventory[b.key] = (state.inventory[b.key]||0)+1;
  save();
}

function onBuyItem(key){
  const it = ITEMS.find(x=>x.key===key);
  if(!it) return;
  if(state.coins < it.cost){ alert("Not enough coins"); return; }
  state.coins -= it.cost;
  state.items[it.key] = (state.items[it.key]||0)+1;
  save();
}

function onUseItemFromShop(key){
  if(key==="catch_spray"){
    if((state.items.catch_spray||0) <= 0) return alert("No Catch Spray");
    state.items.catch_spray--;
    state.items.catch_spray_active = true;
    alert("Catch Spray active: +10% next throw");
    return save();
  }
  if(key==="rarity_booster"){
    if((state.items.rarity_booster||0) <= 0) return alert("No Rarity Booster");
    state.items.rarity_booster--;
    state.items.rarity_booster_uses = (state.items.rarity_booster_uses||0) + 5;
    alert("Rarity Booster active: 5 boosted spawns");
    return save();
  }
}

function onSendToParty(i){
  if(state.party.length>=6){ alert("Party full"); return; }
  const mon = state.pc.splice(i,1)[0];
  state.party.push(mon);
  save();
}

// ---------- START ----------
export function start(){
  // tabs
  document.querySelectorAll(".tabbtn[data-tab]").forEach(btn=>{
    btn.addEventListener("click", ()=> setTab(btn.dataset.tab));
  });

  $("spawnBtn").addEventListener("click", spawnPokemon);
  $("throwBtn").addEventListener("click", throwBall);
  $("runBtn").addEventListener("click", runFromEncounter);

  $("healBtn").addEventListener("click", heal);
  $("resetBtn").addEventListener("click", resetAll);

  renderAll();

  // keep cooldown labels updating
  setInterval(()=> renderChips(state), 250);
}
