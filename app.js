/* Budget Familial V11.0 - application complète et autonome */
const KEY='budgetFamilialV100';
const OLD_KEYS=['budgetFamilialV90','budgetFamilialV80','budgetFamilialV70','budgetFamilialV53','budgetFamilialV52','budgetFamilialV50','budgetFamilialV43','budgetFamilialV42'];
const uid=()=>crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const today=()=>new Date().toISOString().slice(0,10);
const monthNow=()=>today().slice(0,7);
const defaults={theme:'light',month:monthNow(),categories:['Courses','Carburant','Santé','Logement','Téléphone','Assurances','Loisirs','Enfants','Animaux','Autre'],accounts:[{id:uid(),name:'Compte principal',type:'Compte courant',opening:0,icon:'🏦',color:'#6356c7',main:true}],transactions:[],budgets:[{id:uid(),name:'Courses',limit:700,icon:'🛒'},{id:uid(),name:'Carburant',limit:250,icon:'⛽'},{id:uid(),name:'Santé',limit:200,icon:'🩺'}],charges:[],recurringIncomes:[]};
let state=load();
let modalSubmit=null;

function clone(v){return JSON.parse(JSON.stringify(v))}
function load(){
  try{
    let raw=localStorage.getItem(KEY);
    if(!raw) for(const k of OLD_KEYS){raw=localStorage.getItem(k);if(raw)break}
    const old=raw?JSON.parse(raw):{};
    const data={...clone(defaults),...old};
    data.categories=[...new Set([...(old.categories||[]),...defaults.categories])];
    data.accounts=(data.accounts||[]).map((a,i)=>({...a,opening:Number(a.opening)||0,icon:a.icon||'🏦',color:a.color||['#6356c7','#168865','#cb8239','#4b83d1'][i%4],main:a.main??i===0}));
    if(!data.accounts.length)data.accounts=clone(defaults.accounts);
    if(!data.accounts.some(a=>a.main))data.accounts[0].main=true;
    data.transactions=(data.transactions||[]).map(t=>({...t,amount:Number(t.amount)||0,date:t.date||today(),category:t.category||'Autre'}));
    data.budgets=(data.budgets||[]).map(b=>({...b,limit:Number(b.limit)||0,icon:b.icon||'🎯'}));
    data.charges=(data.charges||[]).map(c=>({...c,amount:Number(c.amount)||0,day:Math.min(28,Math.max(1,Number(c.day)||1)),paidMonths:c.paidMonths||[],accountId:c.accountId||data.accounts[0].id}));
    data.recurringIncomes=(data.recurringIncomes||[]).map(r=>({...r,amount:Number(r.amount)||0,day:Math.min(28,Math.max(1,Number(r.day)||1)),postedMonths:r.postedMonths||[],accountId:r.accountId||data.accounts[0].id,category:r.category||'Revenus'}));
    localStorage.setItem(KEY,JSON.stringify(data));
    return data;
  }catch(e){console.error(e);return clone(defaults)}
}
function save(){localStorage.setItem(KEY,JSON.stringify(state));render()}
const euro=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const monthName=m=>new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(new Date(m+'-01T12:00:00'));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const account=id=>state.accounts.find(a=>a.id===id);
const monthTx=()=>state.transactions.filter(t=>t.date.startsWith(state.month));
const accountBalance=a=>a.opening+state.transactions.filter(t=>t.accountId===a.id).reduce((s,t)=>s+(t.type==='income'?t.amount:-t.amount),0);
const expenses=()=>monthTx().filter(t=>t.type==='expense');
const incomes=()=>monthTx().filter(t=>t.type==='income');
function toast(msg){const e=document.querySelector('#toast');e.textContent=msg;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}
function empty(msg){return `<div class="empty">${esc(msg)}</div>`}

function setPage(page){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.dataset.page===page));document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===page));window.scrollTo({top:0,behavior:'smooth'})}
function shiftMonth(delta){const d=new Date(state.month+'-01T12:00:00');d.setMonth(d.getMonth()+delta);state.month=d.toISOString().slice(0,7);save()}

function render(){
  document.documentElement.classList.toggle('dark',state.theme==='dark');
  document.querySelector('#themeBtn').textContent=state.theme==='dark'?'🌙':'☀️';
  document.querySelector('#monthLabel').textContent=monthName(state.month);
  renderHome();renderAccounts();renderTransactions();renderBudget();renderRecurringIncomes();renderCalendar();renderFilters();renderMonthlyChart();
}
function renderHome(){
  const inc=incomes().reduce((s,t)=>s+t.amount,0),exp=expenses().reduce((s,t)=>s+t.amount,0);
  const unpaid=state.charges.filter(c=>!c.paidMonths.includes(state.month)).reduce((s,c)=>s+c.amount,0);
  const balance=state.accounts.reduce((s,a)=>s+accountBalance(a),0);
  document.querySelector('#globalBalance').textContent=euro(balance);
  document.querySelector('#incomeTotal').textContent=euro(inc);
  document.querySelector('#expenseTotal').textContent=euro(exp);
  document.querySelector('#remainingTotal').textContent=euro(inc-exp-unpaid);
  document.querySelector('#plannedTotal').textContent=euro(unpaid);
  document.querySelector('#homeAccounts').innerHTML=state.accounts.slice(0,4).map(accountCard).join('')||empty('Aucun compte');
  document.querySelector('#recentTransactions').innerHTML=[...monthTx()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(txCard).join('')||empty('Aucune opération ce mois-ci');
  renderUpcoming();
  renderAssistant(inc,exp,unpaid,balance);
}

function renderUpcoming(){
  const target=document.querySelector('#upcomingItems');if(!target)return;
  const items=[];
  const maxDay=daysInMonth(state.month);
  state.charges.filter(c=>!c.paidMonths.includes(state.month)).forEach(c=>items.push({day:Math.min(c.day,maxDay),name:c.name,amount:c.amount,kind:'expense'}));
  state.recurringIncomes.filter(r=>!r.postedMonths.includes(state.month)).forEach(r=>items.push({day:Math.min(r.day,maxDay),name:r.name,amount:r.amount,kind:'income'}));
  items.sort((a,b)=>a.day-b.day);
  target.innerHTML=items.slice(0,4).map(i=>`<article class="charge-card"><div class="day-box">${String(i.day).padStart(2,'0')}</div><div class="grow"><div class="title">${esc(i.name)}</div><div class="sub">${i.kind==='income'?'Recette attendue':'Échéance à payer'} · ${monthName(state.month)}</div></div><div class="amount ${i.kind==='income'?'positive':'negative'}">${i.kind==='income'?'+':'−'}${euro(i.amount)}</div></article>`).join('')||empty('Aucune échéance restante ce mois-ci');
}

function renderAssistant(inc,exp,unpaid,balance){
  const msgs=[];const remaining=inc-exp-unpaid;const now=new Date();const days=Math.max(1,new Date(now.getFullYear(),now.getMonth()+1,0).getDate()-now.getDate()+1);
  if(balance<0)msgs.push({c:'danger',t:`Votre solde global est négatif de ${euro(Math.abs(balance))}.`});
  else msgs.push({c:'good',t:`Votre solde global est de ${euro(balance)}.`});
  if(inc||exp)msgs.push({c:remaining<0?'danger':'',t:`Après les charges restant à payer, il vous reste ${euro(remaining)}, soit environ ${euro(Math.max(0,remaining)/days)} par jour.`});
  const late=state.charges.filter(c=>!c.paidMonths.includes(state.month)&&Number(c.day)<new Date().getDate()&&state.month===monthNow());
  if(late.length)msgs.push({c:'danger',t:`${late.length} charge${late.length>1?'s sont':' est'} en retard.`});
  const near=state.charges.filter(c=>!c.paidMonths.includes(state.month)&&Number(c.day)>=new Date().getDate()&&Number(c.day)<=new Date().getDate()+5&&state.month===monthNow());
  if(near.length)msgs.push({c:'warning',t:`Prochaine échéance : ${near[0].name} (${euro(near[0].amount)}) dans les prochains jours.`});
  const cats=categoryTotals();const worst=state.budgets.map(b=>({b,spent:cats[b.name]||0})).sort((x,y)=>(y.spent/y.b.limit)-(x.spent/x.b.limit))[0];
  if(worst&&worst.b.limit>0){const pct=Math.round(worst.spent/worst.b.limit*100);if(pct>=100)msgs.push({c:'danger',t:`Le budget ${worst.b.name} est dépassé (${pct} %).`});else if(pct>=80)msgs.push({c:'warning',t:`Le budget ${worst.b.name} est déjà utilisé à ${pct} %.`})}
  if(!msgs.length)msgs.push({c:'good',t:'Tout est calme pour ce mois. Commencez par ajouter vos recettes et dépenses.'});
  document.querySelector('#assistantMessages').innerHTML=msgs.map(m=>`<div class="assistant-msg ${m.c}">${esc(m.t)}</div>`).join('');
}
function accountCard(a){
  const bal=accountBalance(a);const count=state.transactions.filter(t=>t.accountId===a.id).length;
  return `<article class="account-card account-clickable" data-action="account-detail" data-id="${a.id}"><div class="account-icon" style="background:${esc(a.color)}22;color:${esc(a.color)}">${esc(a.icon)}</div><div class="grow"><div class="title">${esc(a.name)}${a.main?'<span class="main-pill">Principal</span>':''}</div><div class="sub">${esc(a.type)} · ${count} opération${count>1?'s':''}</div></div><div><div class="amount ${bal<0?'negative':''}">${euro(bal)}</div><div class="actions"><button class="mini" data-action="account-edit" data-id="${a.id}">✏️</button><button class="mini" data-action="account-delete" data-id="${a.id}">🗑️</button></div></div></article>`
}
function renderAccounts(){document.querySelector('#accountsList').innerHTML=state.accounts.map(accountCard).join('')||empty('Aucun compte')}
function txCard(t){const a=account(t.accountId);return `<article class="tx-card"><div class="tx-icon">${t.type==='income'?'↗️':'↘️'}</div><div class="grow"><div class="title">${esc(t.label)}</div><div class="sub">${esc(t.date)} · ${esc(t.category)} · ${esc(a?.name||'Compte supprimé')}</div></div><div><div class="amount ${t.type==='income'?'positive':'negative'}">${t.type==='income'?'+':'−'}${euro(t.amount)}</div><div class="actions"><button class="mini" data-action="tx-duplicate" data-id="${t.id}">⧉</button><button class="mini" data-action="tx-edit" data-id="${t.id}">✏️</button><button class="mini" data-action="tx-delete" data-id="${t.id}">🗑️</button></div></div></article>`}
function renderTransactions(){
  let list=[...state.transactions];const q=document.querySelector('#searchInput')?.value.toLowerCase()||'';const type=document.querySelector('#typeFilter')?.value||'all';const aid=document.querySelector('#accountFilter')?.value||'all';const cat=document.querySelector('#categoryFilter')?.value||'all';const from=document.querySelector('#dateFromFilter')?.value||'';const to=document.querySelector('#dateToFilter')?.value||'';const sort=document.querySelector('#sortFilter')?.value||'date-desc';
  list=list.filter(t=>(!q||`${t.label} ${t.category} ${t.amount} ${account(t.accountId)?.name||''}`.toLowerCase().includes(q))&&(type==='all'||t.type===type)&&(aid==='all'||t.accountId===aid)&&(cat==='all'||t.category===cat)&&(!from||t.date>=from)&&(!to||t.date<=to));
  list.sort((a,b)=>sort==='date-asc'?a.date.localeCompare(b.date):sort==='amount-desc'?b.amount-a.amount:sort==='amount-asc'?a.amount-b.amount:b.date.localeCompare(a.date));
  document.querySelector('#transactionsList').innerHTML=list.map(txCard).join('')||empty('Aucune opération trouvée');
}
function renderFilters(){
  const sel=document.querySelector('#accountFilter'),v=sel.value;sel.innerHTML='<option value="all">Tous les comptes</option>'+state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');sel.value=[...sel.options].some(o=>o.value===v)?v:'all';
  const cat=document.querySelector('#categoryFilter'),cv=cat.value;cat.innerHTML='<option value="all">Toutes les catégories</option>'+state.categories.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');cat.value=[...cat.options].some(o=>o.value===cv)?cv:'all';
}
function categoryTotals(){return expenses().reduce((o,t)=>(o[t.category]=(o[t.category]||0)+t.amount,o),{})}
function renderBudget(){
  const cats=categoryTotals();document.querySelector('#budgetTotal').textContent=euro(state.budgets.reduce((s,b)=>s+b.limit,0));
  document.querySelector('#budgetList').innerHTML=state.budgets.map(b=>{const spent=cats[b.name]||0,pct=b.limit?Math.round(spent/b.limit*100):0;return `<article class="budget-card"><div class="budget-top"><div class="tx-icon">${esc(b.icon)}</div><div class="grow"><div class="title">${esc(b.name)}</div><div class="sub">${euro(spent)} sur ${euro(b.limit)} · ${pct}%</div></div><div class="actions"><button class="mini" data-action="budget-edit" data-id="${b.id}">✏️</button><button class="mini" data-action="budget-delete" data-id="${b.id}">🗑️</button></div></div><div class="progress"><i class="${pct>100?'over':''}" style="width:${Math.min(100,pct)}%"></i></div></article>`}).join('')||empty('Aucun budget défini');
  document.querySelector('#chargesList').innerHTML=state.charges.sort((a,b)=>a.day-b.day).map(c=>{const paid=c.paidMonths.includes(state.month);const late=!paid&&state.month===monthNow()&&c.day<new Date().getDate();return `<article class="charge-card"><div class="day-box">${c.day}</div><div class="grow"><div class="title">${esc(c.name)} <span class="status ${paid?'done':late?'late':''}">${paid?'Payée':late?'En retard':'À payer'}</span></div><div class="sub">${esc(account(c.accountId)?.name||'Compte')} · chaque mois</div></div><div><div class="amount">${euro(c.amount)}</div><div class="actions"><button class="mini" data-action="charge-toggle" data-id="${c.id}">${paid?'↩️':'✅'}</button><button class="mini" data-action="charge-edit" data-id="${c.id}">✏️</button><button class="mini" data-action="charge-delete" data-id="${c.id}">🗑️</button></div></div></article>`}).join('')||empty('Aucune charge fixe');
  const rows=Object.entries(cats).sort((a,b)=>b[1]-a[1]);const total=rows.reduce((s,r)=>s+r[1],0);document.querySelector('#categoryStats').innerHTML=rows.map(([n,v])=>`<div class="stat-row"><div class="grow"><div class="title">${esc(n)}</div><div class="sub">${total?Math.round(v/total*100):0}% des dépenses</div></div><div class="amount negative">${euro(v)}</div></div>`).join('')||empty('Aucune dépense ce mois-ci');
}


function monthOffset(base,delta){const d=new Date(base+'-01T12:00:00');d.setMonth(d.getMonth()+delta);return d.toISOString().slice(0,7)}
function renderMonthlyChart(){
  const el=document.querySelector('#monthlyChart');if(!el)return;
  const months=Array.from({length:6},(_,i)=>monthOffset(state.month,i-5));
  const values=months.map(m=>({m,inc:state.transactions.filter(t=>t.type==='income'&&t.date.startsWith(m)).reduce((s,t)=>s+t.amount,0),exp:state.transactions.filter(t=>t.type==='expense'&&t.date.startsWith(m)).reduce((s,t)=>s+t.amount,0)}));
  const max=Math.max(1,...values.flatMap(v=>[v.inc,v.exp]));
  el.innerHTML=`<div class="chart-legend"><span><i class="legend-income"></i>Recettes</span><span><i class="legend-expense"></i>Dépenses</span></div><div class="chart-bars">${values.map(v=>`<div class="chart-month"><div class="bar-pair"><i class="bar income" style="height:${Math.max(3,v.inc/max*100)}%" title="${euro(v.inc)}"></i><i class="bar expense" style="height:${Math.max(3,v.exp/max*100)}%" title="${euro(v.exp)}"></i></div><small>${new Intl.DateTimeFormat('fr-FR',{month:'short'}).format(new Date(v.m+'-01T12:00:00'))}</small></div>`).join('')}</div>`;
}
function accountDetailModal(a){
  const list=state.transactions.filter(t=>t.accountId===a.id).sort((x,y)=>y.date.localeCompare(x.date));
  const inc=list.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),exp=list.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const rows=list.slice(0,12).map(t=>`<div class="detail-tx"><div><b>${esc(t.label)}</b><small>${esc(t.date)} · ${esc(t.category)}</small></div><strong class="${t.type==='income'?'positive':'negative'}">${t.type==='income'?'+':'−'}${euro(t.amount)}</strong></div>`).join('')||empty('Aucune opération');
  openModal(a.name,`<div class="account-detail-summary"><div><span>Solde</span><b>${euro(accountBalance(a))}</b></div><div><span>Recettes</span><b class="positive">${euro(inc)}</b></div><div><span>Dépenses</span><b class="negative">${euro(exp)}</b></div></div><div class="field"><label>Dernières opérations</label><div class="detail-list">${rows}</div></div>`,()=>{closeModal();return false});
  document.querySelector('#modalForm .modal-actions').style.display='none';
}

function renderRecurringIncomes(){
  const el=document.querySelector('#recurringIncomeList');if(!el)return;
  el.innerHTML=state.recurringIncomes.map(r=>{const posted=r.postedMonths.includes(state.month);return `<article class="charge-card"><div class="day-box">${String(r.day).padStart(2,'0')}</div><div class="grow"><div class="title">${esc(r.name)}</div><div class="sub">${esc(account(r.accountId)?.name||'Compte')} · ${esc(r.category)}</div></div><div><div class="amount positive">+${euro(r.amount)}</div><div class="actions"><button class="mini" data-action="income-recurring-toggle" data-id="${r.id}" title="${posted?'Annuler':'Ajouter au mois'}">${posted?'✅':'➕'}</button><button class="mini" data-action="income-recurring-edit" data-id="${r.id}">✏️</button><button class="mini" data-action="income-recurring-delete" data-id="${r.id}">🗑️</button></div></div></article>`}).join('')||empty('Aucune recette récurrente');
}
function daysInMonth(month){const [y,m]=month.split('-').map(Number);return new Date(y,m,0).getDate()}
function calendarItemsForDay(date){
  const tx=state.transactions.filter(t=>t.date===date).map(t=>({kind:t.type,label:t.label,amount:t.amount,id:t.id}));
  const d=Number(date.slice(-2));
  state.charges.filter(c=>c.day===d&&!c.paidMonths.includes(state.month)).forEach(c=>tx.push({kind:'planned-expense',label:c.name,amount:c.amount,id:c.id}));
  state.recurringIncomes.filter(r=>r.day===d&&!r.postedMonths.includes(state.month)).forEach(r=>tx.push({kind:'planned-income',label:r.name,amount:r.amount,id:r.id}));
  return tx;
}
function renderCalendar(){
  const el=document.querySelector('#calendar');if(!el)return;
  const [y,m]=state.month.split('-').map(Number),count=daysInMonth(state.month),first=(new Date(y,m-1,1).getDay()+6)%7;
  let html='<div class="calendar-head">'+['L','M','M','J','V','S','D'].map(d=>`<b>${d}</b>`).join('')+'</div><div class="calendar-grid">';
  html+='<span class="calendar-empty"></span>'.repeat(first);
  for(let day=1;day<=count;day++){
    const date=`${state.month}-${String(day).padStart(2,'0')}`,items=calendarItemsForDay(date);
    const hasInc=items.some(i=>i.kind.includes('income')),hasExp=items.some(i=>i.kind.includes('expense'));
    html+=`<button type="button" class="calendar-day ${date===today()?'today':''}" data-calendar-date="${date}"><span>${day}</span><i>${hasInc?'<em class="dot income"></em>':''}${hasExp?'<em class="dot expense"></em>':''}</i></button>`;
  }
  el.innerHTML=html+'</div>';
  const detail=document.querySelector('#calendarDayDetail');if(detail&&!detail.dataset.date)detail.innerHTML=empty('Touchez un jour pour voir le détail');
}
function showCalendarDay(date){
  const detail=document.querySelector('#calendarDayDetail'),items=calendarItemsForDay(date);detail.dataset.date=date;
  detail.innerHTML=`<div class="section-head calendar-title"><div><small>DÉTAIL</small><h2>${new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(new Date(date+'T12:00:00'))}</h2></div></div>`+(items.map(i=>`<article class="tx-card"><div class="tx-icon">${i.kind.includes('income')?'↗️':'↘️'}</div><div class="grow"><div class="title">${esc(i.label)}</div><div class="sub">${i.kind.startsWith('planned')?'Prévu':'Enregistré'}</div></div><div class="amount ${i.kind.includes('income')?'positive':'negative'}">${i.kind.includes('income')?'+':'−'}${euro(i.amount)}</div></article>`).join('')||empty('Rien de prévu ce jour-là'));
}
function openModal(title,html,onSubmit){document.querySelector('#modalTitle').textContent=title;document.querySelector('#modalBody').innerHTML=html;document.querySelector('#modalForm .modal-actions').style.display='flex';modalSubmit=onSubmit;document.querySelector('#modal').showModal()}
function closeModal(){document.querySelector('#modal').close();modalSubmit=null}
const field=(label,name,type='text',value='',extra='')=>`<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
const selectField=(label,name,options,value)=>`<div class="field"><label>${label}</label><select name="${name}">${options.map(([v,l])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`).join('')}</select></div>`;
const accountOptions=()=>state.accounts.map(a=>[a.id,a.name]);
const categoryOptions=()=>state.categories.map(c=>[c,c]);
function formData(form){return Object.fromEntries(new FormData(form).entries())}

function accountModal(a={}){
  const isEdit=!!a.id;
  const currentBalance=isEdit?accountBalance(a):0;
  const types=[['Compte courant','Compte courant'],['Livret / Épargne','Livret / Épargne'],['Espèces','Espèces'],['Carte prépayée','Carte prépayée'],['Autre','Autre']];
  const icons=[['🏦','🏦 Banque'],['💳','💳 Carte'],['💰','💰 Épargne'],['👛','👛 Espèces'],['🏠','🏠 Maison'],['🚗','🚗 Voiture'],['🎯','🎯 Projet'],['⭐','⭐ Autre']];
  const html=field('Nom du compte','name','text',a.name||'','required placeholder="Ex. Compte courant"')+
    selectField('Type de compte','type',types,a.type||'Compte courant')+
    `<div class="two">${field(isEdit?'Solde actuel souhaité':'Solde de départ','balance','number',isEdit?currentBalance:(a.opening||0),'step="0.01" required')}${selectField('Icône','icon',icons,a.icon||'🏦')}</div>`+
    field('Couleur','color','color',a.color||'#6356c7')+
    `<label class="check"><input name="main" type="checkbox" ${a.main?'checked':''}> Utiliser comme compte principal</label>`+
    `<p class="form-help">${isEdit?'Le solde actuel sera ajusté sans modifier vos opérations déjà enregistrées.':'Vous pourrez modifier ce solde plus tard.'}</p>`;
  openModal(isEdit?'Modifier le compte':'Nouveau compte',html,fd=>{
    const desiredBalance=Number(fd.balance)||0;
    const transactionNet=isEdit?state.transactions.filter(t=>t.accountId===a.id).reduce((sum,t)=>sum+(t.type==='income'?t.amount:-t.amount),0):0;
    if(fd.main)state.accounts.forEach(x=>x.main=false);
    const obj={...a,id:a.id||uid(),name:fd.name.trim(),type:fd.type,opening:desiredBalance-transactionNet,icon:fd.icon||'🏦',color:fd.color||'#6356c7',main:!!fd.main};
    if(!a.id)state.accounts.push(obj);else Object.assign(state.accounts.find(x=>x.id===a.id),obj);
    if(!state.accounts.some(x=>x.main))state.accounts[0].main=true;
    save();toast(isEdit?'Compte modifié':'Compte créé');
  })
}
function txModal(t={}){openModal(t.id?'Modifier l’opération':'Nouvelle opération',selectField('Type','type',[['expense','Dépense'],['income','Recette']],t.type||'expense')+field('Libellé','label','text',t.label||'','required')+`<div class="two">${field('Montant','amount','number',t.amount||'','step="0.01" min="0" required')}${field('Date','date','date',t.date||today(),'required')}</div>`+selectField('Compte','accountId',accountOptions(),t.accountId||state.accounts.find(a=>a.main)?.id||state.accounts[0].id)+selectField('Catégorie','category',categoryOptions(),t.category||state.categories[0]),fd=>{const obj={...t,id:t.id||uid(),type:fd.type,label:fd.label.trim(),amount:Number(fd.amount),date:fd.date,accountId:fd.accountId,category:fd.category};if(!t.id)state.transactions.push(obj);else Object.assign(state.transactions.find(x=>x.id===t.id),obj);save();toast('Opération enregistrée')})}
function transferModal(){openModal('Nouveau virement',selectField('Depuis','from',accountOptions(),state.accounts[0]?.id)+selectField('Vers','to',accountOptions(),state.accounts[1]?.id||state.accounts[0]?.id)+field('Montant','amount','number','','step="0.01" min="0" required')+field('Date','date','date',today(),'required')+field('Libellé','label','text','Virement'),fd=>{if(fd.from===fd.to){alert('Choisissez deux comptes différents');return false}const id=uid(),amount=Number(fd.amount);state.transactions.push({id:uid(),type:'expense',label:fd.label,amount,date:fd.date,accountId:fd.from,category:'Virement',transferId:id},{id:uid(),type:'income',label:fd.label,amount,date:fd.date,accountId:fd.to,category:'Virement',transferId:id});save();toast('Virement enregistré')})}
function budgetModal(b={}){openModal(b.id?'Modifier le budget':'Nouveau budget',selectField('Catégorie','name',categoryOptions(),b.name||state.categories[0])+`<div class="two">${field('Montant maximum','limit','number',b.limit||'','step="0.01" min="0" required')}${field('Icône','icon','text',b.icon||'🎯','maxlength="3"')}</div>`,fd=>{const obj={...b,id:b.id||uid(),name:fd.name,limit:Number(fd.limit),icon:fd.icon||'🎯'};if(!b.id)state.budgets.push(obj);else Object.assign(state.budgets.find(x=>x.id===b.id),obj);save();toast('Budget enregistré')})}
function chargeModal(c={}){openModal(c.id?'Modifier la charge':'Nouvelle charge',field('Nom','name','text',c.name||'','required')+`<div class="two">${field('Montant','amount','number',c.amount||'','step="0.01" min="0" required')}${field('Jour du mois','day','number',c.day||1,'min="1" max="28" required')}</div>`+selectField('Compte débité','accountId',accountOptions(),c.accountId||state.accounts[0]?.id),fd=>{const obj={...c,id:c.id||uid(),name:fd.name.trim(),amount:Number(fd.amount),day:Number(fd.day),accountId:fd.accountId,paidMonths:c.paidMonths||[]};if(!c.id)state.charges.push(obj);else Object.assign(state.charges.find(x=>x.id===c.id),obj);save();toast('Charge enregistrée')})}
function recurringIncomeModal(r={}){openModal(r.id?'Modifier la recette récurrente':'Nouvelle recette récurrente',field('Nom','name','text',r.name||'','required')+`<div class="two">${field('Montant','amount','number',r.amount||'','step="0.01" min="0" required')}${field('Jour du mois','day','number',r.day||1,'min="1" max="28" required')}</div>`+selectField('Compte crédité','accountId',accountOptions(),r.accountId||state.accounts.find(a=>a.main)?.id||state.accounts[0]?.id)+selectField('Catégorie','category',categoryOptions(),r.category||state.categories[0]),fd=>{const obj={...r,id:r.id||uid(),name:fd.name.trim(),amount:Number(fd.amount),day:Number(fd.day),accountId:fd.accountId,category:fd.category,postedMonths:r.postedMonths||[]};if(!r.id)state.recurringIncomes.push(obj);else Object.assign(state.recurringIncomes.find(x=>x.id===r.id),obj);save();toast('Recette récurrente enregistrée')})}
function categoriesModal(){openModal('Mes catégories',field('Nouvelle catégorie','newCategory','text','')+`<div class="field"><label>Catégories actuelles</label><div class="stack">${state.categories.map(c=>`<div class="account-card"><div class="grow">${esc(c)}</div><button type="button" class="mini" data-remove-category="${esc(c)}">🗑️</button></div>`).join('')}</div></div>`,fd=>{const n=fd.newCategory.trim();if(n&&!state.categories.includes(n))state.categories.push(n);save();toast('Catégories mises à jour')});document.querySelectorAll('[data-remove-category]').forEach(b=>b.onclick=()=>{const c=b.dataset.removeCategory;if(state.categories.length<=1)return alert('Gardez au moins une catégorie');state.categories=state.categories.filter(x=>x!==c);document.querySelectorAll('.tx-card');closeModal();save();categoriesModal()})}

function handleAction(action,id){
  if(action==='account-new')accountModal();if(action==='account-edit')accountModal(account(id));if(action==='account-detail')accountDetailModal(account(id));
  if(action==='account-delete'){if(state.accounts.length===1)return alert('Vous devez garder au moins un compte');if(state.transactions.some(t=>t.accountId===id))return alert('Ce compte contient des opérations. Supprimez-les ou modifiez-les d’abord.');if(confirm('Supprimer ce compte ?')){state.accounts=state.accounts.filter(a=>a.id!==id);if(!state.accounts.some(a=>a.main))state.accounts[0].main=true;save()}}
  if(action==='tx-new')txModal();if(action==='tx-edit')txModal(state.transactions.find(t=>t.id===id));if(action==='tx-duplicate'){const t=state.transactions.find(t=>t.id===id);state.transactions.push({...t,id:uid(),date:today(),label:t.label+' (copie)'});save();toast('Opération dupliquée')}
  if(action==='tx-delete'&&confirm('Supprimer cette opération ?')){const t=state.transactions.find(x=>x.id===id);state.transactions=t.transferId?state.transactions.filter(x=>x.transferId!==t.transferId):state.transactions.filter(x=>x.id!==id);save()}
  if(action==='transfer-new')transferModal();if(action==='budget-new')budgetModal();if(action==='budget-edit')budgetModal(state.budgets.find(b=>b.id===id));if(action==='budget-delete'&&confirm('Supprimer ce budget ?')){state.budgets=state.budgets.filter(b=>b.id!==id);save()}
  if(action==='charge-new')chargeModal();if(action==='charge-edit')chargeModal(state.charges.find(c=>c.id===id));if(action==='charge-delete'&&confirm('Supprimer cette charge ?')){state.charges=state.charges.filter(c=>c.id!==id);save()}
  if(action==='charge-toggle'){const c=state.charges.find(x=>x.id===id);const paid=c.paidMonths.includes(state.month);if(paid){c.paidMonths=c.paidMonths.filter(m=>m!==state.month);state.transactions=state.transactions.filter(t=>t.chargeId!==c.id||!t.date.startsWith(state.month))}else{c.paidMonths.push(state.month);state.transactions.push({id:uid(),type:'expense',label:c.name,amount:c.amount,date:`${state.month}-${String(Math.min(c.day,new Date(state.month.slice(0,4),Number(state.month.slice(5,7)),0).getDate())).padStart(2,'0')}`,accountId:c.accountId,category:'Charges fixes',chargeId:c.id})}save();toast(paid?'Paiement annulé':'Charge marquée payée')}
  if(action==='income-recurring-new')recurringIncomeModal();if(action==='income-recurring-edit')recurringIncomeModal(state.recurringIncomes.find(r=>r.id===id));if(action==='income-recurring-delete'&&confirm('Supprimer cette recette récurrente ?')){state.recurringIncomes=state.recurringIncomes.filter(r=>r.id!==id);save()}
  if(action==='income-recurring-toggle'){const r=state.recurringIncomes.find(x=>x.id===id);const posted=r.postedMonths.includes(state.month);if(posted){r.postedMonths=r.postedMonths.filter(m=>m!==state.month);state.transactions=state.transactions.filter(t=>t.recurringIncomeId!==r.id||!t.date.startsWith(state.month))}else{r.postedMonths.push(state.month);state.transactions.push({id:uid(),type:'income',label:r.name,amount:r.amount,date:`${state.month}-${String(Math.min(r.day,daysInMonth(state.month))).padStart(2,'0')}`,accountId:r.accountId,category:r.category,recurringIncomeId:r.id})}save();toast(posted?'Recette retirée du mois':'Recette ajoutée au mois')}
  if(action==='categories')categoriesModal();
}

document.addEventListener('click',e=>{const cal=e.target.closest('[data-calendar-date]');if(cal)showCalendarDay(cal.dataset.calendarDate);const nav=e.target.closest('[data-nav]');if(nav)setPage(nav.dataset.nav);const go=e.target.closest('[data-go]');if(go)setPage(go.dataset.go);const a=e.target.closest('[data-action]');if(a)handleAction(a.dataset.action,a.dataset.id)});
document.querySelector('#prevMonth').onclick=()=>shiftMonth(-1);document.querySelector('#nextMonth').onclick=()=>shiftMonth(1);document.querySelector('#themeBtn').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';save()};
['searchInput','typeFilter','accountFilter','categoryFilter','dateFromFilter','dateToFilter','sortFilter'].forEach(id=>document.querySelector('#'+id).addEventListener(id==='searchInput'?'input':'change',renderTransactions));
document.querySelector('#clearFilters').onclick=()=>{['searchInput','dateFromFilter','dateToFilter'].forEach(id=>document.querySelector('#'+id).value='');['typeFilter','accountFilter','categoryFilter'].forEach(id=>document.querySelector('#'+id).value='all');document.querySelector('#sortFilter').value='date-desc';renderTransactions()};
document.querySelector('#modalClose').onclick=closeModal;document.querySelector('#modalCancel').onclick=closeModal;document.querySelector('#modalForm').onsubmit=e=>{e.preventDefault();const ok=modalSubmit?.(formData(e.currentTarget));if(ok!==false)closeModal()};
document.querySelector('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`budget-sauvegarde-${today()}.json`;a.click();URL.revokeObjectURL(a.href);toast('Sauvegarde téléchargée')};
document.querySelector('#csvBtn').onclick=()=>{const rows=[['Date','Type','Libellé','Catégorie','Compte','Montant'],...state.transactions.map(t=>[t.date,t.type==='income'?'Recette':'Dépense',t.label,t.category,account(t.accountId)?.name||'',(t.type==='income'?t.amount:-t.amount).toFixed(2).replace('.',',')])];const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const blob=new Blob(['\ufeff'+rows.map(r=>r.map(q).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`operations-${today()}.csv`;a.click();URL.revokeObjectURL(a.href)};
document.querySelector('#importInput').onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(!data.accounts||!data.transactions)throw Error();state={...clone(defaults),...data};save();toast('Sauvegarde restaurée')}catch{alert('Fichier invalide')}};
document.querySelector('#resetBtn').onclick=()=>{if(confirm('Effacer toutes les données ?')){state=clone(defaults);save();toast('Application remise à zéro')}};
/* Budget Familial V10 — point d'entrée */
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  render();
});
