const examples = JSON.parse(document.getElementById('examples').textContent);
const input = document.getElementById('ticketText');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const resultBox = document.getElementById('resultBox');
const jsonOutput = document.getElementById('jsonOutput');
const copyButton = document.getElementById('copyJson');

document.getElementById('validExample').addEventListener('click', () => { input.value = examples.valid; input.focus(); });
document.getElementById('useShownExample').addEventListener('click', () => { input.value = examples.valid; input.focus(); });
document.getElementById('invalidExample').addEventListener('click', () => { input.value = examples.invalid; input.focus(); });
document.getElementById('clearInput').addEventListener('click', () => { input.value = ''; fileInput.value = ''; document.getElementById('fileName').textContent = 'Formato admitido: .TXT · Un ticket por archivo'; input.focus(); });
document.getElementById('analyzeButton').addEventListener('click', analyze);
copyButton.addEventListener('click', async () => { await navigator.clipboard.writeText(jsonOutput.textContent); copyButton.textContent = 'Copiado'; setTimeout(() => { copyButton.textContent = 'Copiar JSON'; }, 1800); });

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    for (const other of document.querySelectorAll('.tab')) {
      const active = other === tab;
      other.classList.toggle('active', active);
      other.setAttribute('aria-selected', String(active));
      document.getElementById('panel-' + other.dataset.panel).hidden = !active;
    }
  });
}

fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });
for (const eventName of ['dragenter', 'dragover']) dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.add('dragging'); });
for (const eventName of ['dragleave', 'drop']) dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.remove('dragging'); });
dropZone.addEventListener('drop', event => { const file = event.dataTransfer.files[0]; if (file) loadFile(file); });

async function loadFile(file) {
  if (!file.name.toLowerCase().endsWith('.txt')) { showMessage('El archivo debe tener extensión .txt.', false); return; }
  if (file.size > 64000) { showMessage('El archivo supera el límite de 64 KB.', false); return; }
  input.value = await file.text();
  document.getElementById('fileName').textContent = `Archivo cargado: ${file.name}`;
  await analyze();
}

function showMessage(message, valid, stage = '') {
  resultBox.className = `result-card ${valid ? 'success' : 'failure'}`;
  resultBox.innerHTML = `<span class="result-symbol">${valid ? '✓' : '!'}</span><div><span class="result-kicker">${valid ? 'ANÁLISIS COMPLETO' : 'REVISIÓN NECESARIA'}${stage ? ' · ' + stage : ''}</span><h3>${valid ? 'Ticket válido' : 'Ticket inválido'}</h3><p></p></div>`;
  resultBox.querySelector('p').textContent = message;
}

async function analyze() {
  const button = document.getElementById('analyzeButton');
  button.disabled = true;
  button.textContent = 'Analizando...';
  try {
    const result = analyzeTicket(input.value);
    const stageNames = { input: 'Entrada', lexical: 'Léxico', syntactic: 'Sintaxis', semantic: 'Semántica' };
    showMessage(result.message, result.valid, stageNames[result.stage] || '');
    renderStages(result);
    renderTokenDetails(result.all_tokens);
    renderSyntaxTree(result.tokens, Boolean(result.syntax));
    jsonOutput.textContent = result.valid ? JSON.stringify(result.data, null, 2) : 'La salida JSON está disponible para tickets válidos.';
    copyButton.disabled = !result.valid;
    document.getElementById('step-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    showMessage(error.message, false);
  } finally {
    button.disabled = false;
    button.innerHTML = 'Analizar ticket <span>→</span>';
  }
}

function automatonSvg(lexeme, nondeterministic) {
  // These diagrams accept this exact lexeme, not every value in the regex class.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 440 118');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${nondeterministic ? 'AFN' : 'AFD'} para el valor ${lexeme}`);
  const ns = 'http://www.w3.org/2000/svg';
  const add = (tag, attrs, label) => {
    const el = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
    if (label !== undefined) el.textContent = label;
    svg.append(el);
  };
  const nodes = nondeterministic ? [55, 210, 385] : [80, 350];
  add('line', { x1: 6, y1: 72, x2: nodes[0] - 25, y2: 72, stroke: '#243e60', 'stroke-width': 2 });
  nodes.forEach((x, index) => {
    if (index > 0) {
      add('line', { x1: nodes[index - 1] + 25, y1: 72, x2: x - 30, y2: 72, stroke: '#243e60', 'stroke-width': 2 });
      add('polygon', { points: `${x - 30},67 ${x - 30},77 ${x - 22},72`, fill: '#243e60' });
      add('text', { x: (nodes[index - 1] + x) / 2, y: 48, 'text-anchor': 'middle', 'font-size': 12, fill: '#183a66' }, nondeterministic && index === 1 ? 'ε' : lexeme);
    }
    if (index === nodes.length - 1) add('circle', { cx: x, cy: 72, r: 27, fill: 'none', stroke: '#1d5bd7', 'stroke-width': 2 });
    add('circle', { cx: x, cy: 72, r: 22, fill: index === nodes.length - 1 ? '#e7f0ff' : '#fff', stroke: '#243e60', 'stroke-width': 2 });
    add('text', { x, y: 77, 'text-anchor': 'middle', 'font-size': 14, fill: '#0c1a2d' }, index === nodes.length - 1 ? 'qf' : `q${index}`);
  });
  return svg;
}

function renderTokenDetails(tokens) {
  const container = document.getElementById('tokenDetails');
  container.replaceChildren();
  container.classList.toggle('empty-panel', !tokens.length);
  if (!tokens.length) { container.textContent = 'No hay tokens completos. Corrige la entrada y vuelve a analizar.'; return; }
  tokens.forEach((token, index) => {
    const card = document.createElement('article'); card.className = 'token-detail';
    const title = document.createElement('h4'); title.textContent = `${String(index + 1).padStart(2, '0')} · ${token.field.toUpperCase()}`;
    const badge = document.createElement('span'); badge.className = 'token-badge'; badge.textContent = token.token; title.append(badge);
    const meta = document.createElement('div'); meta.className = 'token-meta';
    const value = document.createElement('p'); value.innerHTML = '<strong>Valor:</strong> '; value.append(document.createTextNode(token.lexeme));
    const location = document.createElement('p'); location.textContent = `Línea ${token.line}, columna ${token.column}`;
    meta.append(value, location);
    const regex = document.createElement('div'); regex.className = 'regex-line'; regex.textContent = `Expresión regular de ${token.token}: ${token.pattern}`;
    const diagrams = document.createElement('div'); diagrams.className = 'automata-grid';
    for (const [label, nondeterministic] of [['AFN del valor', true], ['AFD del valor', false]]) {
      const box = document.createElement('div'); box.className = 'diagram-box';
      const heading = document.createElement('h5'); heading.textContent = label;
      box.append(heading, automatonSvg(token.lexeme, nondeterministic)); diagrams.append(box);
    }
    const path = document.createElement('p'); path.className = 'tree-path'; path.textContent = `Árbol: start → ${token.token} → ${token.lexeme}`;
    card.append(title, meta, regex, diagrams, path); container.append(card);
  });
}

function renderSyntaxTree(tokens, validSyntax) {
  const tree = document.getElementById('syntaxTree'); tree.replaceChildren();
  tree.classList.toggle('empty-panel', !validSyntax);
  if (!validSyntax) { tree.textContent = 'El árbol completo se muestra cuando la sintaxis es válida.'; return; }
  const root = document.createElement('div'); root.className = 'tree-root'; root.textContent = 'start'; tree.append(root);
  const branches = document.createElement('div'); branches.className = 'tree-branches';
  for (const token of tokens) {
    const branch = document.createElement('div'); branch.className = 'tree-branch';
    const name = document.createElement('strong'); name.textContent = token.token;
    const leaf = document.createElement('span'); leaf.textContent = token.lexeme;
    branch.append(name, leaf); branches.append(branch);
  }
  tree.append(branches);
  const note = document.createElement('p'); note.className = 'tree-note'; note.textContent = 'Vista simplificada del árbol: los literales y separadores no se muestran porque Lark los omite en esta configuración.'; tree.append(note);
}

function renderStages(result) {
  const lexical = document.getElementById('lexicalContent');
  const syntax = document.getElementById('syntaxContent');
  const semantic = document.getElementById('semanticContent');
  if (result.tokens.length) {
    lexical.className = 'stage-content';
    lexical.innerHTML = '<div class="token-list"></div>';
    const list = lexical.querySelector('.token-list');
    for (const token of result.tokens) {
      const row = document.createElement('div');
      row.className = 'token-row';
      const name = document.createElement('b'); name.textContent = token.token;
      const value = document.createElement('span'); value.textContent = token.lexeme;
      row.append(name, value); list.append(row);
    }
  } else {
    lexical.className = 'stage-content muted';
    lexical.textContent = result.stage === 'lexical' ? 'El analizador encontró un carácter o valor no reconocido.' : 'No hay tokens completos para mostrar.';
  }
  syntax.className = 'stage-content ' + (result.syntax ? 'positive' : 'muted');
  syntax.textContent = result.syntax ? `✓ La regla inicial se cumplió. Se reconocieron ${result.syntax.fields} valores en el orden esperado.` : 'La estructura completa no se pudo validar.';
  if (result.semantic.length) {
    semantic.className = 'stage-content';
    semantic.innerHTML = '<ul class="check-list"></ul>';
    const list = semantic.querySelector('ul');
    for (const check of result.semantic) {
      const item = document.createElement('li');
      item.className = check.ok ? 'ok' : 'bad';
      item.textContent = `${check.ok ? '✓' : '×'} ${check.rule}: ${check.detail}`;
      list.append(item);
    }
  } else {
    semantic.className = 'stage-content muted';
    semantic.textContent = 'Se revisa después de confirmar la estructura del ticket.';
  }
}

function analyzeTicket(text) {
  const result = {valid:false,message:'',stage:'input',tokens:[],all_tokens:[],syntax:null,semantic:[],data:null};
  if (!text.trim()) { result.message='Escribe un ticket o carga un archivo TXT.'; return result; }
  const fields=['ticket','equipo','tipo','prioridad','estado','apertura','diagnostico','cierre'];
  const specs=[['TICKET','keyword'],['ID','[A-Z]{2}-[0-9]{3}'],[';','sep'],['EQUIPO','keyword'],['=','sep'],['ID','[A-Z]{2}-[0-9]{3}'],[';','sep'],['TIPO','keyword'],['=','sep'],['TIPO','preventivo|correctivo'],[';','sep'],['PRIORIDAD','keyword'],['=','sep'],['PRIORIDAD','baja|media|alta'],[';','sep'],['ESTADO','keyword'],['=','sep'],['ESTADO','abierto|asignado|en_proceso|cerrado'],[';','sep'],['APERTURA','keyword'],['=','sep'],['FECHA','[0-9]{4}-[0-9]{2}-[0-9]{2}'],[';','sep'],['DIAGNOSTICO','keyword'],['=','sep'],['VALOR','[a-z_]+'],[';','sep'],['CIERRE','keyword'],['=','sep'],['CIERRE','(?:[0-9]{4}-[0-9]{2}-[0-9]{2}|NA)']];
  let pos=0, line=1, col=1, vals=[];
  const advance=s=>{for(const c of s){if(c==='\n'){line++;col=1;}else col++;}};
  for (const [name,kind] of specs) {
    const ws=text.slice(pos).match(/^\s*/)[0]; advance(ws); pos+=ws.length;
    const re=kind==='sep'?new RegExp('^'+name):kind==='keyword'?new RegExp('^'+name):new RegExp('^(?:'+kind+')');
    const m=text.slice(pos).match(re);
    if(!m){result.stage=kind==='keyword'||kind==='sep'?'syntactic':'lexical'; result.message=(result.stage==='lexical'?'Caracter o valor no reconocido':'Estructura incorrecta')+' en linea '+line+', columna '+col+'.'; return result;}
    const value=m[0], startLine=line,startCol=col; advance(value);pos+=value.length;
    if(kind!=='keyword'&&kind!=='sep'){const field=fields[vals.length]; vals.push(value); const token=name==='CIERRE'?(value==='NA'?'NA':'FECHA'):name; result.tokens.push({field,token,lexeme:value,pattern:({'ID':'[A-Z]{2}-[0-9]{3}','TIPO':'preventivo|correctivo','PRIORIDAD':'baja|media|alta','ESTADO':'abierto|asignado|en_proceso|cerrado','FECHA':'[0-9]{4}-[0-9]{2}-[0-9]{2}','VALOR':'[a-z_]+' ,'NA':'NA'})[token],line:startLine,column:startCol}); }
  }
  const tail=text.slice(pos); if(tail.trim()){result.stage='syntactic';result.message='Estructura incorrecta: hay contenido adicional después del ticket.';return result;}
  const data=Object.fromEntries(fields.map((f,i)=>[f,vals[i]]));
  result.syntax={valid:true,rule:'start',fields:vals.length};
  const check=(rule,ok,detail)=>result.semantic.push({rule,ok,detail:ok?'Cumple':detail});
  check('Codigo de ticket',data.ticket.startsWith('TK-'),'El codigo debe empezar con TK-.');
  check('Codigo de equipo',data.equipo.startsWith('EQ-'),'El codigo debe empezar con EQ-.');
  let opening,closing,datesOk=true;try{opening=new Date(data.apertura+'T00:00:00Z'); if(Number.isNaN(+opening)||opening.toISOString().slice(0,10)!==data.apertura)throw 0; if(data.cierre!=='NA'){closing=new Date(data.cierre+'T00:00:00Z');if(Number.isNaN(+closing)||closing.toISOString().slice(0,10)!==data.cierre)throw 0;}}catch{datesOk=false;}
  check('Fechas existentes',datesOk,'Una fecha no existe en el calendario.');
  const closed=data.estado==='cerrado';check('Cierre completo',!closed||(data.diagnostico!=='pendiente'&&data.cierre!=='NA'),'Un ticket cerrado necesita diagnostico y fecha de cierre.');
  check('Cierre coherente',closed||data.cierre==='NA','Un ticket no cerrado no debe tener fecha de cierre.');
  check('Orden temporal',!datesOk||!closing||closing>=opening,'El cierre no puede ser anterior a la apertura.');
  const err=result.semantic.find(c=>!c.ok);if(err){result.stage='semantic';result.message=err.detail;return result;}
  result.valid=true;result.stage='complete';result.message='Ticket valido: cumple la gramatica y las reglas de negocio.';result.data=data;
  const all=[]; const lexemes=[['TICKET','keyword'],['ID','value'],[';','sep'],['EQUIPO','keyword'],['=','sep'],['ID','value'],[';','sep'],['TIPO','keyword'],['=','sep'],['TIPO','value'],[';','sep'],['PRIORIDAD','keyword'],['=','sep'],['PRIORIDAD','value'],[';','sep'],['ESTADO','keyword'],['=','sep'],['ESTADO','value'],[';','sep'],['APERTURA','keyword'],['=','sep'],['FECHA','value'],[';','sep'],['DIAGNOSTICO','keyword'],['=','sep'],['VALOR','value'],[';','sep'],['CIERRE','keyword'],['=','sep'],['CIERRE','value']];
  let k=0, scan=0;for(const [label,kind] of lexemes){const m=text.slice(scan).match(/^\s*([^\s;=]+)/);let lex;if(kind==='sep'){lex=label;scan=text.indexOf(label,scan)+1;}else{lex=m?.[1]||label;scan=text.indexOf(lex,scan)+lex.length;}const token=kind==='value'?result.tokens[k++]:null;all.push({field:kind==='value'?token.field:kind==='sep'?'separador':'palabra clave',token:token?.token||label,lexeme:lex,pattern:token?.pattern||'literal',line:1,column:1});} result.all_tokens=all;
  return result;
}
