import './styles.css';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

const eur = v => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);

const initialState = {
  project:{name:'Casa Delle Vigne',budget:120000},
  retention:.10,
  paid:11500,
  works:[
    {name:'Controsoffitto cucina',value:2000,pct:100},
    {name:'Controsoffitto soggiorno',value:2500,pct:100},
    {name:'Parete TV curva',value:1800,pct:60},
    {name:'Camera matrimoniale',value:1500,pct:80},
    {name:'Corridoio',value:1000,pct:30},
    {name:'Bagni',value:1200,pct:0},
    {name:'Rasatura e finiture',value:3000,pct:76}
  ],
  payments:[
    {amount:1000,date:'2026-09-09',method:'Bonifico',note:'Acconto',receipt:null},
    {amount:1000,date:'2026-09-08',method:'Bonifico',note:'Acconto',receipt:null}
  ]
};
let state = JSON.parse(localStorage.getItem('operastep-state') || 'null') || initialState;
let currentReceipt = null;
let paymentMode = 'manual';
const app = document.querySelector('#app');

function save(){localStorage.setItem('operastep-state',JSON.stringify(state));}
function matured(){return state.works.reduce((s,w)=>s+w.value*w.pct/100,0)}
function canPay(){return Math.max(0,matured()*(1-state.retention)-state.paid)}
function exposure(){return state.paid-matured()}

function shell(content,active='home'){
 return `<div class="shell">${content}<nav class="nav">
 <button class="${active==='home'?'active':''}" data-nav="home">⌂<br>Home</button>
 <button class="${active==='works'?'active':''}" data-nav="works">▤<br>Lavori</button>
 <button class="${active==='payments'?'active':''}" data-nav="payments">€<br>Pagamenti</button>
 <button class="${active==='project'?'active':''}" data-nav="project">•••<br>Progetto</button>
 </nav></div>`;
}
function hero(title,subtitle,back=false){return `<div class="hero"><div class="topbar">${back?'<button class="back" data-back="home">←</button>':'<div class="brand">Opera<span>Step</span></div>'}<div></div></div><div class="eyebrow">${state.project.name}</div><h1>${title}</h1><p>${subtitle}</p></div>`}

function home(){
 const cp=canPay(), ex=exposure();
 app.innerHTML=shell(`${hero('Quanto puoi pagare oggi?','L’importo viene ricalcolato sull’avanzamento reale dei lavori e sui pagamenti già registrati.')}
 <div class="content">
  <div class="card payhero"><div class="label">PAGAMENTO CONSIGLIATO OGGI</div><div class="amount">${eur(cp)}</div><div class="muted">${cp===0?'Il gessista è già stato pagato oltre il valore maturato. Prima di un altro acconto aggiorna e completa più lavori.':'Puoi effettuare un acconto entro questo limite senza superare il valore economicamente maturato.'}</div><button class="btn" style="margin-top:14px" data-action="new-payment">Registra un pagamento</button></div>
  <div class="notice amber"><b>Check settimanale:</b> aggiorna l’avanzamento almeno una volta a settimana e sempre prima di ogni pagamento.</div>
  <div class="kpis"><div class="kpi"><div class="label">Maturato</div><b>${eur(matured())}</b></div><div class="kpi"><div class="label">Pagato</div><b>${eur(state.paid)}</b></div></div>
  <div class="section-title">Cartongesso</div>
  <div class="job" data-nav="works"><div class="jobhead"><div><h3>Renzo · preventivo €13.000</h3><p>Avanzamento economico ${Math.round(matured()/13000*100)}%</p></div><span class="pill ${ex>0?'red':'green'}">${ex>0?`${eur(ex)} avanti`:'In linea'}</span></div><div class="progress"><i style="width:${Math.min(100,matured()/13000*100)}%"></i></div></div>
 </div>`,'home'); bind();
}

function works(){
 app.innerHTML=shell(`${hero('Aggiorna i lavori','Conferma ciò che è stato realmente eseguito. OperaStep trasforma le percentuali in valore economico maturato.',true)}
 <div class="content"><div class="card"><div class="label">VALORE MATURATO</div><div class="amount" style="font-size:30px">${eur(matured())}</div>${state.works.map((w,i)=>`<div class="work"><div class="worktop"><b>${w.name}</b><span>${w.pct}% · ${eur(w.value*w.pct/100)}</span></div><input type="range" min="0" max="100" value="${w.pct}" data-work="${i}"></div>`).join('')}<button class="btn" style="margin-top:14px" data-action="save-progress">Salva avanzamento</button></div><div class="notice green"><b>Dopo il salvataggio</b> ricalcoliamo automaticamente l’acconto massimo consigliato.</div></div>`,'works'); bind();
}

function payments(){
 app.innerHTML=shell(`${hero('Pagamenti','Registra ogni acconto manualmente oppure allega la foto/ricevuta del bonifico.',true)}
 <div class="content"><button class="btn" data-action="new-payment">+ Nuovo pagamento</button><div class="section-title">Storico</div><div class="card">${state.payments.length?state.payments.slice().reverse().map(p=>`<div class="history"><div><b>${eur(p.amount)} · ${p.method}</b><small>${p.date} · ${p.note||'Nessuna nota'}</small></div>${p.receipt?`<img class="receipt-thumb" src="${p.receipt}" alt="Ricevuta">`:''}</div>`).join(''):'<div class="muted">Nessun pagamento registrato.</div>'}</div></div>`,'payments'); bind();
}

function project(){
 app.innerHTML=shell(`${hero('Progetto','Dati principali e regole economiche.',true)}<div class="content"><div class="card"><div class="field"><label>Nome progetto</label><input class="input" value="${state.project.name}" id="pname"></div><div class="field"><label>Budget</label><input class="input" type="number" value="${state.project.budget}" id="pbudget"></div><div class="field"><label>Ritenuta sicurezza %</label><input class="input" type="number" value="${state.retention*100}" id="pretention"></div><button class="btn" data-action="save-project">Salva</button></div></div>`,'project'); bind();
}

function paymentForm(){
 currentReceipt=null; paymentMode='manual';
 app.innerHTML=shell(`${hero('Nuovo pagamento',`Prima di salvare, controlliamo che l’importo non superi il massimo consigliato: ${eur(canPay())}.`,true)}
 <div class="content"><div class="card">
 <div class="method-tabs"><button class="active" data-mode="manual">Inserisci manualmente</button><button data-mode="receipt">Foto bonifico</button></div>
 <div id="receiptBox" style="display:none"><div class="upload"><div class="camera">▣</div><b>Carica il bonifico</b><div class="muted" style="margin:5px 0 12px">Scatta una foto oppure scegli l’immagine dalla galleria.</div><div class="row"><button class="btn secondary" data-action="camera">Fotocamera</button><button class="btn secondary" data-action="gallery">Galleria</button></div></div><div class="preview" id="preview"><img id="previewImg" alt="Anteprima bonifico"></div></div>
 <div class="field" style="margin-top:14px"><label>Importo</label><input class="input" id="payAmount" type="number" placeholder="0,00"></div>
 <div class="row"><div class="field"><label>Data</label><input class="input" id="payDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Metodo</label><select id="payMethod"><option>Bonifico</option><option>Contanti</option><option>Carta</option><option>Assegno</option></select></div></div>
 <div class="field"><label>Nota / causale</label><input class="input" id="payNote" placeholder="es. Acconto settimana 36"></div>
 <div id="paymentValidation"></div><button class="btn" id="savePay" data-action="save-payment">Registra pagamento</button>
 </div></div>`,'payments'); bind(); validatePayment();
}

async function capture(source){
 try{
   const photo=await Camera.getPhoto({quality:75,allowEditing:false,resultType:CameraResultType.DataUrl,source});
   currentReceipt=photo.dataUrl;
   const img=document.querySelector('#previewImg'); const box=document.querySelector('#preview');
   if(img&&box){img.src=currentReceipt;box.style.display='block'}
 }catch(e){ console.warn('Foto annullata o non disponibile',e); }
}
function validatePayment(){
 const input=document.querySelector('#payAmount'); if(!input)return;
 const amount=Number(input.value||0), limit=canPay(), v=document.querySelector('#paymentValidation'), btn=document.querySelector('#savePay');
 if(amount<=0){v.innerHTML='<div class="notice amber">Inserisci l’importo del pagamento.</div>';btn.disabled=true;return}
 if(amount>limit){v.innerHTML=`<div class="notice red"><b>Pagamento non consigliato.</b> Supera di ${eur(amount-limit)} il massimo sicuro di ${eur(limit)}.</div>`;btn.disabled=true;return}
 v.innerHTML=`<div class="notice green"><b>Pagamento coerente.</b> Rimani entro il valore maturato.</div>`;btn.disabled=false;
}
function bind(){
 document.querySelectorAll('[data-nav]').forEach(el=>el.onclick=()=>route(el.dataset.nav));
 document.querySelectorAll('[data-back]').forEach(el=>el.onclick=()=>route(el.dataset.back));
 document.querySelector('[data-action="new-payment"]')?.addEventListener('click',paymentForm);
 document.querySelector('[data-action="save-progress"]')?.addEventListener('click',()=>{save();home()});
 document.querySelectorAll('[data-work]').forEach(el=>el.oninput=e=>{state.works[Number(e.target.dataset.work)].pct=Number(e.target.value);works()});
 document.querySelectorAll('[data-mode]').forEach(el=>el.onclick=()=>{paymentMode=el.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===el));document.querySelector('#receiptBox').style.display=paymentMode==='receipt'?'block':'none'});
 document.querySelector('[data-action="camera"]')?.addEventListener('click',()=>capture(CameraSource.Camera));
 document.querySelector('[data-action="gallery"]')?.addEventListener('click',()=>capture(CameraSource.Photos));
 document.querySelector('#payAmount')?.addEventListener('input',validatePayment);
 document.querySelector('[data-action="save-payment"]')?.addEventListener('click',()=>{
   const amount=Number(document.querySelector('#payAmount').value||0); if(amount<=0||amount>canPay()) return;
   if(paymentMode==='receipt'&&!currentReceipt){alert('Carica la foto del bonifico oppure passa a inserimento manuale.');return}
   state.payments.push({amount,date:document.querySelector('#payDate').value,method:document.querySelector('#payMethod').value,note:document.querySelector('#payNote').value,receipt:currentReceipt}); state.paid+=amount; save(); payments();
 });
 document.querySelector('[data-action="save-project"]')?.addEventListener('click',()=>{state.project.name=document.querySelector('#pname').value;state.project.budget=Number(document.querySelector('#pbudget').value||0);state.retention=Number(document.querySelector('#pretention').value||0)/100;save();home()});
}
function route(name){({home,works,payments,project}[name]||home)()}
home();
