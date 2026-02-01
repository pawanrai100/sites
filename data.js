// data.js
export const now = () => Date.now();
export const clamp = (x,a,b) => Math.max(a, Math.min(b, x));
export const randInt = (a,b) => Math.floor(a + Math.random()*(b-a+1));
export const pick = (arr) => arr[Math.floor(Math.random()*arr.length)];
export const cap = (s) => s ? s[0].toUpperCase()+s.slice(1) : s;

export const TYPE_ICON = {
  normal:"⚪", fire:"🔥", water:"💧", grass:"🍃", electric:"⚡", ice:"🧊",
  fighting:"🥊", poison:"☠️", ground:"⛰️", flying:"🕊️", psychic:"🔮",
  bug:"🐛", rock:"🪨", ghost:"👻", dragon:"🐉", dark:"🌑", steel:"⚙️", fairy:"✨"
};

export const TYPE_CHART = {
  normal:   { rock:0.5, ghost:0, steel:0.5 },
  fire:     { fire:0.5, water:0.5, grass:2, ice:2, bug:2, rock:0.5, dragon:0.5, steel:2 },
  water:    { fire:2, water:0.5, grass:0.5, ground:2, rock:2, dragon:0.5 },
  electric: { water:2, electric:0.5, grass:0.5, ground:0, flying:2, dragon:0.5 },
  grass:    { fire:0.5, water:2, grass:0.5, poison:0.5, ground:2, flying:0.5, bug:0.5, rock:2, dragon:0.5, steel:0.5 },
  ice:      { fire:0.5, water:0.5, grass:2, ground:2, flying:2, dragon:2, steel:0.5, ice:0.5 },
  fighting: { normal:2, ice:2, rock:2, dark:2, steel:2, poison:0.5, flying:0.5, psychic:0.5, bug:0.5, ghost:0, fairy:0.5 },
  poison:   { grass:2, fairy:2, poison:0.5, ground:0.5, rock:0.5, ghost:0.5, steel:0 },
  ground:   { fire:2, electric:2, grass:0.5, poison:2, flying:0, bug:0.5, rock:2, steel:2 },
  flying:   { grass:2, fighting:2, bug:2, electric:0.5, rock:0.5, steel:0.5 },
  psychic:  { fighting:2, poison:2, psychic:0.5, steel:0.5, dark:0 },
  bug:      { grass:2, psychic:2, dark:2, fire:0.5, fighting:0.5, poison:0.5, flying:0.5, ghost:0.5, steel:0.5, fairy:0.5 },
  rock:     { fire:2, ice:2, flying:2, bug:2, fighting:0.5, ground:0.5, steel:0.5 },
  ghost:    { psychic:2, ghost:2, dark:0.5, normal:0 },
  dragon:   { dragon:2, steel:0.5, fairy:0 },
  dark:     { psychic:2, ghost:2, fighting:0.5, dark:0.5, fairy:0.5 },
  steel:    { ice:2, rock:2, fairy:2, fire:0.5, water:0.5, electric:0.5, steel:0.5 },
  fairy:    { fighting:2, dragon:2, dark:2, fire:0.5, poison:0.5, steel:0.5 }
};

export function typeMultiplier(moveType, defenderTypes){
  const table = TYPE_CHART[moveType] || {};
  let mult = 1;
  for(const t of defenderTypes || []){
    mult *= (t in table) ? table[t] : 1;
  }
  return mult;
}
export function effText(mult){
  if(mult === 0) return "It had no effect!";
  if(mult >= 2) return "It’s super effective!";
  if(mult < 1) return "It’s not very effective…";
  return "";
}

export const BALLS = [
  { key:"poke_ball",   name:"Poké Ball",   cost:8,  mult:1.00, note:"Standard catch." },
  { key:"great_ball",  name:"Great Ball",  cost:18, mult:1.20, note:"Better catch." },
  { key:"ultra_ball",  name:"Ultra Ball",  cost:32, mult:1.45, note:"High catch." },
  { key:"master_ball", name:"Master Ball", cost:250,mult:999,  note:"100% catch." },

  { key:"premier_ball",name:"Premier Ball",cost:10, mult:1.00, note:"Style catch." },
  { key:"heal_ball",   name:"Heal Ball",   cost:26, mult:1.05, note:"Heals on catch." },
  { key:"repeat_ball", name:"Repeat Ball", cost:20, mult:1.25, note:"Boost if already caught." },
  { key:"timer_ball",  name:"Timer Ball",  cost:20, mult:1.15, note:"Boost after turns." },
  { key:"quick_ball",  name:"Quick Ball",  cost:24, mult:1.30, note:"Boost first throw." },
];

export const ITEMS = [
  { key:"potion",       name:"Potion", cost:20, note:"Heal 20 HP in battle" },
  { key:"super_potion", name:"Super Potion", cost:45, note:"Heal 50 HP in battle" },
  { key:"revive",       name:"Revive", cost:60, note:"Revive to 50% HP" },
  { key:"full_heal",    name:"Full Heal", cost:40, note:"Cure status" },
  { key:"catch_spray",  name:"Catch Spray", cost:35, note:"+10% next throw" },
  { key:"rarity_booster",name:"Rarity Booster", cost:45, note:"Boost rare spawns (5 spawns)" },
];

export const STATUS = {
  none: { name:"", short:"" },
  burn: { name:"Burn", short:"BRN" },
  poison:{ name:"Poison", short:"PSN" },
  paralyze:{ name:"Paralysis", short:"PAR" },
  sleep:{ name:"Sleep", short:"SLP" },
  freeze:{ name:"Freeze", short:"FRZ" },
};

// Status catch bonus multipliers
export function statusCatchBonus(status){
  if(status==="sleep" || status==="freeze") return 1.25;
  if(status==="paralyze" || status==="burn" || status==="poison") return 1.12;
  return 1.0;
}
