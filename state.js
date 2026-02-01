// state.js
import { now, clamp } from "./data.js";

const SKEY = "pawanmon_save_v4";

export const defaultState = {
  coins: 50,
  streak: 0,

  inventory: { poke_ball: 8 },
  items: {
    potion: 3,
    super_potion: 0,
    revive: 0,
    full_heal: 0,
    catch_spray: 0,
    rarity_booster: 0,
    rarity_booster_uses: 0,
    catch_spray_active: false
  },

  party: [],
  pc: [],

  dexSeen: {},
  dexCaught: {},

  healCooldownUntil: 0,
  spawnCooldownUntil: 0,

  encounter: null,
  activePartyIndex: 0,
};

export function loadState(){
  try{
    const raw = localStorage.getItem(SKEY);
    if(!raw) return structuredClone(defaultState);
    const s = JSON.parse(raw);
    return deepMerge(structuredClone(defaultState), s);
  }catch{
    return structuredClone(defaultState);
  }
}

export function saveState(state){
  localStorage.setItem(SKEY, JSON.stringify(state));
}

function deepMerge(a,b){
  for(const k in b){
    if(b[k] && typeof b[k]==="object" && !Array.isArray(b[k])){
      a[k] = deepMerge(a[k]||{}, b[k]);
    } else a[k] = b[k];
  }
  return a;
}

export function canSpawn(state){ return now() >= (state.spawnCooldownUntil||0); }
export function spawnLeft(state){ return Math.max(0, Math.ceil(((state.spawnCooldownUntil||0) - now())/1000)); }

export function canHeal(state){ return now() >= (state.healCooldownUntil||0); }
export function healLeft(state){ return Math.max(0, Math.ceil(((state.healCooldownUntil||0) - now())/1000)); }

export function activeIndex(state){
  return clamp(state.activePartyIndex||0, 0, Math.max(0, state.party.length-1));
}
export function firstNonFaintedIndex(state){
  for(let i=0;i<state.party.length;i++){
    if(!state.party[i].fainted) return i;
  }
  return -1;
}

export function ballCount(state){
  let c=0;
  for(const k in state.inventory) c += state.inventory[k]||0;
  return c;
}
