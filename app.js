const STORAGE_KEY = 'aiva_dashboard_v11_8_safe_fix_site';
const CLOUD_STATE_ID = 'main';
const CITY_OPTIONS = [
  {key:'astana', label:'Астана'},
  {key:'almaty', label:'Алматы'}
];
let currentCity = localStorage.getItem('aiva_current_city') || 'astana';
function cityLabel(key=currentCity){ return CITY_OPTIONS.find(c=>c.key===key)?.label || 'Астана'; }
function cityStorageKey(){ return STORAGE_KEY + '_' + currentCity; }
function cityCloudStateId(){ return 'main_' + currentCity; }
let supabaseClient = null;
let cloudEnabled = false;
let cloudUser = null;
let cloudProfile = null;

const directions = ['Все направления', 'Урология', 'Терапия', 'Травматология', 'Эндокринология'];
const directionsPure = directions.filter(x => x !== 'Все направления');
function customDirectionsPure(){
  const planKeys = (typeof directionPlans === 'function' && state?.planMonths) ? Object.keys(directionPlans()) : [];
  const marketingKeys = state?.marketing ? Object.keys(state.marketing) : [];
  const doctorKeys = state?.doctorAssignments ? state.doctorAssignments.map(x=>x.direction) : [];
  return [...new Set([...directionsPure, ...planKeys, ...marketingKeys, ...doctorKeys])];
}
function customDirections(){
  return ['Все направления', ...customDirectionsPure()];
}
const managers = ['Мария', 'Мадина', 'Амандол', 'Дильназ', 'Алена'];
const doctorsList = [
  {name:'Ермек Тусупбеков', direction:'Урология'},
  {name:'Куандык Сембаев', direction:'Терапия'},
  {name:'Элона Потапова', direction:'Травматология'},
  {name:'Ринат Ахметов', direction:'Терапия'},
  {name:'Асем Атыгаева', direction:'Эндокринология'},
  {name:'Тимур Токтарханов', direction:'Урология'},
  {name:'Жулдыз Саламбекова', direction:'Терапия'}
];

const mMetrics = [
  {key:'budget', label:'Бюджет', money:true},
  {key:'impressions', label:'Показы'},
  {key:'clicks', label:'Клики'},
  {key:'leads', label:'Лиды'}
];
const sMetrics = [
  {key:'leads', label:'Лиды'},
  {key:'calls', label:'Дозвон'},
  {key:'appointments', label:'Записи'},
  {key:'checkups', label:'Продажи чек-апов'},
  {key:'diagnostics', label:'Продажи диагностик'},
  {key:'revenue', label:'Выручка', money:true}
];
const dMetrics = [
  {key:'appointments', label:'Приёмы'},
  {key:'sales', label:'Продажи'},
  {key:'upsells', label:'Доплаты'},
  {key:'revenue', label:'Выручка', money:true}
];

function defaultDoctorMetrics(){
  return [
    {key:'appointments', label:'Приёмы'},
    {key:'sales', label:'Продажи'},
    {key:'upsells', label:'Доплаты'},
    {key:'revenue', label:'Выручка', money:true}
  ];
}
function defaultPlanMetrics(){
  return [
    {key:'marketingBudget', label:'Маркетинг бюджет', money:true, source:'marketing', factKey:'budget', responsible:'РОМ'},
    {key:'impressions', label:'Показы', source:'marketing', factKey:'impressions', responsible:'РОМ'},
    {key:'clicks', label:'Клики', source:'marketing', factKey:'clicks', responsible:'РОМ'},
    {key:'leads', label:'Лиды', source:'marketing', factKey:'leads', responsible:'РОМ'},
    {key:'came', label:'Дошедшие', source:'clinic', factKey:'appointments', responsible:'Координатор'},
    {key:'clinicSales', label:'Продажи клиники', source:'clinic', factKey:'sales', responsible:'Координатор'},
    {key:'revenue', label:'Выручка', money:true, source:'clinic', factKey:'revenue', responsible:'Координатор'}
  ];
}
function ensureConfigs(){
  if(!state.metricConfig) state.metricConfig = {};
  if(!state.metricConfig.doctors || !Array.isArray(state.metricConfig.doctors) || !state.metricConfig.doctors.length) state.metricConfig.doctors = defaultDoctorMetrics();
  if(!state.metricConfig.planDirections || !Array.isArray(state.metricConfig.planDirections) || !state.metricConfig.planDirections.length) state.metricConfig.planDirections = defaultPlanMetrics();
}
function doctorMetrics(){
  ensureConfigs();
  return state.metricConfig.doctors;
}
function planMetrics(){
  ensureConfigs();
  return state.metricConfig.planDirections;
}
function slug(s){ return String(s||'').trim().toLowerCase().replace(/[^а-яa-z0-9]+/gi,'-').replace(/^-|-$/g,''); }
function uniqueMetricKey(label, list){
  const base = slug(label || 'metric') || 'metric';
  let key = base;
  let i = 2;
  const used = new Set(list.map(m=>m.key));
  while(used.has(key)) key = base + '_' + i++;
  return key;
}
function metricDefaultRow(metrics){
  return Object.fromEntries(metrics.map(m=>[m.key,0]));
}


function defaultMarketingMetrics(){
  return [
    {key:'budget', label:'Бюджет', money:true, rnp:true},
    {key:'impressions', label:'Показы', rnp:true},
    {key:'clicks', label:'Клики', rnp:true},
    {key:'leads', label:'Лиды', rnp:true}
  ];
}
function defaultOwners(){
  return {
    marketing:'РОМ',
    sales:'РОП',
    clinic:'Координатор',
    finance:'Владимир'
  };
}
function defaultSalesMetrics(){
  return [
    {key:'leads', label:'Лиды', rnp:true},
    {key:'calls', label:'Дозвон', rnp:true},
    {key:'appointments', label:'Записи', rnp:true},
    {key:'checkups', label:'Чек-апы', rnp:true},
    {key:'diagnostics', label:'Диагностики', rnp:true},
    {key:'revenue', label:'Выручка', money:true, rnp:false}
  ];
}
function marketingMetrics(){
  if(!state.metricConfig) state.metricConfig = {};
  if(!state.metricConfig.marketing) state.metricConfig.marketing = defaultMarketingMetrics();
  return state.metricConfig.marketing;
}
function salesMetrics(){
  if(!state.metricConfig) state.metricConfig = {};
  if(!state.metricConfig.sales) state.metricConfig.sales = defaultSalesMetrics();
  return state.metricConfig.sales;
}
function metricKey(label){
  const base = slug(label || 'metric') || 'metric';
  let key = base;
  let i = 2;
  const used = new Set([...marketingMetrics(), ...salesMetrics(), ...dMetrics].map(m=>m.key));
  while(used.has(key)) key = base + '_' + i++;
  return key;
}
function ensureMetricDefaults(section, row){
  const metrics = section === 'marketing' ? marketingMetrics() : section === 'sales' ? salesMetrics() : dMetrics;
  metrics.forEach(m=>{ if(row[m.key] === undefined) row[m.key] = 0; });
  return row;
}


function uid(){ return 'id-' + Math.random().toString(36).slice(2,10); }
function slug(s){ return String(s||'').trim().toLowerCase().replace(/[^а-яa-z0-9]+/gi,'-').replace(/^-|-$/g,''); }
function doctorKey(name, direction){ return slug(name) + '__' + slug(direction); }
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function todayIso(){ return new Date().toISOString().slice(0,10); }
function monthKeyFromDate(date){ return String(date || todayIso()).slice(0,7); }
function monthStart(key){ return key + '-01'; }
function monthEnd(key){
  const [y,m] = key.split('-').map(Number);
  const last = new Date(y, m, 0).toISOString().slice(0,10);
  const today = todayIso();
  return key === today.slice(0,7) ? today : last;
}
function currentMonthKey(){ return monthKeyFromDate(state?.filters?.start || todayIso()); }

function buildDefault(){
  const data = {
    city:currentCity,
    cityName:cityLabel(),
    filters:{start:monthStart(monthKeyFromDate(todayIso())),end:monthEnd(monthKeyFromDate(todayIso())),entryDate:todayIso(),direction:'Все направления'},
    metricConfig:{marketing:defaultMarketingMetrics(),sales:defaultSalesMetrics()},
    directionPlans:{
      'Урология':{marketingBudget:1800000,impressions:260000,clicks:5200,leads:650,came:180,clinicSales:95,revenue:11000000,comment:'Основной фокус'},
      'Терапия':{marketingBudget:1600000,impressions:235000,clicks:4700,leads:600,came:175,clinicSales:90,revenue:9000000,comment:'Стабильное направление'},
      'Травматология':{marketingBudget:1300000,impressions:180000,clicks:3600,leads:420,came:120,clinicSales:70,revenue:8500000,comment:'Усилить креативы'},
      'Эндокринология':{marketingBudget:1500000,impressions:210000,clicks:4200,leads:480,came:140,clinicSales:80,revenue:9500000,comment:'Женская аудитория'}
    },
    salesPlans:[
      {id:uid(),manager:'Мария',leadsPlan:600,callsPlan:420,appointmentsPlan:160,checkupsPlan:35,diagnosticsPlan:35,revenuePlan:3500000,comment:'Фокус урология / терапия'},
      {id:uid(),manager:'Мадина',leadsPlan:650,callsPlan:470,appointmentsPlan:180,checkupsPlan:40,diagnosticsPlan:42,revenuePlan:4200000,comment:'РОП + МОП'},
      {id:uid(),manager:'Амандол',leadsPlan:520,callsPlan:360,appointmentsPlan:135,checkupsPlan:25,diagnosticsPlan:30,revenuePlan:2600000,comment:'Усилить дожим'},
      {id:uid(),manager:'Дильназ',leadsPlan:540,callsPlan:380,appointmentsPlan:145,checkupsPlan:30,diagnosticsPlan:30,revenuePlan:2900000,comment:'Норма'},
      {id:uid(),manager:'Алена',leadsPlan:480,callsPlan:320,appointmentsPlan:120,checkupsPlan:22,diagnosticsPlan:26,revenuePlan:2300000,comment:'Контроль записи'}
    ],
    financePlans:[
      {id:uid(),category:'Маркетинг',amountPlan:6200000,comment:'Рекламные кабинеты'},
      {id:uid(),category:'ФОТ',amountPlan:12840000,comment:'Зарплаты'},
      {id:uid(),category:'Аренда',amountPlan:3200000,comment:'Помещение'},
      {id:uid(),category:'Сервисы',amountPlan:2150000,comment:'CRM, телефония, сервисы'}
    ],
    marketing:{},
    sales:{},
    doctors:{},
    financeRows:[
      {id:uid(),date:'2026-06-01',initiator:'Рус',category:'Маркетинг',purpose:'Meta Ads',amount:420000,status:'Одобрено',approved:true,comment:'Маркетинг'},
      {id:uid(),date:'2026-06-02',initiator:'Мадина',category:'Продажи',purpose:'Бонусы менеджерам',amount:180000,status:'На согласовании',approved:false,comment:'По итогам недели'},
      {id:uid(),date:'2026-06-03',initiator:'Координатор',category:'Клиника',purpose:'Расходники',amount:275000,status:'Одобрено',approved:true,comment:'Одобрено'},
      {id:uid(),date:'2026-06-04',initiator:'Рус',category:'Сервисы',purpose:'AmoCRM',amount:184000,status:'Одобрено',approved:true,comment:'Ежемесячно'},
      {id:uid(),date:'2026-06-10',initiator:'Рус',category:'Маркетинг',purpose:'Доп. бюджет урология',amount:300000,status:'На согласовании',approved:false,comment:'Усилить направление'},
      {id:uid(),date:'2026-06-11',initiator:'Координатор',category:'Клиника',purpose:'Мед. расходники',amount:360000,status:'Одобрено',approved:true,comment:'Владимир подтвердил'}
    ],
    users:[
      {id:uid(),name:'Рус Шарифуллин',email:'forsrustam@gmail.com',role:'owner'},
      {id:uid(),name:'Владимир',email:'vladimir@aiva.kz',role:'approver'},
      {id:uid(),name:'Мадина',email:'madina@aiva.kz',role:'sales'}
    ],
    knowledgeDocs:[
      {id:uid(),title:'Регламент работы администраторов',category:'Регламент',description:'Правила обработки лидов, звонков и записи.',fileName:'Регламент_администраторы.pdf',createdAt:new Date().toISOString()},
      {id:uid(),title:'Протокол первичного приёма',category:'Протокол',description:'Шаблон и порядок работы на первом приёме.',fileName:'Протокол_первичный_прием.docx',createdAt:new Date().toISOString()}
    ]
  };

  const days = ['2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05','2026-06-06','2026-06-07','2026-06-10','2026-06-11'];
  const marketingSeed = {
    'Урология':       {budget:[145,0,158,0,172,0,161,420,0], impressions:[21000,0,23000,0,25000,0,24000,61000,0], clicks:[420,0,460,0,500,0,480,1220,0], leads:[56,0,63,0,69,0,65,160,0]},
    'Терапия':        {budget:[132,0,146,0,151,0,149,380,0], impressions:[19500,0,21500,0,22500,0,21800,57000,0], clicks:[390,0,430,0,450,0,436,1140,0], leads:[51,0,58,0,60,0,57,145,0]},
    'Травматология':  {budget:[0,118,0,121,0,135,0,0,260], impressions:[0,17000,0,17600,0,19200,0,0,38000], clicks:[0,330,0,352,0,384,0,0,760], leads:[0,33,0,35,0,41,0,0,74]},
    'Эндокринология': {budget:[0,124,0,138,0,143,0,0,310], impressions:[0,18500,0,20500,0,21500,0,0,46000], clicks:[0,370,0,410,0,430,0,0,920], leads:[0,39,0,46,0,47,0,0,92]}
  };
  directionsPure.forEach(dir => {
    data.marketing[dir] = {};
    days.forEach((date, i) => {
      data.marketing[dir][date] = {
        budget:(marketingSeed[dir].budget[i] || 0) * 1000,
        impressions:marketingSeed[dir].impressions[i] || 0,
        clicks:marketingSeed[dir].clicks[i] || 0,
        leads:marketingSeed[dir].leads[i] || 0
      };
    });
  });

  const salesSeed = {
    'Мария':   {leads:[68,72,0,0,0,0,0,110,0], calls:[45,48,0,0,0,0,0,76,0], appointments:[18,19,0,0,0,0,0,31,0], checkups:[4,5,0,0,0,0,0,8,0], diagnostics:[4,4,0,0,0,0,0,6,0], revenue:[410,455,0,0,0,0,0,720,0]},
    'Мадина':  {leads:[74,80,0,0,0,0,0,125,0], calls:[56,61,0,0,0,0,0,91,0], appointments:[24,27,0,0,0,0,0,42,0], checkups:[5,6,0,0,0,0,0,10,0], diagnostics:[6,7,0,0,0,0,0,9,0], revenue:[560,640,0,0,0,0,0,960,0]},
    'Амандол': {leads:[59,61,0,0,0,0,0,98,0], calls:[37,39,0,0,0,0,0,63,0], appointments:[14,15,0,0,0,0,0,24,0], checkups:[3,3,0,0,0,0,0,5,0], diagnostics:[3,3,0,0,0,0,0,4,0], revenue:[280,305,0,0,0,0,0,410,0]},
    'Дильназ': {leads:[62,66,0,0,0,0,0,0,104], calls:[42,44,0,0,0,0,0,0,70], appointments:[17,18,0,0,0,0,0,0,29], checkups:[3,4,0,0,0,0,0,0,6], diagnostics:[4,4,0,0,0,0,0,0,5], revenue:[335,390,0,0,0,0,0,0,520]},
    'Алена':   {leads:[54,57,0,0,0,0,0,0,87], calls:[32,35,0,0,0,0,0,0,52], appointments:[12,13,0,0,0,0,0,0,19], checkups:[2,2,0,0,0,0,0,0,3], diagnostics:[3,3,0,0,0,0,0,0,4], revenue:[240,255,0,0,0,0,0,0,310]}
  };
  managers.forEach(m => {
    data.sales[m] = {};
    days.forEach((date, i) => {
      data.sales[m][date] = {
        leads:salesSeed[m].leads[i] || 0,
        calls:salesSeed[m].calls[i] || 0,
        appointments:salesSeed[m].appointments[i] || 0,
        checkups:salesSeed[m].checkups[i] || 0,
        diagnostics:salesSeed[m].diagnostics[i] || 0,
        revenue:(salesSeed[m].revenue[i] || 0) * 1000
      };
    });
  });

  data.doctorAssignments = [];
  doctorsList.forEach(doc => {
    const key = doctorKey(doc.name, doc.direction);
    data.doctorAssignments.push({id:key, name:doc.name, direction:doc.direction, comment:''});
    data.doctors[key] = {name:doc.name, direction:doc.direction, dates:{}};
    days.forEach(date => data.doctors[key].dates[date] = {appointments:0,sales:0,upsells:0,revenue:0});
  });
  const dr = (name,date,appointments,sales,upsells,revenue) => {
    const doc = doctorsList.find(d=>d.name===name);
    const direction = doc?.direction || 'Терапия';
    const key = doctorKey(name, direction);
    if(!data.doctors[key]) data.doctors[key] = {name,direction,dates:{}};
    data.doctors[key].dates[date] = {appointments,sales,upsells,revenue};
  };
  dr('Ермек Тусупбеков','2026-06-01',2,1,1,319000);
  dr('Куандык Сембаев','2026-06-01',5,0,0,130500);
  dr('Элона Потапова','2026-06-02',3,2,1,557275);
  dr('Ринат Ахметов','2026-06-02',8,1,0,562000);
  dr('Асем Атыгаева','2026-06-03',8,1,0,673700);
  dr('Тимур Токтарханов','2026-06-03',5,1,0,492000);
  dr('Жулдыз Саламбекова','2026-06-04',10,5,3,1276725);
  dr('Ермек Тусупбеков','2026-06-10',4,2,1,514000);
  dr('Ринат Ахметов','2026-06-10',6,2,0,610000);
  dr('Элона Потапова','2026-06-11',5,3,1,725000);
  dr('Асем Атыгаева','2026-06-11',5,2,1,690000);

  data.currentUserId = data.users[0].id;
  data.planMonths = {
    [monthKeyFromDate(data.filters.start)]: {
      directionPlans: clone(data.directionPlans),
      salesPlans: clone(data.salesPlans),
      financePlans: clone(data.financePlans)
    }
  };
  return data;
}

let state = load();
let tempFilters = {...state.filters};

function load(){
  let loaded = null;
  try{ const raw=localStorage.getItem(cityStorageKey()); if(raw) loaded = JSON.parse(raw); }catch(e){}
  const base = loaded || buildDefault();
  migrateState(base);
  return base;
}
function safeArray(v){ return Array.isArray(v) ? v : []; }
function safeObject(v){ return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

function migrateState(s){
  const fresh = buildDefault();

  if(!s || typeof s !== 'object') s = fresh;

  // v11.8: защита от пустого/частично сохранённого состояния города.
  // Если Supabase вернул {}, main_astana/main_almaty или битую структуру — достраиваем все разделы.
  s.marketing = safeObject(s.marketing);
  s.sales = safeObject(s.sales);
  s.doctors = safeObject(s.doctors);
  s.financeRows = safeArray(s.financeRows);
  s.users = safeArray(s.users);
  s.knowledgeDocs = safeArray(s.knowledgeDocs);
  s.planMonths = safeObject(s.planMonths);
  s.directionPlans = safeObject(s.directionPlans);
  s.salesPlans = safeArray(s.salesPlans);
  s.financePlans = safeArray(s.financePlans);

  s.city=currentCity; s.cityName=cityLabel();
  if(!s.filters) s.filters = fresh.filters;
  if(!s.filters.start) s.filters.start = monthStart(monthKeyFromDate(todayIso()));
  if(!s.filters.end) s.filters.end = monthEnd(monthKeyFromDate(s.filters.start));
  if(!s.filters.entryDate) s.filters.entryDate = todayIso();
  if(!s.filters.direction) s.filters.direction = 'Все направления';

  if(!s.metricConfig) s.metricConfig = {};
  if(!s.metricConfig.doctors || !Array.isArray(s.metricConfig.doctors) || !s.metricConfig.doctors.length) s.metricConfig.doctors = defaultDoctorMetrics();
  if(!s.metricConfig.planDirections || !Array.isArray(s.metricConfig.planDirections) || !s.metricConfig.planDirections.length) s.metricConfig.planDirections = defaultPlanMetrics();
  if(!s.owners) s.owners = defaultOwners();
  if(!s.metricConfig.marketing || !Array.isArray(s.metricConfig.marketing) || !s.metricConfig.marketing.length) s.metricConfig.marketing = defaultMarketingMetrics();
  if(!s.metricConfig.sales || !Array.isArray(s.metricConfig.sales) || !s.metricConfig.sales.length) s.metricConfig.sales = defaultSalesMetrics();
  if(!s.directionPlans || !Object.keys(s.directionPlans).length) s.directionPlans = clone(fresh.directionPlans);
  if(!s.salesPlans || !s.salesPlans.length) s.salesPlans = clone(fresh.salesPlans);
  if(!s.financePlans || !s.financePlans.length) s.financePlans = clone(fresh.financePlans);

  if(!s.marketing || !Object.keys(s.marketing).length) s.marketing = clone(fresh.marketing);
  if(!s.sales || !Object.keys(s.sales).length) s.sales = clone(fresh.sales);
  if(!s.doctors || !Object.keys(s.doctors).length) s.doctors = clone(fresh.doctors);
  normalizeDoctorsState(s);
  if(!s.financeRows || !Array.isArray(s.financeRows) || !s.financeRows.length) s.financeRows = clone(fresh.financeRows);
  if(!s.knowledgeDocs || !Array.isArray(s.knowledgeDocs)) s.knowledgeDocs = clone(fresh.knowledgeDocs);

  if(!s.users || !s.users.length) s.users = clone(fresh.users);
  if(!s.currentUserId) s.currentUserId = s.users[0]?.id;

  if(!s.planMonths) s.planMonths = {};
  const key = monthKeyFromDate(s.filters.start);
  if(!s.planMonths[key]){
    s.planMonths[key] = {
      directionPlans: clone(s.directionPlans),
      salesPlans: clone(s.salesPlans),
      financePlans: clone(s.financePlans)
    };
  }
}
function normalizeDoctorsState(s){
  const fresh = buildDefault();
  if(!s.doctorAssignments || !Array.isArray(s.doctorAssignments)) s.doctorAssignments = [];
  const normalized = {};
  const assignments = [];
  Object.entries(s.doctors || {}).forEach(([key, doc])=>{
    const name = doc.name || key;
    const direction = doc.direction || 'Терапия';
    const newKey = doctorKey(name, direction);
    normalized[newKey] = {name, direction, dates: doc.dates || {}};
    assignments.push({id:newKey, name, direction, comment: doc.comment || ''});
  });
  if(!Object.keys(normalized).length){
    Object.assign(normalized, clone(fresh.doctors));
    assignments.push(...clone(fresh.doctorAssignments || []));
  }
  s.doctors = normalized;
  const seen = new Set();
  s.doctorAssignments = [...assignments, ...(s.doctorAssignments || [])]
    .filter(a=>a && a.name && a.direction)
    .map(a=>({id:doctorKey(a.name,a.direction), name:a.name, direction:a.direction, comment:a.comment || ''}))
    .filter(a=>{
      if(seen.has(a.id)) return false;
      seen.add(a.id);
      if(!s.doctors[a.id]) s.doctors[a.id] = {name:a.name,direction:a.direction,dates:{}};
      return true;
    });
}

function activePlanPack(){
  const key = currentMonthKey();
  if(!state.planMonths) state.planMonths = {};
  if(!state.planMonths[key]){
    const templateKey = Object.keys(state.planMonths).sort().at(-1);
    const template = templateKey ? state.planMonths[templateKey] : buildDefault();
    state.planMonths[key] = {
      directionPlans: clone(template.directionPlans || buildDefault().directionPlans),
      salesPlans: clone(template.salesPlans || buildDefault().salesPlans),
      financePlans: clone(template.financePlans || buildDefault().financePlans)
    };
  }
  return state.planMonths[key];
}
function directionPlans(){ return activePlanPack().directionPlans; }
function salesPlans(){ return activePlanPack().salesPlans; }
function financePlans(){ return activePlanPack().financePlans; }
function save(show=true){
  localStorage.setItem(cityStorageKey(), JSON.stringify(state));
  if(cloudEnabled && cloudUser){
    queueCloudSave();
  }
  if(show) toast(cloudEnabled ? 'Сохранено в облако' : 'Сохранено локально');
}
let cloudSaveTimer = null;
function queueCloudSave(){
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(saveCloudState, 500);
}
async function saveCloudState(){
  if(!cloudEnabled || !supabaseClient || !cloudUser) return;
  const payload = clone(state);
  try{
    const { error } = await supabaseClient
      .from('dashboard_state')
      .upsert({
        id:cityCloudStateId(),
        data:payload,
        updated_by:cloudUser.id,
        updated_at:new Date().toISOString()
      });
    if(error) console.error('Cloud save error:', error);
  }catch(e){
    console.error('Cloud save failed:', e);
  }
}
function toast(text){ const el=document.getElementById('toast'); el.textContent=text; el.classList.add('show'); clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>el.classList.remove('show'),1200); }
function fmt(n){ return Math.round(Number(n||0)).toLocaleString('ru-RU');}
function money(n){ return fmt(n) + ' ₸';}
function pct(a,b){ return b ? Math.round((a/b)*1000)/10 : 0;}
function daysBetween(start,end){ const arr=[],s=new Date(start+'T00:00:00'),e=new Date(end+'T00:00:00'); for(let d=new Date(s);d<=e;d.setDate(d.getDate()+1)) arr.push(d.toISOString().slice(0,10)); return arr; }
function shortDate(iso){ return iso.split('-').reverse().slice(0,2).join('.');}
function isDirectionVisible(dir){ return state.filters.direction==='Все направления'||dir===state.filters.direction;}
function getDays(){ return daysBetween(state.filters.start,state.filters.end);}
function spark(){ return `<svg class="spark" viewBox="0 0 100 22" fill="none"><path d="M2 16C10 14 15 13 21 16C28 20 33 8 40 11C47 14 52 7 58 9C65 11 70 5 76 8C84 11 90 4 98 6" stroke="#2BA57E" stroke-width="2.4" stroke-linecap="round"/></svg>`; }
function kpi(icon,label,value,delta){ return `<div class="kpi"><div class="label"><span class="icon">${icon}</span>${label}</div><div class="value">${value}</div><div class="delta">${delta}</div>${spark()}</div>`; }
function status(p){ if(p>=95)return['good','В плане']; if(p>=80)return['warn','Риск']; return['bad','Просадка'];}
function initials(name){ return name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();}
const roleNames = {
  general_director:'Генеральный директор',
  marketing_director:'Директор по маркетингу',
  sales_head:'РОП',
  center_coordinator:'Координатор центра',
  clinic_director:'Директор клиники',
  owner:'Генеральный директор',
  approver:'Генеральный директор',
  manager:'Управляющий legacy',
  marketing:'Маркетолог',
  sales:'Менеджер продаж',
  clinic:'Клиника',
  finance:'Финансы',
  viewer:'Только просмотр'
};
const roleViews = {
  general_director:['rnp','home','plans','marketing','sales','clinic','doctors','finance','knowledge','users','settings'],
  owner:['rnp','home','plans','marketing','sales','clinic','doctors','finance','knowledge','users','settings'],
  approver:['rnp','home','plans','marketing','sales','clinic','doctors','finance','knowledge','users','settings'],

  marketing_director:['rnp','home','plans','marketing','sales','clinic','doctors','knowledge','users','settings'],
  manager:['rnp','home','plans','marketing','sales','clinic','doctors','knowledge','users','settings'],

  sales_head:['rnp','home','plans','sales','knowledge','settings'],
  center_coordinator:['rnp','home','clinic','doctors','finance','knowledge','settings'],
  clinic_director:['rnp','home','finance','knowledge','settings'],

  marketing:['rnp','home','marketing','knowledge','settings'],
  sales:['rnp','home','sales','knowledge','settings'],
  clinic:['rnp','home','clinic','doctors','knowledge','settings'],
  finance:['rnp','home','finance','knowledge','settings'],
  viewer:['rnp','home','knowledge','settings']
};
function activeUser(){
  if(cloudEnabled && cloudProfile){
    const localUser = state.users?.find(u=>u.id===cloudUser?.id || u.email===cloudUser?.email) || {};
    return {
      id: cloudUser?.id,
      name: localUser.name || cloudProfile.name || cloudProfile.email || cloudUser?.email || 'Пользователь',
      email: localUser.email || cloudProfile.email || cloudUser?.email || '',
      role: localUser.role || cloudProfile.role || 'viewer',
      assignedTo: localUser.assignedTo || localUser.assigned_to || ''
    };
  }
  return state.users.find(u=>u.id===state.currentUserId) || state.users[0] || {name:'Гость',role:'viewer',email:''};
}
function canView(view){
  const role = activeUser().role || 'viewer';
  return (roleViews[role] || roleViews.viewer).includes(view);
}
function canEdit(area){
  const role = activeUser().role || 'viewer';

  if(['general_director','owner','approver'].includes(role)) return true;
  if(['marketing_director','manager'].includes(role)) return !['finance','financePlans'].includes(area);
  if(role==='sales_head') return area==='sales' || area==='salesPlans';
  if(role==='center_coordinator') return area==='doctors' || area==='clinic' || area==='finance';
  if(role==='clinic_director') return area==='finance';

  if(area==='marketing') return role==='marketing';
  if(area==='sales') return role==='sales';
  if(area==='doctors') return role==='clinic';
  if(area==='finance') return role==='finance';
  if(area==='plans' || area==='users') return false;
  if(area==='knowledge') return role!=='viewer';
  return false;
}

function normName(s){ return String(s||'').trim().toLowerCase(); }
function activeAssignedTo(){
  const u = activeUser();
  return normName(u.assignedTo || u.assigned_to || u.name || u.email?.split('@')[0] || '');
}
function entityAllowedForUser(section, entity){
  const role = activeUser().role || 'viewer';
  if(['general_director','owner','approver','marketing_director','manager'].includes(role)) return true;
  if(role==='sales_head' && section==='sales') return true;
  if(['center_coordinator','clinic_director','finance'].includes(role) && section==='finance') return true;
  if(role==='center_coordinator' && (section==='doctors' || section==='clinic')) return true;

  const assigned = activeAssignedTo();
  if(section === 'sales' && role === 'sales'){
    return normName(entity) === assigned || normName(entity).includes(assigned) || assigned.includes(normName(entity));
  }
  if(section === 'doctors' && role === 'clinic'){
    const doc = state.doctors?.[entity];
    const name = normName(doc?.name || entity);
    return !assigned || name === assigned || name.includes(assigned) || assigned.includes(name);
  }
  if(section === 'marketing' && role === 'marketing') return true;
  return false;
}
function canEditEntity(section, entity){
  return canEdit(section) && entityAllowedForUser(section, entity);
}

function canSeeProfit(){
  const user = activeUser();
  const role = user.role || 'viewer';
  const name = String(user.name || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();
  return ['general_director','owner','approver'].includes(role) || name.includes('владимир') || email.includes('vladimir');
}
function protectedMoney(value){
  return canSeeProfit() ? money(value) : 'Скрыто';
}
function protectedPercent(value){
  return canSeeProfit() ? value + '%' : 'Скрыто';
}

function canSeeExpenses(){
  const user = activeUser();
  const role = user.role || 'viewer';
  const name = String(user.name || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();
  return ['general_director','owner','approver'].includes(role) || name.includes('владимир') || email.includes('vladimir');
}
function canAccessFinanceSection(){
  const role = activeUser().role || 'viewer';
  return ['general_director','owner','approver','center_coordinator','clinic_director','finance'].includes(role);
}
function canSeeDirectionPlans(){
  const role = activeUser().role || 'viewer';
  return ['general_director','owner','approver','marketing_director','manager'].includes(role);
}
function canSeeSalesPlans(){
  const role = activeUser().role || 'viewer';
  return ['general_director','owner','approver','marketing_director','manager','sales_head'].includes(role);
}
function canEditSalesPlans(){
  const role = activeUser().role || 'viewer';
  return ['general_director','owner','approver','marketing_director','manager','sales_head'].includes(role);
}
function canSeeFinancePlans(){
  return canSeeExpenses();
}
function protectedExpenseMoney(value){
  return canSeeExpenses() ? money(value) : 'Скрыто';
}
function protectedExpensePercent(value){
  return canSeeExpenses() ? value + '%' : 'Скрыто';
}

function getValue(section,entity,date,metric){
  if(section==='doctors') return state.doctors[entity]?.dates?.[date]?.[metric] || 0;
  return state[section][entity]?.[date]?.[metric] || 0;
}
function setValue(section,entity,date,metric,value){
  const defaults = section==='marketing'
    ? Object.fromEntries(marketingMetrics().map(m=>[m.key,0]))
    : section==='sales'
      ? Object.fromEntries(salesMetrics().map(m=>[m.key,0]))
      : section==='doctors' ? metricDefaultRow(doctorMetrics()) : {appointments:0,sales:0,upsells:0,revenue:0};
  if(section==='doctors'){
    const assignment = state.doctorAssignments?.find(a=>a.id===entity);
    if(!state.doctors[entity]) state.doctors[entity]={name:assignment?.name || entity,direction:assignment?.direction || '',dates:{}};
    if(!state.doctors[entity].dates[date]) state.doctors[entity].dates[date]={...defaults};
    state.doctors[entity].dates[date][metric]=value;
  } else {
    if(!state[section][entity]) state[section][entity]={};
    if(!state[section][entity][date]) state[section][entity][date]={...defaults};
    state[section][entity][date][metric]=value;
  }
}
function sumObj(section, entities, metrics){
  const days=getDays(); const out={}; metrics.forEach(m=>out[m.key]=0);
  entities.forEach(entity=>days.forEach(date=>{
    metrics.forEach(m=>out[m.key]+=Number(getValue(section,entity,date,m.key)||0));
  }));
  return out;
}
function directionPlanTotal(key){
  return Object.entries(directionPlans()).filter(([dir])=>isDirectionVisible(dir)).reduce((a,[,p])=>a+Number(p[key]||0),0);
}
function salesPlanTotal(key){ return salesPlans().reduce((a,p)=>a+Number(p[key]||0),0); }
function activeManagers(){
  const fromPlan = salesPlans().map(p=>p.manager).filter(Boolean);
  const fromSales = Object.keys(state.sales || {});
  return [...new Set([...fromPlan, ...fromSales])].filter(name => salesPlans().some(p=>p.manager===name) || fromSales.includes(name));
}
function salesPlanManagers(){
  return salesPlans().map(p=>p.manager).filter(Boolean);
}
function syncSalesWithPlans(){
  if(!state.sales) state.sales = {};
  salesPlanManagers().forEach(name=>{
    if(!state.sales[name]) state.sales[name] = {};
  });
}
function renameSalesManager(oldName, newName){
  oldName = String(oldName||'').trim();
  newName = String(newName||'').trim();
  if(!newName || oldName === newName) return;
  if(state.sales?.[oldName]){
    if(!state.sales[newName]) state.sales[newName] = state.sales[oldName];
    else {
      Object.entries(state.sales[oldName]).forEach(([date,row])=>{
        if(!state.sales[newName][date]) state.sales[newName][date] = row;
        else Object.assign(state.sales[newName][date], row);
      });
    }
    delete state.sales[oldName];
  }
}
function removeSalesManagerData(name){
  delete state.sales[name];
}

function financePlanTotal(){ return financePlans().reduce((a,p)=>a+Number(p.amountPlan||0),0); }

function marketingSummary(){
  return customDirectionsPure().filter(isDirectionVisible).map(dir=>{
    const s=sumObj('marketing',[dir],marketingMetrics()), p=directionPlans()[dir]||{};
    const cpl = s.leads ? Math.round(s.budget/s.leads) : 0;
    const cpc = s.clicks ? Math.round(s.budget/s.clicks) : 0;
    const ctr = s.impressions ? pct(s.clicks,s.impressions) : 0;
    return {
      direction:dir,
      planBudget:p.marketingBudget||0,
      planImpressions:p.impressions||0,
      planClicks:p.clicks||0,
      planLeads:p.leads||0,
      budget:s.budget,
      impressions:s.impressions,
      clicks:s.clicks,
      leads:s.leads,
      cpl,
      cpc,
      ctr,
      planPct:p.marketingBudget?pct(s.budget,p.marketingBudget):0
    };
  });
}
function salesSummary(){
  syncSalesWithPlans();
  return salesPlanManagers().map(m=>{
    const s=sumObj('sales',[m],salesMetrics()), p=salesPlans().find(x=>x.manager===m)||{};
    const totalSales = Number(s.checkups||0)+Number(s.diagnostics||0);
    return {manager:m,...s,totalSales,rate:pct(s.appointments,s.leads),planAppointments:p.appointmentsPlan||0,planCheckups:p.checkupsPlan||0,planDiagnostics:p.diagnosticsPlan||0,planRevenue:p.revenuePlan||0};
  });
}
function doctorSummary(){
  const keys=Object.keys(state.doctors || {}).filter(key=>isDirectionVisible(state.doctors[key].direction));
  return keys.map(key=>{
    const doc = state.doctors[key];
    const s=sumObj('doctors',[key],doctorMetrics());
    return {key,name:doc.name || key,direction:doc.direction,...s,conversion:pct(s.sales,s.appointments)};
  }).sort((a,b)=>b.revenue-a.revenue);
}
function clinicAutoSummary(){
  const groups={};
  doctorSummary().forEach(d=>{
    if(!groups[d.direction]) groups[d.direction]={direction:d.direction,appointments:0,sales:0,upsells:0,revenue:0};
    groups[d.direction].appointments+=d.appointments; groups[d.direction].sales+=d.sales; groups[d.direction].upsells+=d.upsells; groups[d.direction].revenue+=d.revenue;
  });
  return customDirectionsPure().filter(isDirectionVisible).map(dir=>{
    const fact=groups[dir]||{direction:dir,appointments:0,sales:0,upsells:0,revenue:0};
    const plan=directionPlans()[dir]||{};
    return {...fact,planSales:plan.clinicSales||0,planRevenue:plan.revenue||0,planCame:plan.came||0,planPct:plan.revenue?pct(fact.revenue,plan.revenue):0};
  });
}
function financeRows(){ return state.financeRows.filter(r=>r.date>=state.filters.start && r.date<=state.filters.end); }
function totals(){
  const ms=marketingSummary(), ss=salesSummary(), cs=clinicAutoSummary(), fs=financeRows();
  return {
    marketingBudget:ms.reduce((a,b)=>a+b.budget,0),
    leads:ms.reduce((a,b)=>a+b.leads,0),
    
    calls:ss.reduce((a,b)=>a+b.calls,0),
    salesAppointments:ss.reduce((a,b)=>a+b.appointments,0),
    checkups:ss.reduce((a,b)=>a+b.checkups,0),
    diagnostics:ss.reduce((a,b)=>a+b.diagnostics,0),
    opSales:ss.reduce((a,b)=>a+b.totalSales,0),
    opRevenue:ss.reduce((a,b)=>a+b.revenue,0),
    doctorAppointments:cs.reduce((a,b)=>a+b.appointments,0),
    clinicSales:cs.reduce((a,b)=>a+b.sales,0),
    upsells:cs.reduce((a,b)=>a+b.upsells,0),
    clinicRevenue:cs.reduce((a,b)=>a+b.revenue,0),
    totalRevenue:ss.reduce((a,b)=>a+b.revenue,0) + cs.reduce((a,b)=>a+b.revenue,0),
    expenses:fs.reduce((a,b)=>a+Number(b.amount||0),0),
    approvedCount:fs.filter(x=>x.approved).length,
    financeCount:fs.length
  };
}
function matrixHtml(section, entities, metrics, label){
  const days=getDays();
  const header=`<thead><tr><th class="sticky-1">${label.header}</th><th class="sticky-2">Показатель</th>${days.map(d=>`<th>${shortDate(d)}</th>`).join('')}<th>Итого</th></tr></thead>`;
  let body='';
  entities.forEach(entity=>metrics.forEach((m,idx)=>{
    const total=days.reduce((acc,date)=>acc+Number(getValue(section,entity,date,m.key)||0),0);
    body += `<tr data-section="${section}" data-entity="${entity}" data-metric="${m.key}">
      <td class="sticky-1">${idx===0?label.name(entity):''}</td>
      <td class="sticky-2">${m.label}</td>
      ${days.map(date=>`<td><input class="matrix-input" data-date="${date}" type="number" value="${Number(getValue(section,entity,date,m.key)||0)}"></td>`).join('')}
      <td><b>${m.money?money(total):fmt(total)}</b></td>
    </tr>`;
  }));
  return `<table class="matrix">${header}<tbody>${body}</tbody></table>`;
}

function dynamicMetricRows(){
  const rows = [];

  marketingMetrics().filter(m=>m.rnp).forEach(m=>{
    const fact = marketingSummary().reduce((a,b)=>a+Number(b[m.key]||0),0);
    const plan = directionPlanTotal(m.key === 'budget' ? 'marketingBudget' : m.key);
    rows.push([
      'Маркетинг ' + m.label.toLowerCase(),
      m.money ? money(plan) : fmt(plan),
      m.money ? money(fact) : fmt(fact),
      pct(fact,plan),
      state.owners?.marketing || 'РОМ',
      'Маркетинг'
    ]);
  });

  salesMetrics().filter(m=>m.rnp).forEach(m=>{
    const fact = salesSummary().reduce((a,b)=>a+Number(b[m.key]||0),0);
    let planKey = m.key + 'Plan';
    if(m.key === 'calls') planKey = 'callsPlan';
    if(m.key === 'appointments') planKey = 'appointmentsPlan';
    if(m.key === 'checkups') planKey = 'checkupsPlan';
    if(m.key === 'diagnostics') planKey = 'diagnosticsPlan';
    if(m.key === 'revenue') planKey = 'revenuePlan';
    if(m.key === 'leads') planKey = 'leadsPlan';
    const plan = salesPlanTotal(planKey);
    rows.push([
      'ОП ' + m.label.toLowerCase(),
      m.money ? money(plan) : fmt(plan),
      m.money ? money(fact) : fmt(fact),
      pct(fact,plan),
      state.owners?.sales || 'РОП',
      'Продажи'
    ]);
  });

  return rows;
}
function renderRnp(){
  const t=totals();
  const profit=t.totalRevenue-t.expenses;
  const romi=t.marketingBudget?pct(Math.max(profit,0),t.marketingBudget):0;
  document.getElementById('rnpKpis').innerHTML=[
    ['₸','Выручка',money(t.totalRevenue),'ОП + клиника'],
    ['◫','Расходы',protectedExpenseMoney(t.expenses),canSeeExpenses() ? 'заявки' : 'скрыто'],
    ['◎','Чистая прибыль',protectedMoney(profit),canSeeProfit() ? 'выручка - расходы' : 'только Владимир'],
    ['◌','Лиды',fmt(t.leads),'маркетинг'],
    ['✦','Записи',fmt(t.salesAppointments),'ОП'],
    ['✓','Приёмы',fmt(t.doctorAppointments),'врачи'],
    ['↗','Продажи клиники',fmt(t.clinicSales),'из врачей'],
    ['◉','ROMI',protectedPercent(romi),canSeeProfit() ? 'прибыль / бюджет' : 'только Владимир']
  ].map(x=>kpi(...x)).join('');

  const rows=[
    ...dynamicMetricRows(),
    ['Клиника продажи',fmt(directionPlanTotal('clinicSales')),fmt(t.clinicSales),pct(t.clinicSales,directionPlanTotal('clinicSales')),state.owners?.clinic || 'Координатор','Врачи'],
    ['ОП выручка',money(salesPlanTotal('revenuePlan')),money(t.opRevenue),pct(t.opRevenue,salesPlanTotal('revenuePlan')),state.owners?.sales || 'РОП','Продажи'],
    ['Клиника выручка',money(directionPlanTotal('revenue')),money(t.clinicRevenue),pct(t.clinicRevenue,directionPlanTotal('revenue')),state.owners?.clinic || 'Координатор','Врачи'],
    ['Итого выручка',money(salesPlanTotal('revenuePlan') + directionPlanTotal('revenue')),money(t.totalRevenue),pct(t.totalRevenue,salesPlanTotal('revenuePlan') + directionPlanTotal('revenue')),state.owners?.finance || 'Ген. директор','ОП + клиника'],
    ['Финансы расходы',protectedExpenseMoney(financePlanTotal()),protectedExpenseMoney(t.expenses),canSeeExpenses()?pct(t.expenses,financePlanTotal()):0,state.owners?.finance || 'Владимир','Финансы']
  ];
  document.getElementById('rnpTable').innerHTML=rows.map(r=>{const s=status(r[3]);return `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${(r[1]==='Скрыто'||r[2]==='Скрыто')?'Скрыто':r[3]+'%'}</td><td>${r[4]}</td><td class="source">${r[5]}</td><td><span class="badge ${s[0]}">${(r[1]==='Скрыто'||r[2]==='Скрыто')?'Скрыто':s[1]}</span></td></tr>`}).join('');

  document.getElementById('marketingSummaryRnp').innerHTML=marketingSummary().map(x=>`<tr><td>${x.direction}</td><td>${money(x.planBudget)}</td><td>${money(x.budget)}</td><td>${fmt(x.impressions)}</td><td>${fmt(x.clicks)}</td><td>${fmt(x.leads)}</td><td>${x.cpl?money(x.cpl):'—'}</td></tr>`).join('');
  const funnel=[
    ['Лиды',t.leads,'100%','#14916f','100%'],
    ['Дозвон',t.calls,pct(t.calls,t.leads)+'%','#117d60','88%'],
    ['Запись',t.salesAppointments,pct(t.salesAppointments,t.leads)+'%','#0f6f56','76%'],
    ['Чек-апы',t.checkups,pct(t.checkups,t.salesAppointments)+'%','#0d624b','64%'],
    ['Диагностики',t.diagnostics,pct(t.diagnostics,t.salesAppointments)+'%','#0a5641','54%']
  ];
  document.getElementById('funnel').innerHTML=funnel.map(f=>`<div class="funnel-step" style="--w:${f[4]};background:${f[3]}"><span>${f[0]}</span><span>${fmt(f[1])}</span><span>${f[2]}</span></div>`).join('');
  renderClinicSalesAnalytics('clinicSalesAnalytics');
  document.getElementById('topDoctors').innerHTML=doctorSummary().slice(0,5).map(d=>`<div class="doctor-item"><div class="doc-avatar">${initials(d.name)}</div><div><b>${d.name}</b><div class="muted">${d.direction} · конв. ${d.conversion}%</div></div><b>${money(d.revenue)}</b></div>`).join('');
  renderFinanceDonut();
}
function renderClinicSalesAnalytics(id){
  const cs=clinicAutoSummary(); const max=Math.max(...cs.map(x=>x.planSales||x.sales),1);
  document.getElementById(id).innerHTML=cs.map(x=>`<div class="bar-row"><span>${x.direction}</span><div class="track"><div class="fill" style="width:${Math.min(100,(x.sales/(x.planSales||max))*100)}%"></div></div><b>${fmt(x.sales)}/${fmt(x.planSales)}</b></div>`).join('');
}
function renderFinanceDonut(){
  const rows=financeRows(), total=rows.reduce((a,b)=>a+Number(b.amount||0),0), groups={};
  rows.forEach(r=>groups[r.category]=(groups[r.category]||0)+Number(r.amount||0));
  const colors=['#14916f','#7ac7ad','#eebf73','#accfd4','#9eb8aa','#5d95c1'];
  let cur=0, parts=[], i=0, legend=[];
  Object.entries(groups).forEach(([cat,amount])=>{const percent=total?pct(amount,total):0,color=colors[i++%colors.length];parts.push(`${color} ${cur}% ${cur+percent}%`);cur+=percent;legend.push({cat,amount,color});});
  const donut=document.getElementById('financeDonut');
  donut.style.background=parts.length?`conic-gradient(${parts.join(',')})`:'#eef3f0';
  donut.dataset.center=`${money(total)}\\AРасходы`;
  document.getElementById('financeLegend').innerHTML=legend.map(x=>`<div class="legend-row"><span class="dot" style="background:${x.color}"></span><span>${x.cat}</span><b>${money(x.amount)}</b></div>`).join('');
}
function renderHome(){
  const t=totals();
  document.getElementById('homeStats').innerHTML=[
    [`${pct(t.totalRevenue,salesPlanTotal('revenuePlan') + directionPlanTotal('revenue'))}%`,'Выполнение общей выручки'],
    [`${fmt(t.checkups)}/${fmt(t.diagnostics)}`,'Чек-апы / диагностики'],
    [fmt(state.users.length),'Пользователей']
  ].map(x=>`<div><b>${x[0]}</b><small>${x[1]}</small></div>`).join('');
}
function renderPlans(){
  document.getElementById('plansKpis').innerHTML=[
    ['◎','План маркетинга',canSeeDirectionPlans()?money(directionPlanTotal('marketingBudget')):'Скрыто',canSeeDirectionPlans()?fmt(directionPlanTotal('leads'))+' лидов':'скрыто'],
    ['↗','План ОП',canSeeSalesPlans()?fmt(salesPlanTotal('checkupsPlan')+salesPlanTotal('diagnosticsPlan')):'Скрыто',canSeeSalesPlans()?'чек-апы + диагностики':'скрыто'],
    ['☤','План клиники',canSeeDirectionPlans()?money(directionPlanTotal('revenue')):'Скрыто',canSeeDirectionPlans()?fmt(directionPlanTotal('clinicSales'))+' продаж':'скрыто'],
    ['₸','План расходов',protectedExpenseMoney(financePlanTotal()),canSeeExpenses()?'финансы':'скрыто']
  ].map(x=>kpi(...x)).join('');

  const directionPlanCard = document.getElementById('directionPlansTable')?.closest('.card');
  if(directionPlanCard) directionPlanCard.style.display = canSeeDirectionPlans() ? '' : 'none';
  if(canSeeDirectionPlans()){
    renderMetricEditor('planMetricSettings', planMetrics(), 'plans');
  const directionHead = document.querySelector('#directionPlansTable thead tr');
  if(directionHead) directionHead.innerHTML = '<th>Направление</th>' + planMetrics().map(m=>`<th>${m.label}</th>`).join('') + '<th>Комментарий</th>';
  document.querySelector('#directionPlansTable tbody').innerHTML=customDirectionsPure().map(dir=>{
      if(!directionPlans()[dir]) directionPlans()[dir] = {marketingBudget:0,impressions:0,clicks:0,leads:0,came:0,clinicSales:0,revenue:0,comment:''};
      const p=directionPlans()[dir];
      return `<tr data-plan-dir="${dir}">
        <td><b>${dir}</b></td>
        <td><input class="direction-plan" data-key="marketingBudget" type="number" value="${p.marketingBudget}"></td>
        <td><input class="direction-plan" data-key="impressions" type="number" value="${p.impressions}"></td>
        <td><input class="direction-plan" data-key="clicks" type="number" value="${p.clicks}"></td>
        <td><input class="direction-plan" data-key="leads" type="number" value="${p.leads}"></td>
        <td><input class="direction-plan" data-key="came" type="number" value="${p.came}"></td>
        <td><input class="direction-plan" data-key="clinicSales" type="number" value="${p.clinicSales}"></td>
        <td><input class="direction-plan" data-key="revenue" type="number" value="${p.revenue}"></td>
        <td><input class="direction-plan" data-key="comment" value="${p.comment||''}"></td>
      </tr>`;
    }).join('');
  }

  const salesPlanCard = document.getElementById('salesPlansTable')?.closest('.card');
  if(salesPlanCard) salesPlanCard.style.display = canSeeSalesPlans() ? '' : 'none';
  if(canSeeSalesPlans()){
    document.querySelector('#salesPlansTable tbody').innerHTML=salesPlans().map(p=>`<tr data-sales-plan="${p.id}">
      <td><input class="sales-plan" data-key="manager" value="${p.manager}"></td>
      <td><input class="sales-plan" data-key="leadsPlan" type="number" value="${p.leadsPlan}"></td>
      <td><input class="sales-plan" data-key="callsPlan" type="number" value="${p.callsPlan}"></td>
      <td><input class="sales-plan" data-key="appointmentsPlan" type="number" value="${p.appointmentsPlan}"></td>
      <td><input class="sales-plan" data-key="checkupsPlan" type="number" value="${p.checkupsPlan}"></td>
      <td><input class="sales-plan" data-key="diagnosticsPlan" type="number" value="${p.diagnosticsPlan}"></td>
      <td><input class="sales-plan" data-key="revenuePlan" type="number" value="${p.revenuePlan}"></td>
      <td><input class="sales-plan" data-key="comment" value="${p.comment||''}"></td>
      <td><button class="delete sales-plan-delete" type="button">×</button></td>
    </tr>`).join('');
  }

  const financeCard = document.getElementById('financePlanCard');
  if(financeCard) financeCard.style.display = canSeeFinancePlans() ? '' : 'none';
  if(canSeeFinancePlans()){
    document.querySelector('#financePlansTable tbody').innerHTML=financePlans().map(p=>`<tr data-finance-plan="${p.id}">
      <td><input class="finance-plan" data-key="category" value="${p.category}"></td>
      <td><input class="finance-plan" data-key="amountPlan" type="number" value="${p.amountPlan}"></td>
      <td><input class="finance-plan" data-key="comment" value="${p.comment||''}"></td>
      <td><button class="delete finance-plan-delete" type="button">×</button></td>
    </tr>`).join('');
  }
}
function renderMetricSettings(section){
  const box = document.getElementById(section === 'marketing' ? 'marketingMetricSettings' : 'salesMetricSettings');
  if(!box) return;
  const metrics = section === 'marketing' ? marketingMetrics() : salesMetrics();
  const canEditMetrics = section === 'marketing' ? canEdit('marketing') || canEdit('plans') : canEditSalesPlans?.() || canEdit('sales');
  box.innerHTML = metrics.map(m=>`<div class="metric-chip" data-section="${section}" data-key="${m.key}">
    <input class="metric-label" type="text" value="${m.label}" ${canEditMetrics?'':'disabled'}>
    <label><input class="metric-money" type="checkbox" ${m.money?'checked':''} ${canEditMetrics?'':'disabled'}> ₸</label>
    <label><input class="metric-rnp" type="checkbox" ${m.rnp?'checked':''} ${canEditMetrics?'':'disabled'}> РНП</label>
    ${canEditMetrics?'<button type="button" class="delete metric-delete">×</button>':''}
  </div>`).join('') + (canEditMetrics ? `<button type="button" class="metric-add" data-section="${section}">+ Показатель</button>` : '');
}
function renderMarketing(){
  renderMetricSettings('marketing');
  const entities=directionsPure.filter(isDirectionVisible);
  document.getElementById('marketingMatrix').innerHTML=matrixHtml('marketing',entities,marketingMetrics(),{header:'Направление',name:x=>x});
  const s=marketingSummary();
  const budget=s.reduce((a,b)=>a+b.budget,0);
  const impressions=s.reduce((a,b)=>a+b.impressions,0);
  const clicks=s.reduce((a,b)=>a+b.clicks,0);
  const leads=s.reduce((a,b)=>a+b.leads,0);
  document.getElementById('marketingKpis').innerHTML=[
    ['₸','Бюджет',money(budget),`${pct(budget,directionPlanTotal('marketingBudget'))}% от плана`],
    ['◉','Показы',fmt(impressions),`${pct(impressions,directionPlanTotal('impressions'))}% от плана`],
    ['↗','Клики',fmt(clicks),`${pct(clicks,directionPlanTotal('clicks'))}% от плана`],
    ['◎','Лиды',fmt(leads),`${pct(leads,directionPlanTotal('leads'))}% от плана`]
  ].map(x=>kpi(...x)).join('');
  document.getElementById('marketingSummary').innerHTML=s.map(x=>`<tr><td>${x.direction}</td><td>${money(x.planBudget)}</td><td>${money(x.budget)}</td><td>${fmt(x.impressions)}</td><td>${fmt(x.clicks)}</td><td>${fmt(x.leads)}</td><td>${x.cpl?money(x.cpl):'—'}</td><td>${x.ctr}%</td><td>${x.cpc?money(x.cpc):'—'}</td><td>${x.planPct}%</td></tr>`).join('');
}
function renderSales(){
  renderMetricSettings('sales');
  syncSalesWithPlans();
  document.getElementById('salesMatrix').innerHTML=matrixHtml('sales',salesPlanManagers(),salesMetrics(),{header:'Менеджер',name:x=>x});
  const s=salesSummary();
  const leads=s.reduce((a,b)=>a+b.leads,0), calls=s.reduce((a,b)=>a+b.calls,0), app=s.reduce((a,b)=>a+b.appointments,0), checkups=s.reduce((a,b)=>a+b.checkups,0), diagnostics=s.reduce((a,b)=>a+b.diagnostics,0);
  document.getElementById('salesKpis').innerHTML=[
    ['◎','Лиды',fmt(leads),`${pct(leads,salesPlanTotal('leadsPlan'))}% от плана`],
    ['☎','Дозвон',fmt(calls),pct(calls,leads)+'%'],
    ['✓','Чек-апы',fmt(checkups),`${pct(checkups,salesPlanTotal('checkupsPlan'))}% от плана`],
    ['↗','Диагностики',fmt(diagnostics),`${pct(diagnostics,salesPlanTotal('diagnosticsPlan'))}% от плана`]
  ].map(x=>kpi(...x)).join('');
  document.getElementById('salesSummary').innerHTML=s.map(x=>`<tr><td>${x.manager}</td><td>${fmt(x.leads)}</td><td>${fmt(x.calls)}</td><td>${fmt(x.appointments)}</td><td>${fmt(x.checkups)}</td><td>${fmt(x.diagnostics)}</td><td>${fmt(x.totalSales)}</td><td>${money(x.revenue)}</td></tr>`).join('');
}
function renderClinic(){
  const t=totals();
  document.getElementById('clinicKpis').innerHTML=[
    ['⚕','Приёмы',fmt(t.doctorAppointments),'из врачей'],
    ['↗','Продажи',fmt(t.clinicSales),`${pct(t.clinicSales,directionPlanTotal('clinicSales'))}% от плана`],
    ['✦','Доплаты',fmt(t.upsells),'из врачей'],
    ['₸','Выручка',money(t.clinicRevenue),`${pct(t.clinicRevenue,directionPlanTotal('revenue'))}% от плана`]
  ].map(x=>kpi(...x)).join('');
  document.getElementById('clinicAutoTable').innerHTML=clinicAutoSummary().map(x=>`<tr><td>${x.direction}</td><td>${fmt(x.planSales)}</td><td>${fmt(x.sales)}</td><td>${money(x.planRevenue)}</td><td>${money(x.revenue)}</td><td>${fmt(x.appointments)}</td><td>${fmt(x.upsells)}</td><td>${x.planPct}%</td></tr>`).join('');
  renderClinicSalesAnalytics('clinicBars');
}
function renderMetricEditor(containerId, list, section){
  const box = document.getElementById(containerId);
  if(!box) return;
  const can = section === 'doctors' ? canEdit('doctors') : canEdit('plans');
  box.innerHTML = list.map(m=>`<div class="metric-chip" data-section="${section}" data-key="${m.key}">
    <input class="config-metric-label" type="text" value="${m.label}" ${can?'':'disabled'}>
    <label><input class="config-metric-money" type="checkbox" ${m.money?'checked':''} ${can?'':'disabled'}> ₸</label>
    ${section==='plans'?`<label title="Источник факта">Источник <select class="config-metric-source" ${can?'':'disabled'}>
      ${['marketing','clinic','none'].map(s=>`<option value="${s}" ${s===(m.source||'none')?'selected':''}>${s}</option>`).join('')}
    </select></label>`:''}
    ${can?'<button type="button" class="delete config-metric-delete">×</button>':''}
  </div>`).join('') + (can ? `<button type="button" class="metric-add" data-section="${section}">+ Показатель</button>` : '');
}
function renderDoctors(){
  renderMetricEditor('doctorMetricSettings', doctorMetrics(), 'doctors');
  normalizeDoctorsState(state);
  const assignments = state.doctorAssignments.filter(a=>isDirectionVisible(a.direction));
  const keys = assignments.map(a=>a.id);
  document.querySelector('#doctorAssignmentsTable tbody').innerHTML = state.doctorAssignments.map(a=>`<tr data-doctor-assignment="${a.id}">
    <td><input class="doctor-assignment" data-key="name" value="${a.name}"></td>
    <td><input class="doctor-assignment" data-key="direction" value="${a.direction}"></td>
    <td><input class="doctor-assignment" data-key="comment" value="${a.comment||''}" placeholder="Например: печень / похудение"></td>
    <td><button class="delete doctor-assignment-delete" type="button">×</button></td>
  </tr>`).join('');
  document.getElementById('doctorsMatrix').innerHTML=matrixHtml('doctors',keys,doctorMetrics(),{header:'Врач / направление',name:key=>{
    const d=state.doctors[key] || {};
    return `<span class="assignment-name"><b>${d.name || key}</b><small>${d.direction || ''}</small></span>`;
  }});
  document.getElementById('doctorsSummary').innerHTML=doctorSummary().map(d=>`<tr><td>${d.name}</td><td>${d.direction}</td><td>${fmt(d.appointments)}</td><td>${fmt(d.sales)}</td><td>${fmt(d.upsells)}</td><td>${money(d.revenue)}</td><td>${d.conversion}%</td></tr>`).join('');
}
function renderFinance(){
  const rows=financeRows(), approved=rows.filter(x=>x.approved), pending=rows.filter(x=>!x.approved), total=rows.reduce((a,b)=>a+Number(b.amount||0),0);
  document.getElementById('financeKpis').innerHTML=[
    ['₸','Все заявки',protectedExpenseMoney(total),canSeeExpenses()?`${pct(total,financePlanTotal())}% от плана`:'скрыто'],
    ['✓','Одобрено',protectedExpenseMoney(approved.reduce((a,b)=>a+Number(b.amount||0),0)),canSeeExpenses()?'Владимир':'скрыто'],
    ['◌','Ожидает',protectedExpenseMoney(pending.reduce((a,b)=>a+Number(b.amount||0),0)),canSeeExpenses()?'на согласовании':'скрыто'],
    ['◉','Подтв.',canSeeExpenses()?pct(approved.length,rows.length)+'%':'Скрыто',canSeeExpenses()?'доля':'скрыто']
  ].map(x=>kpi(...x)).join('');
  document.querySelector('#financeTable tbody').innerHTML=rows.map(r=>`<tr data-finance="${r.id}">
    <td><input class="finance-field" data-key="date" type="date" value="${r.date}"></td>
    <td><input class="finance-field" data-key="initiator" value="${r.initiator}"></td>
    <td><input class="finance-field" data-key="category" value="${r.category}"></td>
    <td><input class="finance-field" data-key="purpose" value="${r.purpose}"></td>
    <td><input class="finance-field" data-key="amount" type="number" value="${r.amount}"></td>
    <td><select class="finance-field" data-key="status">${['На согласовании','Одобрено','Отклонено','Оплачено'].map(x=>`<option ${x===r.status?'selected':''}>${x}</option>`).join('')}</select></td>
    <td><input class="finance-field" data-key="approved" type="checkbox" ${r.approved?'checked':''}></td>
    <td><input class="finance-field" data-key="comment" value="${r.comment||''}"></td>
    <td><button class="delete finance-delete" type="button">×</button></td>
  </tr>`).join('');
}
function renderKnowledge(){
  document.getElementById('kbList').innerHTML=state.knowledgeDocs.map(d=>`<div class="kb-item" data-id="${d.id}"><div><b>${d.title}</b><div class="kb-meta"><span class="pill">${d.category}</span><span class="pill">${d.fileName}</span></div><div class="muted">${d.description}</div></div><div><button class="secondary kb-open" type="button">Открыть</button> <button class="delete kb-delete" type="button">×</button></div></div>`).join('');
}
function renderUsers(){
  const roles = ['general_director','marketing_director','sales_head','center_coordinator','clinic_director','sales','marketing','clinic','finance','viewer','owner','approver','manager'];
  document.getElementById('usersList').innerHTML=state.users.map(u=>`<div class="user-item user-edit-item" data-id="${u.id}">
    <div class="form user-edit-form">
      <label>Имя<input class="user-field" data-key="name" value="${u.name||''}"></label>
      <label>Email<input class="user-field" data-key="email" value="${u.email||''}"></label>
      <label>Роль<select class="user-field" data-key="role">${roles.map(r=>`<option value="${r}" ${r===(u.role||'viewer')?'selected':''}>${roleNames[r]||r}</option>`).join('')}</select></label>
      <label>Доступ к строке / врачу<input class="user-field" data-key="assignedTo" value="${u.assignedTo||u.assigned_to||''}" placeholder="Мария / Асем Атыгаева"></label>
    </div>
    <div><span class="badge good">${u.role||'viewer'}</span> <button class="delete user-delete" type="button">×</button></div>
  </div>`).join('');
}
function renderControls(){
  const citySelect = document.getElementById('citySelect');
  if(citySelect) citySelect.value=currentCity;
  document.querySelectorAll('.title-block small').forEach(el=>{
    if(el.textContent.includes('AIVA CLINIC')) el.textContent = 'AIVA CLINIC · ' + cityLabel().toUpperCase() + ' · УПРАВЛЕНЧЕСКИЙ КОНТУР';
  });
  document.getElementById('monthSelect').value=monthKeyFromDate(tempFilters.start);
  document.getElementById('startDate').value=tempFilters.start;
  document.getElementById('endDate').value=tempFilters.end;
  document.getElementById('entryDate').value=tempFilters.entryDate;
  document.getElementById('directionFilter').innerHTML=customDirections().map(d=>`<option ${d===tempFilters.direction?'selected':''}>${d}</option>`).join('');
  const user = activeUser();
  document.getElementById('activeAvatar').textContent = initials(user.name || 'Гость');
  document.getElementById('activeUserName').textContent = user.name || 'Гость';
  document.getElementById('activeUserRole').textContent = roleNames[user.role] || user.role || 'viewer';
  document.getElementById('activeUserSelect').innerHTML = cloudEnabled
    ? `<option value="${user.id || ''}">${user.name || user.email}</option>`
    : state.users.map(u=>`<option value="${u.id}" ${u.id===user.id?'selected':''}>${u.name}</option>`).join('');
  applyRoleUi();
}
function renderAll(){
  const renders = [renderControls, renderRnp, renderHome, renderPlans, renderMarketing, renderSales, renderClinic, renderDoctors];
  if(typeof renderRevenue === 'function') renders.push(renderRevenue);
  renders.push(renderFinance, renderKnowledge, renderUsers);
  renders.forEach(fn=>{
    try{ fn(); }
    catch(e){ console.error('Render block failed:', fn.name, e); }
  });
}
function applyRoleUi(){
  document.querySelectorAll('.nav-btn').forEach(btn=>{
    const isLocked = !canView(btn.dataset.view) || (btn.dataset.sensitive === 'finance' && !canAccessFinanceSection());
    btn.classList.toggle('locked', isLocked);
  });
}
function showView(view){
  if(!canView(view) || (view === 'finance' && !canAccessFinanceSection())){
    toast('Нет доступа для роли: ' + (roleNames[activeUser().role] || activeUser().role));
    return;
  }
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const el=document.getElementById('view-'+view); if(el) el.classList.add('active');
  const titles={rnp:'РНП — сводный экран',home:'Главная',plans:'Планы месяца',marketing:'Маркетинг — таблица по дням',sales:'Продажи — чек-апы / диагностики',clinic:'Клиника — из врачей',doctors:'Врачи — основной ввод клиники',finance:'Финансы',knowledge:'База знаний',users:'Сотрудники',settings:'Настройки'};
  document.getElementById('pageTitle').textContent=titles[view]||titles.rnp;
  toggleMobileMenu(false);
  window.scrollTo({top:0,behavior:'smooth'});
}

let kbDb=null;
async function openDb(){return new Promise((res,rej)=>{const req=indexedDB.open('aiva-kb-v7',1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('docs'))db.createObjectStore('docs',{keyPath:'id'});};req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});}
async function db(){if(!kbDb)kbDb=await openDb();return kbDb;}
async function putFile(id,file){const d=await db();return new Promise((res,rej)=>{const tx=d.transaction('docs','readwrite');tx.objectStore('docs').put({id,file});tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}
async function getFile(id){const d=await db();return new Promise((res,rej)=>{const tx=d.transaction('docs','readonly');const req=tx.objectStore('docs').get(id);req.onsuccess=()=>res(req.result?.file||null);req.onerror=()=>rej(req.error);});}
async function delFile(id){const d=await db();return new Promise((res,rej)=>{const tx=d.transaction('docs','readwrite');tx.objectStore('docs').delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}


function getConfig(){
  return window.AIVA_CONFIG || {};
}
function isCloudConfigured(){
  const cfg = getConfig();
  return !!(cfg.ENABLED && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !String(cfg.SUPABASE_URL).includes('ВСТАВЬ'));
}
async function initSupabase(){
  cloudEnabled = isCloudConfigured();
  if(!cloudEnabled){
    document.getElementById('authScreen').style.display='none';
    return false;
  }
  supabaseClient = window.supabase.createClient(getConfig().SUPABASE_URL, getConfig().SUPABASE_ANON_KEY);
  const { data } = await supabaseClient.auth.getSession();
  if(data?.session?.user){
    cloudUser = data.session.user;
    await loadCloudProfile();
    await loadCloudState();
    document.getElementById('authScreen').style.display='none';
    return true;
  }
  document.getElementById('authScreen').style.display='grid';
  return false;
}
async function loginWithPassword(){
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const err = document.getElementById('authError');
  err.textContent = '';
  if(!email || !password){
    err.textContent = 'Введи email и пароль';
    return;
  }
  const { data, error } = await supabaseClient.auth.signInWithPassword({email, password});
  if(error){
    err.textContent = error.message || 'Не получилось войти';
    return;
  }
  cloudUser = data.user;
  await loadCloudProfile();
  await loadCloudState();
  document.getElementById('authScreen').style.display='none';
  renderAll();
  showView('rnp');
  toast('Вход выполнен');
}
async function logout(){
  if(supabaseClient) await supabaseClient.auth.signOut();
  cloudUser = null;
  cloudProfile = null;
  if(cloudEnabled) document.getElementById('authScreen').style.display='grid';
}
async function loadCloudProfile(){
  cloudProfile = null;
  if(!supabaseClient || !cloudUser) return;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', cloudUser.id)
    .maybeSingle();
  if(error) console.warn('Profile load error:', error);
  cloudProfile = data || {
    id: cloudUser.id,
    email: cloudUser.email,
    name: cloudUser.email?.split('@')[0] || 'Пользователь',
    role: 'viewer'
  };
  const exists = state.users?.some(u=>u.id===cloudUser.id);
  if(!exists){
    state.users.push({
      id: cloudUser.id,
      name: cloudProfile.name || cloudProfile.email || 'Пользователь',
      email: cloudProfile.email || cloudUser.email,
      role: cloudProfile.role || 'viewer'
    });
  }
  state.currentUserId = cloudUser.id;
}
async function loadCloudState(){
  if(!supabaseClient || !cloudUser) return;
  const { data, error } = await supabaseClient
    .from('dashboard_state')
    .select('data')
    .eq('id', cityCloudStateId())
    .maybeSingle();

  if(error){
    console.warn('Cloud state load error:', error);
  }

  const isEmptyCloudState = !data?.data || Object.keys(data.data || {}).length === 0;

  if(isEmptyCloudState){
    const fresh = buildDefault();
    state = fresh;
    state.currentUserId = cloudUser.id;

    if(cloudProfile){
      const existing = state.users.find(u => u.email === cloudUser.email || u.id === cloudUser.id) || {};
      const userRow = {
        id: cloudUser.id,
        name: existing.name || cloudProfile.name || cloudUser.email,
        email: existing.email || cloudProfile.email || cloudUser.email,
        role: existing.role || cloudProfile.role || 'viewer',
        assignedTo: existing.assignedTo || existing.assigned_to || ''
      };
      state.users = state.users.filter(u => u.email !== userRow.email && u.id !== userRow.id);
      state.users.unshift(userRow);
    }

    migrateState(state);
    localStorage.setItem(cityStorageKey(), JSON.stringify(state));
    await saveCloudState();
    return;
  }

  state = data.data;
  migrateState(state);
  state.currentUserId = cloudUser.id;

  if(cloudProfile){
    const idx = state.users.findIndex(u=>u.id===cloudUser.id || u.email===cloudUser.email);
    const existing = idx>=0 ? state.users[idx] : {};
    const userRow = {
      id: cloudUser.id,
      name: existing.name || cloudProfile.name || cloudUser.email,
      email: existing.email || cloudProfile.email || cloudUser.email,
      role: existing.role || cloudProfile.role || 'viewer',
      assignedTo: existing.assignedTo || existing.assigned_to || ''
    };
    if(idx>=0) state.users[idx]=userRow;
    else state.users.unshift(userRow);
  }

  localStorage.setItem(cityStorageKey(), JSON.stringify(state));
  await saveCloudState();
}
function currentAreaByView(){
  const active = document.querySelector('.view.active')?.id?.replace('view-','') || 'rnp';
  if(active==='marketing') return 'marketing';
  if(active==='sales') return 'sales';
  if(active==='doctors') return 'doctors';
  if(active==='finance') return 'finance';
  if(active==='plans') return 'plans';
  if(active==='users') return 'users';
  if(active==='knowledge') return 'knowledge';
  return 'view';
}

function toggleMobileMenu(force){
  const app = document.getElementById('appRoot');
  if(!app) return;
  const shouldOpen = typeof force === 'boolean' ? force : !app.classList.contains('menu-open');
  app.classList.toggle('menu-open', shouldOpen);
  document.body.classList.toggle('menu-open', shouldOpen);
}

async function switchCity(newCity){
  if(!newCity || newCity===currentCity) return;
  await saveCloudState();
  localStorage.setItem(cityStorageKey(), JSON.stringify(state));
  currentCity = newCity;
  localStorage.setItem('aiva_current_city', currentCity);
  state = load();
  tempFilters = {...state.filters};
  if(cloudEnabled && cloudUser){
    await loadCloudState();
    tempFilters = {...state.filters};
  }
  renderAll();
  showView('rnp');
  toast('Открыт город: ' + cityLabel());
}

function bind(){
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  document.getElementById('mobileMenuBtn')?.addEventListener('click',()=>toggleMobileMenu());
  document.getElementById('sidebarBackdrop')?.addEventListener('click',()=>toggleMobileMenu(false));
  document.getElementById('citySelect')?.addEventListener('change',e=>switchCity(e.target.value));
  document.getElementById('monthSelect').addEventListener('change',e=>{
    const key=e.target.value;
    tempFilters.start=monthStart(key);
    tempFilters.end=monthEnd(key);
    tempFilters.entryDate=key===todayIso().slice(0,7)?todayIso():monthStart(key);
  });
  document.getElementById('applyMonth').addEventListener('click',()=>{
    state.filters.start=tempFilters.start;
    state.filters.end=tempFilters.end;
    state.filters.entryDate=tempFilters.entryDate;
    state.filters.direction=tempFilters.direction;
    activePlanPack();
    save(false);
    renderAll();
    toast('Месяц открыт');
  });
  document.getElementById('loginBtn').addEventListener('click', loginWithPassword);
  document.getElementById('loginPassword').addEventListener('keydown', e=>{ if(e.key==='Enter') loginWithPassword(); });
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('activeUserSelect').addEventListener('change',e=>{
    if(cloudEnabled){
      toast('В облаке пользователь меняется через вход');
      renderAll();
      return;
    }
    state.currentUserId=e.target.value;
    save(false);
    renderAll();
    showView('rnp');
    toast('Роль применена');
  });
  document.getElementById('startDate').addEventListener('change',e=>tempFilters.start=e.target.value);
  document.getElementById('endDate').addEventListener('change',e=>tempFilters.end=e.target.value);
  document.getElementById('entryDate').addEventListener('change',e=>tempFilters.entryDate=e.target.value);
  document.getElementById('directionFilter').addEventListener('change',e=>tempFilters.direction=e.target.value);
  document.getElementById('applyPeriod').addEventListener('click',()=>{state.filters.start=tempFilters.start;state.filters.end=tempFilters.end;state.filters.direction=tempFilters.direction;save(false);renderAll();toast('Период применён');});
  document.getElementById('todayBtn').addEventListener('click',()=>{const d=todayIso();tempFilters={start:d,end:d,entryDate:d,direction:tempFilters.direction};state.filters={...tempFilters};save(false);renderAll();toast('Сегодня');});
  window.addEventListener('resize',()=>{ if(window.innerWidth > 980) toggleMobileMenu(false); });
  document.getElementById('resetPlansDemo').addEventListener('click',()=>{if(!canEdit('plans')){toast('Нет прав на планы');return;} const fresh=buildDefault();activePlanPack().directionPlans=fresh.directionPlans;activePlanPack().salesPlans=fresh.salesPlans;activePlanPack().financePlans=fresh.financePlans;save();renderAll();});
  document.getElementById('addDirectionPlan').addEventListener('click',()=>{
    if(!canSeeDirectionPlans() || !canEdit('plans')){toast('Нет прав на планы');return;}
    let name = prompt('Название направления');
    if(!name) return;
    name = name.trim();
    if(!name) return;
    if(directionPlans()[name]){toast('Такое направление уже есть');return;}
    directionPlans()[name] = {marketingBudget:0,impressions:0,clicks:0,leads:0,came:0,clinicSales:0,revenue:0,comment:''};
    if(!state.marketing[name]) state.marketing[name] = {};
    save(); renderAll();
  });
  document.getElementById('addSalesPlanRow').addEventListener('click',()=>{
    if(!canEditSalesPlans()){toast('Нет прав на план ОП');return;}
    let baseName = 'Новый менеджер';
    let name = baseName;
    let i = 2;
    while(salesPlans().some(p=>p.manager===name)){ name = baseName + ' ' + i++; }
    salesPlans().push({id:uid(),manager:name,leadsPlan:0,callsPlan:0,appointmentsPlan:0,checkupsPlan:0,diagnosticsPlan:0,revenuePlan:0,comment:''});
    if(!state.sales[name]) state.sales[name] = {};
    save(); renderAll();
  });
  document.getElementById('addFinancePlanRow').addEventListener('click',()=>{
    if(!canSeeFinancePlans()){toast('Нет доступа к плану расходов');return;}
    financePlans().push({id:uid(),category:'Новая статья',amountPlan:0,comment:''});
    save(); renderAll();
  });
  document.getElementById('addDoctorDirection').addEventListener('click',()=>{
    if(!canEdit('doctors')){toast('Нет прав на врачей');return;}
    const name = prompt('ФИО врача');
    if(!name) return;
    const direction = prompt('Направление врача');
    if(!direction) return;
    const key = doctorKey(name, direction);
    if(state.doctors[key]){toast('Такая привязка уже есть');return;}
    state.doctorAssignments.push({id:key,name:name.trim(),direction:direction.trim(),comment:''});
    state.doctors[key] = {name:name.trim(), direction:direction.trim(), dates:{}};
    if(!directionPlans()[direction.trim()]){
      directionPlans()[direction.trim()] = {marketingBudget:0,impressions:0,clicks:0,leads:0,came:0,clinicSales:0,revenue:0,comment:''};
    }
    save(); renderAll();
  });

  document.addEventListener('change',e=>{
    const target=e.target;
    if(target.classList.contains('metric-label')){
      const chip = target.closest('.metric-chip');
      const list = chip.dataset.section === 'marketing' ? marketingMetrics() : salesMetrics();
      const metric = list.find(m=>m.key===chip.dataset.key);
      if(metric){ metric.label=target.value; save(false); renderAll(); }
    }
    if(target.classList.contains('metric-money')){
      const chip = target.closest('.metric-chip');
      const list = chip.dataset.section === 'marketing' ? marketingMetrics() : salesMetrics();
      const metric = list.find(m=>m.key===chip.dataset.key);
      if(metric){ metric.money=target.checked; save(false); renderAll(); }
    }
    if(target.classList.contains('metric-rnp')){
      const chip = target.closest('.metric-chip');
      const list = chip.dataset.section === 'marketing' ? marketingMetrics() : salesMetrics();
      const metric = list.find(m=>m.key===chip.dataset.key);
      if(metric){ metric.rnp=target.checked; save(false); renderAll(); }
    }
    if(target.classList.contains('config-metric-label')){
      const chip = target.closest('.metric-chip');
      const list = chip.dataset.section==='doctors' ? doctorMetrics() : planMetrics();
      const m = list.find(x=>x.key===chip.dataset.key);
      if(m){ m.label=target.value; save(false); renderAll(); }
    }
    if(target.classList.contains('config-metric-money')){
      const chip = target.closest('.metric-chip');
      const list = chip.dataset.section==='doctors' ? doctorMetrics() : planMetrics();
      const m = list.find(x=>x.key===chip.dataset.key);
      if(m){ m.money=target.checked; save(false); renderAll(); }
    }
    if(target.classList.contains('config-metric-source')){
      const chip = target.closest('.metric-chip');
      const m = planMetrics().find(x=>x.key===chip.dataset.key);
      if(m){ m.source=target.value; save(false); renderAll(); }
    }
    if(target.classList.contains('matrix-input')){
      const tr=target.closest('tr');
      if(!canEditEntity(tr.dataset.section, tr.dataset.entity)){ toast('Нет прав на эту строку'); renderAll(); return; }
      setValue(tr.dataset.section,tr.dataset.entity,target.dataset.date,tr.dataset.metric,Number(target.value||0));
      save(false); renderAll();
    }
    if(target.classList.contains('direction-plan')){
      if(!canSeeDirectionPlans() || !canEdit('plans')){ toast('Нет прав на планы'); renderAll(); return; }
      const tr=target.closest('tr'), dir=tr.dataset.planDir, key=target.dataset.key;
      directionPlans()[dir][key]=target.type==='number'?Number(target.value||0):target.value;
      save(false); renderAll();
    }
    if(target.classList.contains('sales-plan')){
      if(!canEditSalesPlans()){ toast('Нет прав на план ОП'); renderAll(); return; }
      const tr=target.closest('tr'), p=salesPlans().find(x=>x.id===tr.dataset.salesPlan), key=target.dataset.key;
      if(p){
        const oldManager = p.manager;
        p[key]=target.type==='number'?Number(target.value||0):target.value;
        if(key==='manager'){
          renameSalesManager(oldManager, p.manager);
        }
        syncSalesWithPlans();
        save(false); renderAll();
      }
    }
    if(target.classList.contains('finance-plan')){
      if(!canSeeFinancePlans()){ toast('Нет доступа к плану расходов'); renderAll(); return; }
      const tr=target.closest('tr'), p=financePlans().find(x=>x.id===tr.dataset.financePlan), key=target.dataset.key;
      if(p){p[key]=target.type==='number'?Number(target.value||0):target.value; save(false); renderAll();}
    }
    if(target.classList.contains('doctor-assignment')){
      if(!canEdit('doctors')){ toast('Нет прав на врачей'); renderAll(); return; }
      const tr=target.closest('tr'), oldId=tr.dataset.doctorAssignment, key=target.dataset.key;
      const row=state.doctorAssignments.find(x=>x.id===oldId);
      if(row){
        row[key]=target.value;
        const newId=doctorKey(row.name,row.direction);
        if(newId!==oldId){
          const oldDoc=state.doctors[oldId] || {dates:{}};
          state.doctors[newId]={name:row.name,direction:row.direction,dates:oldDoc.dates||{}};
          delete state.doctors[oldId];
          row.id=newId;
        }else if(state.doctors[oldId]){
          state.doctors[oldId].name=row.name;
          state.doctors[oldId].direction=row.direction;
        }
        if(!directionPlans()[row.direction]) directionPlans()[row.direction]={marketingBudget:0,impressions:0,clicks:0,leads:0,came:0,clinicSales:0,revenue:0,comment:''};
        save(false); renderAll();
      }
    }
    if(target.classList.contains('user-field')){
      if(!canEdit('users')){ toast('Нет прав на сотрудников'); renderAll(); return; }
      const wrap = target.closest('.user-item');
      const id = wrap?.dataset.id;
      const row = state.users.find(u=>u.id===id);
      if(row){
        row[target.dataset.key] = target.value;
        if(cloudEnabled && supabaseClient && (target.dataset.key==='role' || target.dataset.key==='name' || target.dataset.key==='email')){
          supabaseClient.from('profiles').update({
            name: row.name,
            email: row.email,
            role: row.role || 'viewer'
          }).eq('id', row.id).then(({error})=>{
            if(error) console.warn('Profile update error:', error);
          });
        }
        save(false);
        renderAll();
      }
    }
    if(target.classList.contains('finance-field')){
      if(!canEdit('finance') || !canAccessFinanceSection()){ toast('Нет прав на финансы'); renderAll(); return; }
      const tr=target.closest('tr'), row=state.financeRows.find(x=>x.id===tr.dataset.finance), key=target.dataset.key;
      if(row){row[key]=target.type==='checkbox'?target.checked:(target.type==='number'?Number(target.value||0):target.value); if(key==='approved')row.status=row.approved?'Одобрено':'На согласовании'; save(false); renderAll();}
    }
  });
  document.addEventListener('click',async e=>{
    if(e.target.classList.contains('metric-add')){
      const section = e.target.dataset.section;
      const label = prompt('Название показателя');
      if(!label) return;
      const key = metricKey(label);
      const metric = {key,label:label.trim(),money:false,rnp:true};
      if(section==='marketing') marketingMetrics().push(metric);
      else salesMetrics().push(metric);
      save(); renderAll();
    }
    if(e.target.classList.contains('metric-delete')){
      const chip = e.target.closest('.metric-chip');
      const section = chip.dataset.section;
      const key = chip.dataset.key;
      if(!confirm('Удалить показатель? Данные по нему тоже пропадут из таблиц.')) return;
      if(section==='marketing'){
        state.metricConfig.marketing = marketingMetrics().filter(m=>m.key!==key);
        Object.values(state.marketing||{}).forEach(byDate=>Object.values(byDate||{}).forEach(row=>delete row[key]));
      }else{
        state.metricConfig.sales = salesMetrics().filter(m=>m.key!==key);
        Object.values(state.sales||{}).forEach(byDate=>Object.values(byDate||{}).forEach(row=>delete row[key]));
      }
      save(); renderAll();
    }
    if(e.target.classList.contains('metric-add')){
      const section=e.target.dataset.section;
      const label=prompt('Название показателя');
      if(!label) return;
      if(section==='doctors'){
        const key=uniqueMetricKey(label,doctorMetrics());
        doctorMetrics().push({key,label:label.trim(),money:false});
      }else if(section==='plans'){
        const key=uniqueMetricKey(label,planMetrics());
        planMetrics().push({key,label:label.trim(),money:false,source:'none',responsible:''});
        customDirectionsPure().forEach(dir=>{
          if(!directionPlans()[dir]) directionPlans()[dir]={comment:''};
          if(directionPlans()[dir][key]===undefined) directionPlans()[dir][key]=0;
        });
      }
      save(); renderAll();
    }
    if(e.target.classList.contains('config-metric-delete')){
      const chip=e.target.closest('.metric-chip');
      const section=chip.dataset.section;
      const key=chip.dataset.key;
      if(!confirm('Удалить показатель?')) return;
      if(section==='doctors'){
        state.metricConfig.doctors=doctorMetrics().filter(m=>m.key!==key);
        Object.values(state.doctors||{}).forEach(doc=>Object.values(doc.dates||{}).forEach(row=>delete row[key]));
      }else if(section==='plans'){
        state.metricConfig.planDirections=planMetrics().filter(m=>m.key!==key);
        Object.values(directionPlans()||{}).forEach(row=>delete row[key]);
      }
      save(); renderAll();
    }
    if(e.target.classList.contains('sales-plan-delete')){
      if(!canEditSalesPlans()){toast('Нет прав на план ОП');return;}
      const id=e.target.closest('tr').dataset.salesPlan;
      const row=salesPlans().find(x=>x.id===id);
      if(row && confirm('Удалить менеджера из плана и ежедневного ввода продаж?')){
        removeSalesManagerData(row.manager);
        activePlanPack().salesPlans=salesPlans().filter(x=>x.id!==id);
        save();renderAll();
      }
    }
    if(e.target.classList.contains('finance-plan-delete')){if(!canSeeFinancePlans()){toast('Нет доступа к плану расходов');return;} activePlanPack().financePlans=financePlans().filter(x=>x.id!==e.target.closest('tr').dataset.financePlan);save();renderAll();}
    if(e.target.classList.contains('finance-delete')){if(!canEdit('finance') || !canAccessFinanceSection()){toast('Нет прав на финансы');return;} state.financeRows=state.financeRows.filter(x=>x.id!==e.target.closest('tr').dataset.finance);save();renderAll();}
    if(e.target.classList.contains('doctor-assignment-delete')){if(!canEdit('doctors')){toast('Нет прав на врачей');return;} const id=e.target.closest('tr').dataset.doctorAssignment; state.doctorAssignments=state.doctorAssignments.filter(x=>x.id!==id); delete state.doctors[id]; save();renderAll();}
    if(e.target.classList.contains('user-delete')){if(!canEdit('users')){toast('Нет прав на сотрудников');return;} state.users=state.users.filter(x=>x.id!==e.target.closest('.user-item').dataset.id);save();renderAll();}
    if(e.target.classList.contains('kb-delete')){if(!canEdit('knowledge')){toast('Нет прав на базу знаний');return;} const id=e.target.closest('.kb-item').dataset.id;state.knowledgeDocs=state.knowledgeDocs.filter(x=>x.id!==id);await delFile(id).catch(()=>{});save();renderAll();}
    if(e.target.classList.contains('kb-open')){const id=e.target.closest('.kb-item').dataset.id;const f=await getFile(id).catch(()=>null);if(!f)return alert('В демо сохранены только метаданные. Загрузи реальный файл заново.');const url=URL.createObjectURL(f);window.open(url,'_blank');setTimeout(()=>URL.revokeObjectURL(url),15000);}
  });
  document.getElementById('addPayment').addEventListener('click',()=>{if(!canEdit('finance') || !canAccessFinanceSection()){toast('Нет прав на финансы');return;} state.financeRows.push({id:uid(),date:state.filters.entryDate,initiator:'Рус',category:'Маркетинг',purpose:'',amount:0,status:'На согласовании',approved:false,comment:''});save();renderAll();});
  document.getElementById('addUser').addEventListener('click',async()=>{
    if(!canEdit('users')){toast('Нет прав на сотрудников');return;}
    const name=document.getElementById('userName').value.trim(),
      email=document.getElementById('userEmail').value.trim(),
      role=document.getElementById('userRole').value,
      assignedTo=document.getElementById('userAssignedTo')?.value.trim() || '';
    if(!name||!email)return alert('Заполни имя и email');

    let id = uid();
    if(cloudEnabled && supabaseClient){
      const { data:profile } = await supabaseClient.from('profiles').select('*').eq('email', email).maybeSingle();
      if(profile?.id){
        id = profile.id;
        await supabaseClient.from('profiles').update({name, email, role}).eq('id', profile.id);
      } else {
        alert('Сотрудник сохранится в панели. Чтобы он мог войти на сайт, создай его ещё в Supabase → Authentication → Users с этой же почтой.');
      }
    }

    const existingIndex = state.users.findIndex(u=>u.email===email || u.id===id);
    const row = {id,name,email,role,assignedTo};
    if(existingIndex>=0) state.users[existingIndex]=row;
    else state.users.push(row);

    document.getElementById('userName').value='';
    document.getElementById('userEmail').value='';
    if(document.getElementById('userAssignedTo')) document.getElementById('userAssignedTo').value='';
    save();
    renderAll();
  });

  document.getElementById('uploadKb').addEventListener('click',async()=>{
    if(!canEdit('knowledge')){toast('Нет прав на базу знаний');return;}
    const title=document.getElementById('kbTitle').value.trim(),
      category=document.getElementById('kbCategory').value,
      description=document.getElementById('kbDescription').value.trim(),
      file=document.getElementById('kbFile').files[0];
    if(!title)return alert('Укажи название');
    const id=uid();
    state.knowledgeDocs.push({id,title,category,description,fileName:file?file.name:'Без файла',createdAt:new Date().toISOString()});
    if(file)await putFile(id,file).catch(()=>{});
    document.getElementById('kbTitle').value='';
    document.getElementById('kbDescription').value='';
    document.getElementById('kbFile').value='';
    save();
    renderAll();
  });
}
document.addEventListener('DOMContentLoaded',async()=>{
  await db().catch(()=>{});
  bind();
  await initSupabase();
  renderAll();
});
