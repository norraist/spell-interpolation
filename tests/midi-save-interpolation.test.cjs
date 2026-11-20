const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
function load(){
 const hooks=new Map(),moduleEntry={active:true};
 const context={Set,Map,WeakSet,WeakMap,Color:class Color{},CONFIG:{DND5E:{damageTypes:{}}},game:{modules:{get:()=>moduleEntry},settings:{register(){},get:(_,key)=>key==='enableDamageInterpolation'}},Hooks:{once:(name,fn)=>hooks.set(name,fn),on:(name,fn)=>hooks.set(name,fn)},console:{log(){},warn(){},error:err=>{throw err}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(process.env.INTERPOLATION_SOURCE??__dirname+'/../scripts/spell-interpolation.mjs','utf8'),context);hooks.get('init')();hooks.get('ready')();return{api:moduleEntry.api,hook:hooks.get('midi-qol.preTargetDamageApplication')};
}
const actorFor=traits=>({system:{traits:Object.fromEntries(['di','dr','dv'].map(k=>[k,{value:traits[k]?.value??traits[k]??[]}]))}});
function apply(hook,type,traits,base=100,save=1,temp=0){
 const detail={type,value:base*save},item={oldHP:1000,oldTempHP:temp,damageDetail:[detail],rawDamageDetail:[{type,value:base}],saveMultiplier:save};
 hook({actor:actorFor(traits)},{damageItem:item});return item;
}
test('All Damage traits apply to every custom type, including its neutral component',()=>{
 const {api,hook}=load();for(const type of Object.keys(api.customDamageTypes))for(const[trait,factor]of [['dr',0.5],['di',0],['dv',2]]){
  const traits={[trait]:{value:new Set(['ALL'])}};assert.equal(api.getInterpolatedDamageFactorForTraits(traits,type),factor,type+' '+trait);
  const item=apply(hook,type,traits);assert.equal(item.totalDamage,100*factor,type+' '+trait+' applied');assert.equal(item.newHP,1000-100*factor);
 }
});
test('Global traits combine with parent traits without hiding or double-applying them',()=>{
 const{api}=load();const cases=[
  [{dr:['ALL'],di:['cold']},0.25], [{dv:['ALL'],di:['cold']},1],
  [{dr:['ALL','cold']},0.5], [{dr:['ALL'],dv:['cold']},0.75],
  [{dr:['void'],dv:['ALL'],di:['cold']},1], [{dv:['void'],dr:['ALL']},1],
  [{di:['ALL'],dv:['void']},0], [{di:['void'],dv:['ALL']},0],
  [{dr:['void'],di:['cold','necrotic']},0.5], [{di:['cold'],dv:['necrotic']},1]
 ];for(const[traits,expected]of cases)assert.equal(api.getInterpolatedDamageFactorForTraits(traits,'void'),expected,JSON.stringify(traits));
});
test('Percentage interpolation rounds down once without a floating-point extra point',()=>{
 const{hook}=load();for(const[type,parent]of [['venom','piercing'],['vitriol','poison'],['synaptic','psychic']]){
  assert.equal(apply(hook,type,{di:[parent]}).totalDamage,33,type);
  assert.equal(apply(hook,type,{di:[parent]},200,0.5).totalDamage,33,type+' save');
  assert.equal(apply(hook,type,{di:[parent]},101).totalDamage,33,type+' true fraction');
 }
 assert.equal(apply(hook,'frost',{di:['cold']},300).totalDamage,207,'another exact boundary');
});
test('Mixed damage, temp HP, saves, standard types, and duplicate hook delivery remain stable',()=>{
 const{hook}=load(),traits={dr:['cold']};
 const first={type:'void',value:20},standard={type:'fire',value:10};
 const item={oldHP:100,oldTempHP:7,damageDetail:[first,standard],rawDamageDetail:[{type:'void',value:20},{type:'fire',value:10}]};
 const target={actor:actorFor(traits)};hook(target,{damageItem:item});assert.equal(item.totalDamage,25);assert.equal(item.tempDamage,7);assert.equal(item.newHP,82);assert.equal(item.newTempHP,0);assert.equal(standard.value,10);
 hook(target,{damageItem:item});assert.equal(item.totalDamage,25);assert.equal(item.newHP,82);
 assert.equal(apply(hook,'void',traits,20,0.5).totalDamage,7);
 assert.equal(apply(hook,'void',traits,20,0).totalDamage,0);
});
test('All 18 blends match an independent integer-percentage reference',()=>{
 const{api,hook}=load();for(const[type,{from,to,f}]of Object.entries(api.damageTypeInterpolations)){
  const percent=Math.round(f*100);
  for(const base of [1,3,20,99,100,101,200,300,999,1000])for(const save of [0,0.25,0.5,1])for(const[trait,factor]of [['dr',0.5],['di',0],['dv',2]]){
   const traits={[trait]:[to]},expected=Math.floor(base*save*((100-percent)+percent*factor)/100);
   assert.equal(apply(hook,type,traits,base,save).totalDamage,expected,JSON.stringify({type,base,save,trait}));
   if(from){const expectedFrom=Math.floor(base*save*((100-percent)*factor+percent)/100);assert.equal(apply(hook,type,{[trait]:[from]},base,save).totalDamage,expectedFrom,JSON.stringify({type,base,save,trait,parent:'from'}));}
  }
 }
});

test('Midi on-save multipliers apply only to targets which saved, including Evasion',()=>{
 const {api,hook}=load();
 for(const type of Object.keys(api.damageTypeInterpolations))for(const onSave of [0,0.5,1])for(const saved of [false,true]){
  const detail={type,value:saved?100*onSave:100};
  const item={oldHP:1000,oldTempHP:0,damageDetail:[detail],rawDamageDetail:[{type,value:100}],calcDamageOptions:{midi:{saved,saveMultiplier:onSave}}};
  hook({actor:actorFor({})},{damageItem:item});assert.equal(item.totalDamage,saved?100*onSave:100,JSON.stringify({type,onSave,saved}));
 }
 for(const[superSaver,semiSuperSaver,saved,expected]of [[true,false,false,50],[true,false,true,0],[false,true,false,100],[false,true,true,0]]){
  const item={oldHP:1000,oldTempHP:0,damageDetail:[{type:'void',value:expected}],rawDamageDetail:[{type:'void',value:100}],calcDamageOptions:{midi:{saved,saveMultiplier:0.5,superSaver,semiSuperSaver}}};
  hook({actor:actorFor({})},{damageItem:item});assert.equal(item.totalDamage,expected);
 }
 const item={oldHP:1000,oldTempHP:0,damageDetail:[{type:'void',value:0}],rawDamageDetail:[{type:'void',value:100,midiSaveMultiplier:0}],calcDamageOptions:{midi:{saved:true,saveMultiplier:0.5}}};
 hook({actor:actorFor({})},{damageItem:item});assert.equal(item.totalDamage,0,'per-damage save rule wins');
});
