import './styles.css';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';

const eur = v => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v||0));
const todayISO = () => new Date().toISOString().slice(0,10);
const uid = p => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const daysTo = date => {
  if(!date) return 9999;
  const a = new Date(`${todayISO()}T00:00:00`);
  const b = new Date(`${date}T00:00:00`);
  return Math.ceil((b-a)/86400000);
};

const initialState = {
  project:{
    name:'Casa Delle Vigne',
    budget:120000,
    type:'Ristrutturazione completa',
    startDate:'2026-06-01',
    endDate:'2026-12-20'
  },
  quotes:[
    {
      id:'q-gesso',
      title:'Cartongesso e finiture',
      supplier:'Renzo',
      category:'Cartongesso',
      total:13000,
      paymentMode:'SAL',
      retention:10,
      startDate:'2026-06-15',
      endDate:'2026-09-30',
      paid:11500,
      lastProgressUpdate:'2026-09-08',
      attachment:null,
      attachmentName:'',
      lines:[
        {id:'l1',name:'Controsoffitto cucina',value:2000,pct:100,done:true},
        {id:'l2',name:'Controsoffitto soggiorno',value:2500,pct:100,done:true},
        {id:'l3',name:'Parete TV curva',value:1800,pct:60,done:false},
        {id:'l4',name:'Camera matrimoniale',value:1500,pct:80,done:false},
        {id:'l5',name:'Corridoio',value:1000,pct:30,done:false},
        {id:'l6',name:'Bagni',value:1200,pct:0,done:false},
        {id:'l7',name:'Rasatura e finiture',value:3000,pct:76,done:false}
      ]
    }
  ],
  purchases:[
    {
      id:'c-tiles',
      name:'Mattonelle / rivestimenti',
      type:'Materiale',
      category:'Pavimenti e rivestimenti',
      plannedCost:4500,
      actualCost:0,
      neededBy:'2026-09-22',
      status:'da_acquistare',
      supplier:'',
      includedInQuote:false,
      note:'Confermare quantità e sfrido prima dell’ordine',
      reminder:true
    },
    {
      id:'c-mason',
      name:'Muratore',
      type:'Manodopera',
      category:'Muratura',
      plannedCost:8000,
      actualCost:0,
      neededBy:'2026-09-18',
      status:'da_confermare',
      supplier:'',
      includedInQuote:false,
      note:'Definire lavorazioni residue e preventivo',
      reminder:true
    }
  ],
  checklist:[
    {id:'t1',phase:'Preparazione',title:'Confermare misure definitive ambienti',dueDate:'2026-09-12',done:false,note:''},
    {id:'t2',phase:'Impianti',title:'Verificare punti elettrici e idraulici prima delle chiusure',dueDate:'2026-09-14',done:false,note:''},
    {id:'t3',phase:'Materiali',title:'Ordinare mattonelle e verificare tempi di consegna',dueDate:'2026-09-15',done:false,note:'Collegato alla posa pavimenti'},
    {id:'t4',phase:'Finiture',title:'Controllare rasatura prima della pittura',dueDate:'2026-09-28',done:false,note:''}
  ],
  payments:[
    {id:'p1',quoteId:'q-gesso',amount:1000,date:'2026-09-09',method:'Bonifico',note:'Acconto',receipt:null},
    {id:'p2',quoteId:'q-gesso',amount:1000,date:'2026-09-08',method:'Bonifico',note:'Acconto',receipt:null}
  ],
  extras:[]
};

function migrate(old){
  if(!old) return structuredClone(initialState);
  if(old.quotes) return {...structuredClone(initialState), ...old};
  if(old.works){
    const q = structuredClone(initialState.quotes[0]);
    q.lines = old.works.map((w,i)=>({id:`legacy-${i}`,name:w.name,value:Number(w.value||0),pct:Number(w.pct||0),done:Number(w.pct||0)>=100}));
    q.paid = Number(old.paid||0);
    return {...structuredClone(initialState), project:{...initialState.project,...(old.project||{})}, quotes:[q], payments:old.payments||[]};
  }
  return structuredClone(initialState);
}

let state = migrate(JSON.parse(localStorage.getItem('operastep-state') || 'null'));
let currentReceipt = null;
let paymentMode = 'manual';
let draftQuoteLines = [];
let draftAttachment = null;
let draftAttachmentName = '';
const app = document.querySelector('#app');

function save(){ localStorage.setItem('operastep-state',JSON.stringify(state)); }
save();

function quoteMatured(q){ return (q.lines||[]).reduce((s,l)=>s+Number(l.value||0)*Number(l.pct||0)/100,0); }
function quoteSafe(q){ return Math.max(0, quoteMatured(q)*(1-Number(q.retention||0)/100)-Number(q.paid||0)); }
function quoteExposure(q){ return Number(q.paid||0)-quoteMatured(q); }
function totalContracted(){ return state.quotes.reduce((s,q)=>s+Number(q.total||0),0); }
function totalMatured(){ return state.quotes.reduce((s,q)=>s+quoteMatured(q),0); }
function totalPaid(){ return state.quotes.reduce((s,q)=>s+Number(q.paid||0),0); }
function otherPlanned(){ return state.purchases.filter(c=>!c.includedInQuote).reduce((s,c)=>s+Number(c.plannedCost||0),0); }
function otherActual(){ return state.purchases.filter(c=>!c.includedInQuote).reduce((s,c)=>s+Number(c.actualCost||0),0); }
function forecast(){ return totalContracted()+otherPlanned()+state.extras.reduce((s,e)=>s+(e.approved?Number(e.amount||0):0),0); }
function totalSafe(){ return state.quotes.reduce((s,q)=>s+quoteSafe(q),0); }
function checklistPct(){
  if(!state.checklist.length) return 0;
  return Math.round(state.checklist.filter(t=>t.done).length/state.checklist.length*100);
}
function purchaseStatusLabel(s){
  return ({da_acquistare:'Da acquistare',da_confermare:'Da confermare',ordinato:'Ordinato',ricevuto:'Ricevuto',pagato:'Pagato'}[s]||s);
}
function statusClass(s){
  if(['ricevuto','pagato'].includes(s)) return 'green';
  if(s==='ordinato') return 'blue';
  return 'amber';
}
function smartTips(){
  const tips=[];
  for(const q of state.quotes){
    const ex=quoteExposure(q);
    if(ex>0) tips.push({level:'red',title:`Pagamento troppo avanti · ${q.supplier}`,body:`Hai pagato ${eur(ex)} più del valore maturato. Non effettuare altri acconti finché l’avanzamento non recupera.`});
    const d=daysTo(q.lastProgressUpdate);
    if(d<-7 || (q.lastProgressUpdate && Math.abs(daysTo(q.lastProgressUpdate))>7)) tips.push({level:'amber',title:`Aggiorna l’avanzamento · ${q.supplier}`,body:'Sono passati più di 7 giorni dall’ultimo controllo. Aggiorna le voci prima di qualsiasi nuovo pagamento.'});
  }
  for(const c of state.purchases){
    if(['ricevuto','pagato'].includes(c.status)) continue;
    const d=daysTo(c.neededBy);
    if(d<0) tips.push({level:'red',title:`${c.name} è in ritardo`,body:`Serviva entro ${c.neededBy}. Verifica subito disponibilità, ordine e impatto sul programma lavori.`});
    else if(d<=7) tips.push({level:'amber',title:`Serve presto: ${c.name}`,body:`Mancano ${d} giorni. ${c.status==='ordinato'?'Controlla la data di consegna.':'Conviene confermare quantità, fornitore e ordine adesso.'}`});
    else if(d<=14 && c.status==='da_acquistare') tips.push({level:'blue',title:`Pianifica l’acquisto: ${c.name}`,body:`È previsto tra ${d} giorni. Controlla tempi di consegna e margine per eventuali ritardi.`});
  }
  const overdue=state.checklist.filter(t=>!t.done && daysTo(t.dueDate)<0);
  if(overdue.length) tips.push({level:'red',title:`${overdue.length} attività in ritardo`,body:`La prima è “${overdue[0].title}”. Aggiorna il piano o completa l’attività per evitare slittamenti a cascata.`});
  const soon=state.checklist.filter(t=>!t.done && daysTo(t.dueDate)>=0 && daysTo(t.dueDate)<=5);
  if(soon.length) tips.push({level:'amber',title:'Prossima attività da chiudere',body:`“${soon[0].title}” entro ${soon[0].dueDate}.`});
  const delta=forecast()-Number(state.project.budget||0);
  if(delta>0) tips.push({level:'red',title:'Budget previsto superato',body:`Il costo previsto è ${eur(delta)} sopra il budget iniziale. Prima di approvare nuovi extra verifica dove compensare.`});
  else if(Number(state.project.budget||0)>0 && (Number(state.project.budget)-forecast())/Number(state.project.budget)<.1) tips.push({level:'amber',title:'Margine budget ridotto',body:`Ti resta meno del 10% di margine rispetto al costo previsto. Conserva una riserva per imprevisti e finiture.`});
  const tiles=state.purchases.find(c=>/matton|piastrell|rivest/i.test(c.name));
  const tileTask=state.checklist.find(t=>!/complet/i.test(t.title) && /posa|paviment|rivest/i.test(t.title));
  if(tiles && tileTask && !['ricevuto','pagato'].includes(tiles.status) && daysTo(tileTask.dueDate)<=14){
    tips.push({level:'red',title:'Sequenza a rischio: rivestimenti',body:'La posa si avvicina ma il materiale non risulta ricevuto. Verifica subito ordine, quantità, sfrido e consegna.'});
  }
  if(!tips.length) tips.push({level:'green',title:'Piano sotto controllo',body:'Non vedo criticità urgenti. Continua con il check settimanale e aggiorna acquisti e avanzamento prima dei pagamenti.'});
  return tips.slice(0,6);
}

function shell(content,active='home'){
  return `<div class="shell">${content}<nav class="nav">
    <button class="${active==='home'?'active':''}" data-nav="home"><span>⌂</span>Home</button>
    <button class="${active==='quotes'?'active':''}" data-nav="quotes"><span>▤</span>Preventivi</button>
    <button class="${active==='plan'?'active':''}" data-nav="plan"><span>✓</span>Piano</button>
    <button class="${active==='costs'?'active':''}" data-nav="costs"><span>◫</span>Costi</button>
    <button class="${active==='payments'?'active':''}" data-nav="payments"><span>€</span>Pagamenti</button>
  </nav></div>`;
}
function hero(title,subtitle,back=false,actions=''){
  return `<div class="hero"><div class="topbar">${back?'<button class="back" data-back="home">←</button>':'<div class="brand">Opera<span>Step</span></div>'}<div>${actions}</div></div>
  <div class="eyebrow">${esc(state.project.name)}</div><h1>${title}</h1><p>${subtitle}</p></div>`;
}
function tipCard(t){
  return `<div class="smart-tip ${t.level}"><div class="tip-dot"></div><div><b>${esc(t.title)}</b><p>${esc(t.body)}</p></div></div>`;
}

function home(){
  const tips=smartTips(), remaining=Number(state.project.budget||0)-forecast();
  const urgent=state.purchases.filter(c=>!['ricevuto','pagato'].includes(c.status) && daysTo(c.neededBy)<=14).sort((a,b)=>daysTo(a.neededBy)-daysTo(b.neededBy));
  app.innerHTML=shell(`${hero('La ristrutturazione, sotto controllo.','Budget, lavori, acquisti e pagamenti in un unico percorso.',false,'<button class="hero-action" data-nav="project">⚙</button>')}
    <div class="content">
      <div class="card payhero">
        <div class="label">PUOI PAGARE OGGI</div>
        <div class="amount">${eur(totalSafe())}</div>
        <div class="muted">Somma dei pagamenti ancora sostenibili sui preventivi attivi, calcolata sull’avanzamento reale.</div>
        <div class="mini-grid">
          <div><span>Preventivato</span><b>${eur(totalContracted())}</b></div>
          <div><span>Maturato</span><b>${eur(totalMatured())}</b></div>
          <div><span>Pagato lavori</span><b>${eur(totalPaid())}</b></div>
          <div><span>Altri costi previsti</span><b>${eur(otherPlanned())}</b></div>
        </div>
      </div>

      <div class="section-row"><div class="section-title">Assistente OperaStep</div><span class="ai-badge">SMART</span></div>
      <div class="assistant-card">${tips.map(tipCard).join('')}</div>

      <div class="section-title">Budget & previsione</div>
      <div class="budget-card">
        <div class="budget-head"><div><span>Budget</span><b>${eur(state.project.budget)}</b></div><div><span>Previsione finale</span><b>${eur(forecast())}</b></div></div>
        <div class="progress"><i style="width:${Math.min(100,forecast()/Math.max(1,state.project.budget)*100)}%"></i></div>
        <div class="budget-foot ${remaining<0?'negative':''}">${remaining>=0?`Margine previsto ${eur(remaining)}`:`Superamento previsto ${eur(Math.abs(remaining))}`}</div>
      </div>

      <div class="section-row"><div class="section-title">Da organizzare</div><button class="text-btn" data-nav="costs">Vedi tutto</button></div>
      ${urgent.length?urgent.slice(0,3).map(c=>`<div class="deadline-card" data-nav="costs"><div class="datebox"><b>${Math.max(0,daysTo(c.neededBy))}</b><span>giorni</span></div><div><b>${esc(c.name)}</b><p>${esc(purchaseStatusLabel(c.status))} · entro ${esc(c.neededBy)}</p></div></div>`).join(''):'<div class="empty">Nessun acquisto urgente.</div>'}

      <div class="section-row"><div class="section-title">Piano lavori</div><span class="pill green">${checklistPct()}%</span></div>
      <div class="card compact"><div class="progress"><i style="width:${checklistPct()}%"></i></div><div class="muted">${state.checklist.filter(t=>t.done).length} di ${state.checklist.length} attività completate.</div><button class="btn secondary" style="margin-top:12px" data-nav="plan">Apri checklist</button></div>
    </div>`,'home');
  bind();
}

function quotes(){
  app.innerHTML=shell(`${hero('Preventivi','Inserisci ogni impresa o fornitore separatamente. Le voci del preventivo diventano la base per controllare l’avanzamento.',true)}
    <div class="content">
      <button class="btn" data-action="new-quote">+ Inserisci preventivo</button>
      <div class="section-title">Preventivi attivi</div>
      ${state.quotes.map(q=>{
        const m=quoteMatured(q), ex=quoteExposure(q);
        return `<div class="quote-card" data-quote-open="${q.id}">
          <div class="quote-top"><div><span class="category">${esc(q.category)}</span><h3>${esc(q.supplier)}</h3><p>${esc(q.title)}</p></div><b>${eur(q.total)}</b></div>
          <div class="progress"><i style="width:${Math.min(100,m/Math.max(1,q.total)*100)}%"></i></div>
          <div class="quote-metrics"><span>Maturato <b>${eur(m)}</b></span><span>Pagato <b>${eur(q.paid)}</b></span><span class="${ex>0?'danger-text':'ok-text'}">${ex>0?`${eur(ex)} avanti`:`Pagabile ${eur(quoteSafe(q))}`}</span></div>
        </div>`;
      }).join('') || '<div class="empty">Nessun preventivo inserito.</div>'}
    </div>`,'quotes');
  bind();
}

function quoteDetail(id){
  const q=state.quotes.find(x=>x.id===id); if(!q){quotes();return}
  const m=quoteMatured(q), ex=quoteExposure(q);
  app.innerHTML=shell(`${hero(esc(q.supplier),`${esc(q.category)} · ${esc(q.title)}`,true)}
    <div class="content">
      <div class="card">
        <div class="quote-summary">
          <div><span>Preventivo</span><b>${eur(q.total)}</b></div>
          <div><span>Maturato</span><b>${eur(m)}</b></div>
          <div><span>Pagato</span><b>${eur(q.paid)}</b></div>
          <div><span>Pagabile ora</span><b>${eur(quoteSafe(q))}</b></div>
        </div>
        ${ex>0?`<div class="notice red"><b>Attenzione:</b> i pagamenti sono ${eur(ex)} avanti rispetto al lavoro maturato.</div>`:''}
        ${q.attachmentName?`<div class="attachment">📎 ${esc(q.attachmentName)}</div>`:''}
      </div>
      <div class="section-row"><div class="section-title">Checklist del preventivo</div><button class="text-btn" data-action="add-quote-line" data-id="${q.id}">+ Voce</button></div>
      <div class="card">
        ${(q.lines||[]).map((l,i)=>`<div class="work">
          <div class="work-check-row"><label class="checkline"><input type="checkbox" ${l.done?'checked':''} data-line-done="${q.id}|${i}"><span></span><b>${esc(l.name)}</b></label><span>${eur(l.value)}</span></div>
          <div class="worktop"><span>Avanzamento</span><b>${l.pct}% · ${eur(l.value*l.pct/100)}</b></div>
          <input type="range" min="0" max="100" step="5" value="${l.pct}" data-line-progress="${q.id}|${i}">
        </div>`).join('')}
        <button class="btn" style="margin-top:14px" data-action="save-quote-progress" data-id="${q.id}">Salva avanzamento</button>
      </div>
      <button class="btn secondary" data-action="new-payment-for" data-id="${q.id}">Registra pagamento a ${esc(q.supplier)}</button>
    </div>`,'quotes');
  bind();
}

function quoteForm(){
  draftQuoteLines=[];
  draftAttachment=null; draftAttachmentName='';
  app.innerHTML=shell(`${hero('Nuovo preventivo','Inserisci il documento e scomponilo nelle lavorazioni che vuoi controllare durante il cantiere.',true)}
    <div class="content"><div class="card">
      <div class="field"><label>Fornitore / impresa</label><input class="input" id="qSupplier" placeholder="es. Impresa Rossi"></div>
      <div class="field"><label>Categoria</label><select id="qCategory"><option>Muratura</option><option>Cartongesso</option><option>Impianto elettrico</option><option>Impianto idraulico</option><option>Pavimenti e rivestimenti</option><option>Infissi</option><option>Pittura</option><option>Cucina</option><option>Bagni</option><option>Altro</option></select></div>
      <div class="field"><label>Titolo preventivo</label><input class="input" id="qTitle" placeholder="es. Opere murarie piano terra"></div>
      <div class="row"><div class="field"><label>Inizio previsto</label><input class="input" type="date" id="qStart"></div><div class="field"><label>Fine prevista</label><input class="input" type="date" id="qEnd"></div></div>
      <div class="row"><div class="field"><label>Modalità pagamento</label><select id="qPayMode"><option>SAL</option><option>Acconto + SAL</option><option>Milestone</option><option>Personalizzato</option></select></div><div class="field"><label>Ritenuta sicurezza %</label><input class="input" type="number" id="qRetention" value="10"></div></div>
      <div class="upload small-upload">
        <b>Documento preventivo</b><div class="muted">Foto, immagine o PDF fino a 2 MB.</div>
        <div class="row" style="margin-top:10px"><button class="btn secondary" data-action="quote-camera">Fotocamera</button><label class="btn secondary file-label">Scegli file<input type="file" accept="image/*,.pdf" id="quoteFile"></label></div>
        <div id="quoteAttachmentName" class="attachment-name"></div>
      </div>
      <div class="section-row"><div class="section-title">Voci del preventivo</div><button class="text-btn" data-action="draft-line-add">+ Aggiungi</button></div>
      <div id="draftLines"><div class="empty mini">Aggiungi le singole lavorazioni con il loro importo.</div></div>
      <div class="field"><label>Totale preventivo</label><input class="input" type="number" id="qTotal" placeholder="0"></div>
      <button class="btn" data-action="save-quote">Salva preventivo</button>
    </div></div>`,'quotes');
  bind();
}

function renderDraftLines(){
  const box=document.querySelector('#draftLines'); if(!box)return;
  box.innerHTML=draftQuoteLines.length?draftQuoteLines.map((l,i)=>`<div class="draft-line"><div><b>${esc(l.name)}</b><small>${eur(l.value)}</small></div><button data-remove-line="${i}">×</button></div>`).join(''):'<div class="empty mini">Aggiungi le singole lavorazioni con il loro importo.</div>';
  document.querySelector('#qTotal').value=draftQuoteLines.reduce((s,l)=>s+Number(l.value||0),0)||'';
  document.querySelectorAll('[data-remove-line]').forEach(b=>b.onclick=()=>{draftQuoteLines.splice(Number(b.dataset.removeLine),1);renderDraftLines()});
}
function addDraftLine(){
  const name=prompt('Nome lavorazione (es. Demolizioni, Tracce, Intonaco):');
  if(!name)return;
  const value=Number(prompt('Importo di questa voce (€):')||0);
  if(value<=0)return;
  draftQuoteLines.push({id:uid('line'),name,value,pct:0,done:false});
  renderDraftLines();
}
async function quoteCamera(){
  try{
    const photo=await Camera.getPhoto({quality:65,allowEditing:false,resultType:CameraResultType.DataUrl,source:CameraSource.Camera});
    draftAttachment=photo.dataUrl; draftAttachmentName='Foto preventivo';
    document.querySelector('#quoteAttachmentName').textContent='✓ Foto preventivo allegata';
  }catch(e){}
}
function readQuoteFile(file){
  if(!file)return;
  if(file.size>2*1024*1024){ alert('Per questa versione usa un file sotto 2 MB.'); return; }
  const r=new FileReader();
  r.onload=()=>{draftAttachment=r.result;draftAttachmentName=file.name;document.querySelector('#quoteAttachmentName').textContent=`✓ ${file.name}`};
  r.readAsDataURL(file);
}

function plan(){
  const phases=[...new Set(state.checklist.map(t=>t.phase))];
  app.innerHTML=shell(`${hero('Piano lavori','Una checklist unica per sapere cosa è fatto, cosa manca e cosa rischia di bloccare la fase successiva.',true)}
    <div class="content">
      <div class="card plan-head"><div><span>Avanzamento checklist</span><b>${checklistPct()}%</b></div><div class="progress"><i style="width:${checklistPct()}%"></i></div></div>
      <button class="btn" data-action="new-task">+ Nuova attività</button>
      ${phases.map(ph=>`<div class="phase"><div class="phase-title">${esc(ph)}</div>${state.checklist.filter(t=>t.phase===ph).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')).map(t=>`<div class="task ${t.done?'done':''}">
        <label class="task-main"><input type="checkbox" ${t.done?'checked':''} data-task="${t.id}"><span class="task-check"></span><div><b>${esc(t.title)}</b><p>${t.dueDate?`Entro ${esc(t.dueDate)} · `:''}${esc(t.note||'')}</p></div></label>
        ${!t.done && daysTo(t.dueDate)<0?'<span class="pill red">In ritardo</span>':(!t.done&&daysTo(t.dueDate)<=5?'<span class="pill amber">A breve</span>':'')}
      </div>`).join('')}</div>`).join('')}
    </div>`,'plan');
  bind();
}

async function scheduleReminder(title,date,id){
  if(!date)return;
  const when=new Date(`${date}T09:00:00`);
  if(when.getTime()<=Date.now())return;
  try{
    const perm=await LocalNotifications.requestPermissions();
    if(perm.display==='granted'){
      await LocalNotifications.schedule({notifications:[{
        id: Math.abs([...id].reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0),0)) % 2147483000,
        title:'OperaStep · Promemoria',
        body:title,
        schedule:{at:when},
        smallIcon:'ic_stat_icon_config_sample'
      }]});
    }
  }catch(e){ console.warn('Promemoria nativo non disponibile',e); }
}

function taskForm(){
  app.innerHTML=shell(`${hero('Nuova attività','Aggiungi un passo del cantiere e la data entro cui deve essere completato.',true)}
    <div class="content"><div class="card">
      <div class="field"><label>Attività</label><input class="input" id="tTitle" placeholder="es. Confermare misure porte"></div>
      <div class="field"><label>Fase</label><select id="tPhase"><option>Preparazione</option><option>Demolizioni</option><option>Muratura</option><option>Impianti</option><option>Cartongesso</option><option>Materiali</option><option>Pavimenti e rivestimenti</option><option>Finiture</option><option>Collaudi</option><option>Altro</option></select></div>
      <div class="field"><label>Scadenza</label><input class="input" type="date" id="tDue"></div>
      <div class="field"><label>Nota</label><textarea id="tNote" rows="3" placeholder="Dipendenze, misure, fornitore..."></textarea></div>
      <label class="switch-row"><input type="checkbox" id="tReminder" checked><span>Promemoria sul telefono il giorno della scadenza</span></label>
      <button class="btn" data-action="save-task">Salva attività</button>
    </div></div>`,'plan');
  bind();
}

function costs(){
  const upcoming=state.purchases.slice().sort((a,b)=>(a.neededBy||'9999').localeCompare(b.neededBy||'9999'));
  app.innerHTML=shell(`${hero('Costi & acquisti','Materiali, manodopera e spese che non devono perdersi tra i preventivi.',true)}
    <div class="content">
      <div class="kpis"><div class="kpi"><div class="label">PREVISTI FUORI PREVENTIVO</div><b>${eur(otherPlanned())}</b></div><div class="kpi"><div class="label">GIÀ SPESI</div><b>${eur(otherActual())}</b></div></div>
      <div class="notice blue"><b>Regola OperaStep:</b> se un costo è già compreso nel preventivo di un’impresa, segnalo come “compreso nel preventivo” per non contarlo due volte.</div>
      <button class="btn" data-action="new-cost">+ Aggiungi costo / acquisto</button>
      <div class="section-title">Da pianificare</div>
      ${upcoming.map(c=>`<div class="cost-card">
        <div class="cost-top"><div><span class="category">${esc(c.type)}</span><h3>${esc(c.name)}</h3><p>${esc(c.category)}${c.supplier?` · ${esc(c.supplier)}`:''}</p></div><div class="cost-value"><b>${eur(c.plannedCost)}</b><span>${c.neededBy?`entro ${esc(c.neededBy)}`:''}</span></div></div>
        <div class="cost-bottom"><select data-cost-status="${c.id}"><option value="da_confermare" ${c.status==='da_confermare'?'selected':''}>Da confermare</option><option value="da_acquistare" ${c.status==='da_acquistare'?'selected':''}>Da acquistare</option><option value="ordinato" ${c.status==='ordinato'?'selected':''}>Ordinato</option><option value="ricevuto" ${c.status==='ricevuto'?'selected':''}>Ricevuto</option><option value="pagato" ${c.status==='pagato'?'selected':''}>Pagato</option></select><span class="pill ${statusClass(c.status)}">${esc(purchaseStatusLabel(c.status))}</span></div>
        ${c.note?`<div class="cost-note">${esc(c.note)}</div>`:''}
      </div>`).join('') || '<div class="empty">Nessun costo aggiunto.</div>'}
    </div>`,'costs');
  bind();
}

function costForm(){
  app.innerHTML=shell(`${hero('Nuovo costo o acquisto','Aggiungi ciò che serve al progetto anche quando non fa parte di un preventivo principale.',true)}
    <div class="content"><div class="card">
      <div class="field"><label>Voce</label><input class="input" id="cName" placeholder="es. Mattonelle bagno, Muratore, Sanitari"></div>
      <div class="row"><div class="field"><label>Tipo</label><select id="cType"><option>Materiale</option><option>Manodopera</option><option>Professionista</option><option>Trasporto</option><option>Noleggio</option><option>Permesso / tassa</option><option>Altro</option></select></div><div class="field"><label>Categoria</label><select id="cCategory"><option>Muratura</option><option>Impianti</option><option>Pavimenti e rivestimenti</option><option>Bagni</option><option>Cucina</option><option>Infissi</option><option>Pittura</option><option>Finiture</option><option>Altro</option></select></div></div>
      <div class="row"><div class="field"><label>Costo previsto</label><input class="input" type="number" id="cPlanned" placeholder="0"></div><div class="field"><label>Costo effettivo</label><input class="input" type="number" id="cActual" placeholder="0"></div></div>
      <div class="field"><label>Fornitore</label><input class="input" id="cSupplier" placeholder="opzionale"></div>
      <div class="field"><label>Quando serve?</label><input class="input" type="date" id="cNeeded"></div>
      <div class="field"><label>Stato</label><select id="cStatus"><option value="da_confermare">Da confermare</option><option value="da_acquistare">Da acquistare</option><option value="ordinato">Ordinato</option><option value="ricevuto">Ricevuto</option><option value="pagato">Pagato</option></select></div>
      <label class="switch-row"><input type="checkbox" id="cIncluded"><span>Questo costo è già compreso in un preventivo</span></label>
      <label class="switch-row"><input type="checkbox" id="cReminder" checked><span>Ricordamelo sul telefono</span></label>
      <div class="field"><label>Nota</label><textarea id="cNote" rows="3" placeholder="Quantità, misure, tempi consegna, colore..."></textarea></div>
      <button class="btn" data-action="save-cost">Salva costo</button>
    </div></div>`,'costs');
  bind();
}

function payments(){
  app.innerHTML=shell(`${hero('Pagamenti','Ogni pagamento viene confrontato con l’avanzamento del relativo preventivo.',true)}
    <div class="content">
      <button class="btn" data-action="new-payment">+ Nuovo pagamento</button>
      <div class="section-title">Storico</div>
      <div class="card">${state.payments.length?state.payments.slice().reverse().map(p=>{
        const q=state.quotes.find(x=>x.id===p.quoteId);
        return `<div class="history"><div><b>${eur(p.amount)} · ${esc(q?.supplier||'Fornitore')}</b><small>${esc(p.date)} · ${esc(p.method)} · ${esc(p.note||'Nessuna nota')}</small></div>${p.receipt?`<img class="receipt-thumb" src="${p.receipt}" alt="Ricevuta">`:''}</div>`;
      }).join(''):'<div class="muted">Nessun pagamento registrato.</div>'}</div>
    </div>`,'payments');
  bind();
}

function paymentForm(preselected=''){
  currentReceipt=null;paymentMode='manual';
  const options=state.quotes.map(q=>`<option value="${q.id}" ${q.id===preselected?'selected':''}>${esc(q.supplier)} · ${esc(q.category)}</option>`).join('');
  app.innerHTML=shell(`${hero('Nuovo pagamento','Prima di salvare, OperaStep controlla il valore maturato del preventivo selezionato.',true)}
    <div class="content"><div class="card">
      <div class="field"><label>Preventivo / fornitore</label><select id="payQuote">${options}</select></div>
      <div id="paySafeInfo"></div>
      <div class="method-tabs"><button class="active" data-mode="manual">Manuale</button><button data-mode="receipt">Foto bonifico</button></div>
      <div id="receiptBox" style="display:none"><div class="upload"><b>Carica il bonifico</b><div class="row" style="margin-top:10px"><button class="btn secondary" data-action="camera">Fotocamera</button><button class="btn secondary" data-action="gallery">Galleria</button></div></div><div class="preview" id="preview"><img id="previewImg" alt="Anteprima bonifico"></div></div>
      <div class="field"><label>Importo</label><input class="input" id="payAmount" type="number" placeholder="0"></div>
      <div class="row"><div class="field"><label>Data</label><input class="input" id="payDate" type="date" value="${todayISO()}"></div><div class="field"><label>Metodo</label><select id="payMethod"><option>Bonifico</option><option>Contanti</option><option>Carta</option><option>Assegno</option></select></div></div>
      <div class="field"><label>Nota / causale</label><input class="input" id="payNote" placeholder="es. SAL settembre"></div>
      <div id="paymentValidation"></div><button class="btn" id="savePay" data-action="save-payment">Registra pagamento</button>
    </div></div>`,'payments');
  bind();validatePayment();
}

function project(){
  app.innerHTML=shell(`${hero('Progetto','Dati generali, budget e calendario della ristrutturazione.',true)}
    <div class="content"><div class="card">
      <div class="field"><label>Nome progetto</label><input class="input" value="${esc(state.project.name)}" id="pname"></div>
      <div class="field"><label>Tipo ristrutturazione</label><input class="input" value="${esc(state.project.type||'')}" id="ptype"></div>
      <div class="field"><label>Budget iniziale</label><input class="input" type="number" value="${state.project.budget}" id="pbudget"></div>
      <div class="row"><div class="field"><label>Data inizio</label><input class="input" type="date" value="${state.project.startDate||''}" id="pstart"></div><div class="field"><label>Fine prevista</label><input class="input" type="date" value="${state.project.endDate||''}" id="pend"></div></div>
      <button class="btn" data-action="save-project">Salva progetto</button>
    </div></div>`,'home');
  bind();
}

async function capture(source){
  try{
    const photo=await Camera.getPhoto({quality:70,allowEditing:false,resultType:CameraResultType.DataUrl,source});
    currentReceipt=photo.dataUrl;
    const img=document.querySelector('#previewImg'),box=document.querySelector('#preview');
    if(img&&box){img.src=currentReceipt;box.style.display='block'}
  }catch(e){}
}
function selectedPayQuote(){ return state.quotes.find(q=>q.id===document.querySelector('#payQuote')?.value); }
function validatePayment(){
  const input=document.querySelector('#payAmount');if(!input)return;
  const q=selectedPayQuote(), limit=q?quoteSafe(q):0, amount=Number(input.value||0);
  const info=document.querySelector('#paySafeInfo');if(info) info.innerHTML=`<div class="safe-box"><span>Massimo consigliato ora</span><b>${eur(limit)}</b><small>${q?`${eur(quoteMatured(q))} maturati · ${eur(q.paid)} già pagati`:''}</small></div>`;
  const v=document.querySelector('#paymentValidation'),btn=document.querySelector('#savePay');
  if(amount<=0){v.innerHTML='<div class="notice amber">Inserisci l’importo.</div>';btn.disabled=true;return}
  if(amount>limit){v.innerHTML=`<div class="notice red"><b>Pagamento non consigliato:</b> supera di ${eur(amount-limit)} il limite calcolato.</div>`;btn.disabled=true;return}
  v.innerHTML='<div class="notice green"><b>Pagamento coerente.</b> Rimani entro il valore maturato.</div>';btn.disabled=false;
}

function bind(){
  document.querySelectorAll('[data-nav]').forEach(el=>el.onclick=()=>route(el.dataset.nav));
  document.querySelectorAll('[data-back]').forEach(el=>el.onclick=()=>route(el.dataset.back));
  document.querySelector('[data-action="new-quote"]')?.addEventListener('click',quoteForm);
  document.querySelectorAll('[data-quote-open]').forEach(el=>el.onclick=()=>quoteDetail(el.dataset.quoteOpen));
  document.querySelector('[data-action="draft-line-add"]')?.addEventListener('click',addDraftLine);
  document.querySelector('[data-action="quote-camera"]')?.addEventListener('click',quoteCamera);
  document.querySelector('#quoteFile')?.addEventListener('change',e=>readQuoteFile(e.target.files?.[0]));
  document.querySelector('[data-action="save-quote"]')?.addEventListener('click',()=>{
    const supplier=document.querySelector('#qSupplier').value.trim();
    const title=document.querySelector('#qTitle').value.trim();
    const total=Number(document.querySelector('#qTotal').value||0);
    if(!supplier||!title||total<=0){alert('Inserisci fornitore, titolo e importo del preventivo.');return}
    state.quotes.push({id:uid('q'),supplier,title,category:document.querySelector('#qCategory').value,total,paymentMode:document.querySelector('#qPayMode').value,retention:Number(document.querySelector('#qRetention').value||0),startDate:document.querySelector('#qStart').value,endDate:document.querySelector('#qEnd').value,paid:0,lastProgressUpdate:todayISO(),attachment:draftAttachment,attachmentName:draftAttachmentName,lines:draftQuoteLines.length?draftQuoteLines:[{id:uid('line'),name:'Lavorazione generale',value:total,pct:0,done:false}]});
    save();quotes();
  });
  document.querySelectorAll('[data-line-progress]').forEach(el=>el.oninput=e=>{
    const [qid,idx]=e.target.dataset.lineProgress.split('|'),q=state.quotes.find(x=>x.id===qid),l=q?.lines[Number(idx)];
    if(l){l.pct=Number(e.target.value);l.done=l.pct>=100;quoteDetail(qid)}
  });
  document.querySelectorAll('[data-line-done]').forEach(el=>el.onchange=e=>{
    const [qid,idx]=e.target.dataset.lineDone.split('|'),q=state.quotes.find(x=>x.id===qid),l=q?.lines[Number(idx)];
    if(l){l.done=e.target.checked;if(l.done)l.pct=100;else if(l.pct===100)l.pct=95;quoteDetail(qid)}
  });
  document.querySelector('[data-action="save-quote-progress"]')?.addEventListener('click',e=>{const q=state.quotes.find(x=>x.id===e.currentTarget.dataset.id);if(q)q.lastProgressUpdate=todayISO();save();home()});
  document.querySelector('[data-action="add-quote-line"]')?.addEventListener('click',e=>{
    const q=state.quotes.find(x=>x.id===e.currentTarget.dataset.id);if(!q)return;
    const name=prompt('Nuova voce del preventivo:');if(!name)return;
    const value=Number(prompt('Importo (€):')||0);if(value<=0)return;
    q.lines.push({id:uid('line'),name,value,pct:0,done:false});save();quoteDetail(q.id);
  });

  document.querySelector('[data-action="new-task"]')?.addEventListener('click',taskForm);
  document.querySelector('[data-action="save-task"]')?.addEventListener('click',async()=>{
    const title=document.querySelector('#tTitle').value.trim(),due=document.querySelector('#tDue').value,id=uid('task');
    if(!title){alert('Inserisci il nome dell’attività.');return}
    state.checklist.push({id,phase:document.querySelector('#tPhase').value,title,dueDate:due,done:false,note:document.querySelector('#tNote').value});
    save();if(document.querySelector('#tReminder').checked) await scheduleReminder(title,due,id);plan();
  });
  document.querySelectorAll('[data-task]').forEach(el=>el.onchange=e=>{const t=state.checklist.find(x=>x.id===e.target.dataset.task);if(t)t.done=e.target.checked;save();plan()});

  document.querySelector('[data-action="new-cost"]')?.addEventListener('click',costForm);
  document.querySelector('[data-action="save-cost"]')?.addEventListener('click',async()=>{
    const name=document.querySelector('#cName').value.trim(),needed=document.querySelector('#cNeeded').value,id=uid('cost');
    if(!name){alert('Inserisci il nome del costo o acquisto.');return}
    state.purchases.push({id,name,type:document.querySelector('#cType').value,category:document.querySelector('#cCategory').value,plannedCost:Number(document.querySelector('#cPlanned').value||0),actualCost:Number(document.querySelector('#cActual').value||0),neededBy:needed,status:document.querySelector('#cStatus').value,supplier:document.querySelector('#cSupplier').value,includedInQuote:document.querySelector('#cIncluded').checked,note:document.querySelector('#cNote').value,reminder:document.querySelector('#cReminder').checked});
    save();if(document.querySelector('#cReminder').checked) await scheduleReminder(`Ricorda: ${name} serve per il cantiere`,needed,id);costs();
  });
  document.querySelectorAll('[data-cost-status]').forEach(el=>el.onchange=e=>{const c=state.purchases.find(x=>x.id===e.target.dataset.costStatus);if(c)c.status=e.target.value;save();costs()});

  document.querySelector('[data-action="new-payment"]')?.addEventListener('click',()=>paymentForm());
  document.querySelectorAll('[data-action="new-payment-for"]').forEach(el=>el.onclick=()=>paymentForm(el.dataset.id));
  document.querySelectorAll('[data-mode]').forEach(el=>el.onclick=()=>{paymentMode=el.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===el));document.querySelector('#receiptBox').style.display=paymentMode==='receipt'?'block':'none'});
  document.querySelector('[data-action="camera"]')?.addEventListener('click',()=>capture(CameraSource.Camera));
  document.querySelector('[data-action="gallery"]')?.addEventListener('click',()=>capture(CameraSource.Photos));
  document.querySelector('#payAmount')?.addEventListener('input',validatePayment);
  document.querySelector('#payQuote')?.addEventListener('change',validatePayment);
  document.querySelector('[data-action="save-payment"]')?.addEventListener('click',()=>{
    const q=selectedPayQuote(),amount=Number(document.querySelector('#payAmount').value||0);if(!q||amount<=0||amount>quoteSafe(q))return;
    if(paymentMode==='receipt'&&!currentReceipt){alert('Carica la foto del bonifico oppure usa inserimento manuale.');return}
    state.payments.push({id:uid('pay'),quoteId:q.id,amount,date:document.querySelector('#payDate').value,method:document.querySelector('#payMethod').value,note:document.querySelector('#payNote').value,receipt:currentReceipt});q.paid=Number(q.paid||0)+amount;save();payments();
  });

  document.querySelector('[data-action="save-project"]')?.addEventListener('click',()=>{state.project.name=document.querySelector('#pname').value;state.project.type=document.querySelector('#ptype').value;state.project.budget=Number(document.querySelector('#pbudget').value||0);state.project.startDate=document.querySelector('#pstart').value;state.project.endDate=document.querySelector('#pend').value;save();home()});
}
function route(name){({home,quotes,plan,costs,payments,project}[name]||home)()}
home();
