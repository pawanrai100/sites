// pokeapi.js
import { cap } from "./data.js";

const moveCache = new Map();

export async function fetchMove(moveName){
  if(moveCache.has(moveName)) return moveCache.get(moveName);
  try{
    const res = await fetch(`https://pokeapi.co/api/v2/move/${moveName}`);
    if(!res.ok) throw new Error("move fetch failed");
    const d = await res.json();
    const m = {
      name: cap(d.name.replaceAll("-", " ")),
      power: (typeof d.power === "number" ? d.power : 45),
      accuracy: (typeof d.accuracy === "number" ? d.accuracy : 95),
      pp: (typeof d.pp === "number" ? d.pp : 20),
      type: d.type?.name || "normal"
    };
    moveCache.set(moveName, m);
    return m;
  }catch{
    const m = { name: cap(moveName.replaceAll("-", " ")), power:45, accuracy:95, pp:20, type:"normal" };
    moveCache.set(moveName, m);
    return m;
  }
}

function uniqueSample(arr, n){
  const a = arr.filter(Boolean);
  const out = [];
  const used = new Set();
  for(let i=0;i<a.length && out.length<n;i++){
    const idx = Math.floor(Math.random()*a.length);
    const val = a[idx];
    if(!used.has(val)){ used.add(val); out.push(val); }
  }
  for(const v of a){
    if(out.length>=n) break;
    if(!used.has(v)){ used.add(v); out.push(v); }
  }
  return out.slice(0,n);
}

export async function fetchPokemonById(id){
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if(!res.ok) throw new Error("PokeAPI pokemon failed");
  const data = await res.json();

  const art =
    data.sprites?.other?.["official-artwork"]?.front_default ||
    data.sprites?.other?.home?.front_default ||
    data.sprites?.front_default ||
    "";

  const front =
    data.sprites?.front_default ||
    data.sprites?.other?.home?.front_default ||
    art ||
    "";

  const back =
    data.sprites?.back_default ||
    data.sprites?.back_shiny ||
    data.sprites?.other?.home?.front_default ||
    front ||
    art ||
    "";

  const types = (data.types||[]).map(t=>t.type?.name).filter(Boolean);

  const hpStat  = data.stats?.find(s=>s.stat.name==="hp")?.base_stat || 55;
  const atkStat = data.stats?.find(s=>s.stat.name==="attack")?.base_stat || 60;
  const defStat = data.stats?.find(s=>s.stat.name==="defense")?.base_stat || 55;
  const spdStat = data.stats?.find(s=>s.stat.name==="speed")?.base_stat || 55;

  const moveCandidates = data.moves.map(m=>{
    const details = m.version_group_details || [];
    let minLvl = null;
    for(const d of details){
      if(d.move_learn_method?.name === "level-up"){
        if(minLvl===null || d.level_learned_at < minLvl) minLvl = d.level_learned_at;
      }
    }
    return { name: m.move.name, minLvl };
  });

  const lvlMoves = moveCandidates
    .filter(x=>x.minLvl!==null)
    .sort((a,b)=>a.minLvl-b.minLvl)
    .slice(0, 30);

  const pool = (lvlMoves.length >= 8 ? lvlMoves : moveCandidates.slice(0, 60));
  const chosenNames = uniqueSample(pool.map(x=>x.name), 4);

  const moves = [];
  for(const nm of chosenNames){
    const m = await fetchMove(nm);
    moves.push(m);
  }
  if(moves.length===0){
    moves.push({ name:"Tackle", power:40, accuracy:100, pp:35, type:"normal" });
  }

  return {
    id: data.id,
    name: cap(data.name),
    art,
    front,
    back,
    types,
    base: { hp: hpStat, atk: atkStat, def: defStat, spd: spdStat },
    moves
  };
}
