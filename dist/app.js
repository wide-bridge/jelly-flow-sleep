import { tracks } from './tracks.js';
import { moods, recommendRoutine, stepPrompt } from './routineContent.js';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const escape = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const KEY = 'sleepApp:v1';
const defaults = () => ({ schemaVersion:1, settings:{volume:.35,playMode:'one',favoriteTrackIds:[],lastTrackId:null,lastRoutineId:null,timerMinutes:0},sessions:[],morningNotes:[],active:null,playback:{trackId:null,position:0,endsAtMs:null} });
const localDate = (date=new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const clock = sec => `${Math.floor(Math.max(0,sec)/60)}:${String(Math.floor(Math.max(0,sec)%60)).padStart(2,'0')}`;
const timeOf = ms => new Date(ms).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
const uuid = () => crypto.randomUUID();
const finite = x => typeof x==='number' && Number.isFinite(x);
const isId = x => typeof x==='string' && x.length>0 && x.length<=160;
const iso = x => typeof x==='string' && Number.isFinite(Date.parse(x));
const isDate = x => typeof x==='string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x));
const allowedMood = x => typeof x==='string' && Object.hasOwn(moods,x);
const validTrack = x => x===null || isId(x);
function validateData(value) {
  if (!value || value.schemaVersion!==1 || !value.settings || !Array.isArray(value.sessions) || !Array.isArray(value.morningNotes)) throw new Error('지원하지 않는 기록 형식입니다.');
  const s=value.settings;
  if (!finite(s.volume)||s.volume<0||s.volume>1||!['one','all','repeat'].includes(s.playMode)||!Array.isArray(s.favoriteTrackIds)||s.favoriteTrackIds.some(x=>!isId(x))) throw new Error('설정 데이터가 올바르지 않습니다.');
  if(value.sessions.length>10000 || value.morningNotes.length>10000) throw new Error('기록 개수가 너무 많습니다.');
  const ids=new Set();
  for(const r of value.sessions) {
    if(!r || !isId(r.id)||ids.has(r.id)||!isDate(r.localDate)||!allowedMood(r.mood)||![5,10,15].includes(r.plannedMinutes)||!isId(r.routineId)||!validTrack(r.trackId)||!iso(r.startedAt)||!iso(r.endedAt)||Date.parse(r.endedAt)<Date.parse(r.startedAt)||!['completed','interrupted'].includes(r.status)||(r.completionSource!==undefined&&!['observed','recovered'].includes(r.completionSource))) throw new Error('밤 기록의 필드를 확인해 주세요.');
    ids.add(r.id);
  }
  const noteIds=new Set();
  for(const n of value.morningNotes) {
    if(!n||!isId(n.id)||noteIds.has(n.id)||!ids.has(n.sessionId)||!isDate(n.localDate)||!['unknown','quick','medium','slow'].includes(n.sleepOnsetFeel)||!['unknown','none','some','often'].includes(n.nightWakings)||![1,2,3,4,5].includes(n.morningFeel)||typeof n.note!=='string'||n.note.length>500) throw new Error('아침 기록의 필드를 확인해 주세요.');
    noteIds.add(n.id);
  }
  if(value.active) {
    const a=value.active;
    if(!isId(a.id)||ids.has(a.id)||!allowedMood(a.mood)||![5,10,15].includes(a.minutes)||!finite(a.startedAtMs)||!finite(a.endsAtMs)||a.endsAtMs-a.startedAtMs!==a.minutes*60000||!validTrack(a.trackId)||!Number.isInteger(a.stageIndex)||a.stageIndex<0||!finite(a.stageStartedAtMs)||!finite(a.stageEndsAtMs)||a.stageStartedAtMs<a.startedAtMs||a.stageEndsAtMs>a.endsAtMs||a.stageEndsAtMs<a.stageStartedAtMs) throw new Error('진행 중인 루틴 정보가 올바르지 않습니다.');
    if(a.stageIndex>=recommendRoutine({mood:a.mood,minutes:a.minutes}).steps.length) throw new Error('루틴 단계가 올바르지 않습니다.');
  }
  if(value.playback && (!validTrack(value.playback.trackId)||!finite(value.playback.position)||value.playback.position<0||(value.playback.endsAtMs!==null&&!finite(value.playback.endsAtMs)))) throw new Error('플레이어 정보가 올바르지 않습니다.');
  if(s.lastTrackId!==undefined&&!validTrack(s.lastTrackId)) throw new Error('최근 곡 정보가 올바르지 않습니다.');
  if(s.timerMinutes!==undefined&&![0,5,10,15,30,60].includes(s.timerMinutes)) throw new Error('타이머 정보가 올바르지 않습니다.');
  return { ...defaults(), ...value, settings:{...defaults().settings,...s},playback:{...defaults().playback,...value.playback} };
}
let data=defaults(), saveBlocked=false, rawBackup=null;
try { const raw=localStorage.getItem(KEY); if(raw){rawBackup=raw;data=validateData(JSON.parse(raw));} } catch(e) { saveBlocked=true; $('#storage-banner').hidden=false; $('#storage-banner span').textContent='이전 기록을 읽지 못했습니다. 원본은 보존되어 있습니다.'; }
function save() {
  if(saveBlocked) return false;
  try { localStorage.setItem(KEY,JSON.stringify(data)); $('#storage-banner').hidden=true; return true; }
  catch(e) { $('#storage-banner').hidden=false; $('#storage-banner span').textContent='저장되지 않았습니다. 현재 화면의 기록을 내보낼 수 있어요.'; return false; }
}
let toastTimeout;
function toast(message) { const box=$('#toast');box.textContent=message;box.hidden=false;if(box.showPopover&&!box.matches(':popover-open'))box.showPopover();clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{if(box.hidePopover&&box.matches(':popover-open'))box.hidePopover();box.hidden=true;},4000); }
const audio=$('#audio');
let selectedTrack=tracks.find(t=>t.id===data.settings.lastTrackId)||tracks[0]||null;
let currentTab='tonight', mood='tense', minutes=10, playerState='idle', selectedOnly=false, routineScreen='preview', editingSession=null;
const lastRoutine = typeof data.settings.lastRoutineId==='string' ? data.settings.lastRoutineId.match(/^(busy-mind|tense|noise|calm)-(5|10|15)$/) : null;
if(lastRoutine){mood=lastRoutine[1];minutes=Number(lastRoutine[2]);}
let restorePosition=0, playRequest=0, lastPersisted=0, confirmResolve=null;
const failedTracks=new Set();
const durations=new Map();
const durationOf = t => durations.get(t.id)||t.durationHintSec||0;
const activePlan = () => data.active ? recommendRoutine({mood:data.active.mood,minutes:data.active.minutes}) : null;
function showDialog(id) { for(const d of $$('dialog[open]'))d.close(); const d=$(`#${id}`);if(!d.open)d.showModal(); }
function confirmAction(title,message) { $('#confirm-title').textContent=title;$('#confirm-message').textContent=message;showDialog('confirm-dialog');return new Promise(resolve=>{confirmResolve=resolve;}); }
function resolveConfirm(result) { $('#confirm-dialog').close();const resolve=confirmResolve;confirmResolve=null;resolve?.(result); }
$('#confirm-ok').onclick=()=>resolveConfirm(true);$('#confirm-cancel').onclick=()=>resolveConfirm(false);
$('#confirm-dialog').addEventListener('cancel',()=>resolveConfirm(false));
for(const button of $$('[data-close]')) button.onclick=()=>button.closest('dialog').close();
function goTab(tab) {
  if(!['tonight','sounds','journal'].includes(tab))return;
  currentTab=tab;for(const view of $$('.view'))view.hidden=view.id!==tab;
  for(const b of $$('.bottom-nav [data-tab]')) {if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
  if(tab==='journal')renderJournal();if(tab==='sounds')renderTracks();window.scrollTo({top:0,behavior:'instant'});
}
for(const b of $$('[data-tab]'))b.onclick=()=>goTab(b.dataset.tab);
$('.brand').onclick=e=>{e.preventDefault();goTab('tonight');};
function updateSelection() {
  for(const b of $$('#moods button'))b.setAttribute('aria-pressed',String(b.dataset.mood===mood));
  for(const b of $$('#minutes button'))b.setAttribute('aria-pressed',String(Number(b.dataset.minutes)===minutes));
  $('#hero-minutes').textContent=`${minutes}분`;$('#quick-start span').textContent=`지금 ${minutes}분 쉬기`;
  const copy={ 'busy-mind':['생각은 잠시,\n흘려보내도 좋아요.','복잡한 마음에서 편안한 감각으로'],tense:['힘을 놓고,\n고요함에 머물러요.','자연스러운 호흡부터 편안한 이완까지'],noise:['익숙한 선율에,\n마음을 맡겨요.','바깥의 소리에서 나만의 쉼으로'],calm:['아무것도 하지 않는,\n편안한 시간.','지금의 평온함을 조금 더 이어가요'] };
  $('#hero-title').textContent=copy[mood][0];$('#hero-title').style.whiteSpace='pre-line';$('#hero-description').textContent=copy[mood][1];
}
for(const b of $$('#moods button'))b.onclick=()=>{mood=b.dataset.mood;updateSelection();};
for(const b of $$('#minutes button'))b.onclick=()=>{minutes=Number(b.dataset.minutes);updateSelection();};
$('#wake-time').onchange=()=>{const value=$('#wake-time').value;if(!value){$('#wake-hint').textContent='';return;}const [h,m]=value.split(':').map(Number);const date=new Date();date.setHours(h,m,0,0);if(date.getTime()<=Date.now())date.setDate(date.getDate()+1);const left=Math.ceil((date-Date.now())/60000);$('#wake-hint').textContent=`기상 목표까지 약 ${Math.floor(left/60)}시간 ${left%60}분 남았어요.`;};

function renderRoutinePreview() {
  if(data.active){openActive();return;}
  routineScreen='preview';const plan=recommendRoutine({mood,minutes,wakeTime:$('#wake-time').value});
  $('#routine-body').innerHTML=`<h2>${minutes}분, 나를 위한 쉼.</h2><p class="muted">${plan.reason}</p><ol class="routine-steps">${plan.steps.map((s,i)=>`<li><span class="step-number">${i+1}</span><span class="step-copy"><strong>${s.title}</strong><small>${s.kind==='release'?'힘을 주지 않고, 편안한 만큼만':s.kind==='settle'?'속도를 맞추지 않아도 괜찮아요':'애쓰지 않고 천천히'}</small></span><span class="step-duration">${s.durationSec/60}분</span></li>`).join('')}</ol><label class="routine-music">함께 들을 음악<select id="routine-track">${tracks.filter(t=>t.useInRoutine).map(t=>`<option value="${escape(t.id)}" ${t.id===selectedTrack?.id?'selected':''}>${escape(t.title)}</option>`).join('')}<option value="">음악 없이, 조용히 쉬기</option></select></label><button id="start-routine" class="primary wide">${icon('play')} ${minutes}분 루틴 시작</button><button id="start-quiet" class="text-button quiet-link">음악 없이 시작</button><p class="muted fine-print">불편한 안내는 언제든 건너뛸 수 있어요.</p>`;
  $('#start-routine').onclick=()=>startRoutine($('#routine-track').value||null);$('#start-quiet').onclick=()=>startRoutine(null);
  showDialog('routine-dialog');
}
function startRoutine(trackId) {
  if(data.active){openActive();return;}
  const plan=recommendRoutine({mood,minutes});const now=Date.now();
  data.active={id:uuid(),mood,minutes,trackId,startedAtMs:now,endsAtMs:now+minutes*60000,stageIndex:0,stageStartedAtMs:now,stageEndsAtMs:now+plan.steps[0].durationSec*1000};
  data.playback.endsAtMs=null;data.settings.lastRoutineId=plan.id;
  if(trackId){const t=tracks.find(t=>t.id===trackId);if(t){loadTrack(t);playAudio();}else stopAudio(false);}
  else stopAudio(false);
  save();openActive();updateMini();
}
function openActive() {
  if(!data.active)return;
  tick();if(!data.active)return;
  routineScreen='active';$('#routine-body').innerHTML=`<div class="session-stage"><span class="stage-name" id="stage-name"></span><div class="stage-circle"><strong id="routine-left"></strong><span>남은 쉼</span></div><div class="stage-prompt" id="stage-prompt"></div><div class="stage-progress" id="stage-progress"></div><p class="muted" id="stage-position"></p><button id="skip-stage" class="secondary wide">이 안내 건너뛰기</button><button id="routine-player" class="text-button wide">음악과 타이머 보기</button><button id="end-routine" class="text-button danger wide">오늘은 여기까지 쉬기</button></div>`;
  $('#skip-stage').onclick=skipStage;$('#routine-player').onclick=openPlayer;$('#end-routine').onclick=async()=>{if(await confirmAction('쉼을 마칠까요?','음악을 멈추고 지금까지의 시간을 기록해요.'))finishRoutine('interrupted','observed');else openActive();};
  showDialog('routine-dialog');renderStage();
}
function renderStage() {
  const a=data.active;if(!a||routineScreen!=='active'||!$('#routine-left'))return;
  const plan=activePlan(),step=plan.steps[a.stageIndex];
  $('#routine-left').textContent=clock(Math.ceil((a.endsAtMs-Date.now())/1000));
  $('#stage-name').textContent=step.title;
  let prompt=stepPrompt(step,(Date.now()-a.stageStartedAtMs)/1000);
  if(step.kind==='imagine'&&Date.now()-a.stageStartedAtMs>25000)prompt='떠오른 장면에 잠시 머물러요.\n화면은 내려놓아도 괜찮아요.';
  if(step.kind==='listen'&&(!a.trackId||audio.ended||playerState==='error'))prompt='고요함 속에 머물러도 좋아요.\n화면은 내려놓아도 괜찮아요.';
  $('#stage-prompt').textContent=prompt;
  $('#stage-position').textContent=`${a.stageIndex+1} / ${plan.steps.length} 단계 · ${timeOf(a.endsAtMs)}에 루틴과 음악이 끝나요`;
  $('#stage-progress').innerHTML=plan.steps.map((_,i)=>`<span class="${i<=a.stageIndex?'active':''}"></span>`).join('');
  $('#skip-stage').hidden=!step.skippable || a.stageIndex>=plan.steps.length-1;
  $('#routine-player').textContent=a.trackId?'음악과 타이머 보기':'음악 선택하기';
}
function advanceStage(at) {
  const a=data.active,plan=activePlan();if(!a||a.stageIndex>=plan.steps.length-1)return;
  a.stageIndex++;a.stageStartedAtMs=at;a.stageEndsAtMs=a.stageIndex===plan.steps.length-1?a.endsAtMs:Math.min(a.endsAtMs,at+plan.steps[a.stageIndex].durationSec*1000);save();
}
function skipStage(){if(!data.active)return;advanceStage(Date.now());renderStage();toast('남은 시간은 음악 또는 고요한 쉼으로 이어져요.');}
function finishRoutine(status,source) {
  const a=data.active;if(!a)return;
  const session={id:a.id,localDate:localDate(new Date(a.startedAtMs)),mood:a.mood,plannedMinutes:a.minutes,routineId:`${a.mood}-${a.minutes}`,trackId:a.trackId,startedAt:new Date(a.startedAtMs).toISOString(),endedAt:new Date(status==='completed'?a.endsAtMs:Date.now()).toISOString(),status,completionSource:source};
  data.sessions.push(session);data.active=null;data.playback.endsAtMs=null;stopAudio(false);const saved=save();routineScreen='complete';
  $('#routine-body').innerHTML=`<div class="complete-content"><span class="complete-mark">☾</span><h2>${status==='completed'?'오늘의 쉼을 마쳤어요.':'오늘은 여기까지, 괜찮아요.'}</h2><p class="muted">잠들지 않았어도 괜찮아요.<br>나를 위해 잠시 멈춘 시간이니까요.</p><p class="muted">${saved?'오늘 밤의 루틴을 기록했어요.':'기록을 저장하지 못했어요. 기록 화면에서 내보낼 수 있어요.'}</p><button id="complete-close" class="primary wide">편안한 밤 보내기</button><button id="complete-journal" class="text-button wide">기록 보기</button><p class="muted">아침에 돌아와 느낌을 남겨 주세요.</p></div>`;
  $('#complete-close').onclick=()=>$('#routine-dialog').close();$('#complete-journal').onclick=()=>{$('#routine-dialog').close();goTab('journal');};
  showDialog('routine-dialog');updateMini();renderJournal();
}
function tick(source='observed') {
  const now=Date.now();if(data.active) {
    if(now>=data.active.endsAtMs){finishRoutine('completed',source);return;}
    const plan=activePlan();while(data.active.stageIndex<plan.steps.length-1&&now>=data.active.stageEndsAtMs)advanceStage(data.active.stageEndsAtMs);
    renderStage();
  }
  if(data.playback.endsAtMs&&now>=data.playback.endsAtMs){data.playback.endsAtMs=null;stopAudio(false);save();toast('음악 타이머가 끝나 재생을 멈췄어요.');}
  updateMini();updateTimerDescription();
}

function loadTrack(track) {
  playRequest++;audio.pause();selectedTrack=track;restorePosition=0;playerState='idle';audio.src=track.src;audio.load();data.playback.trackId=track.id;data.playback.position=0;
  $('#player-title').textContent=track.title;$('#player-artist').textContent=track.artist;$('#seek').max=durationOf(track);$('#total').textContent=clock(durationOf(track));$('#elapsed').textContent='0:00';$('#seek').value=0;
  if(data.active)data.active.trackId=track.id;
  if('mediaSession' in navigator && 'MediaMetadata' in window)navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:'Jelly flow · 젤리 플로우'});
  updateFavorite();updatePlayerUI();
}
async function playAudio() {
  if(!selectedTrack){toast('등록된 음악이 없어요. 음악 없이 루틴을 시작할 수 있어요.');return;}
  tick();const request=++playRequest;
  if(data.active)data.active.trackId=selectedTrack.id;
  if(!audio.src||audio.error){const p=data.playback.position||0;audio.src=selectedTrack.src;audio.load();restorePosition=p;}
  if(audio.ended)audio.currentTime=0;
  playerState='loading';updatePlayerUI();
  try { await audio.play();if(request!==playRequest)return;failedTracks.delete(selectedTrack.id);playerState='playing';data.settings.lastTrackId=selectedTrack.id;save();updatePlayerUI(); }
  catch(error) {if(request!==playRequest||error.name==='AbortError')return;playerState='error';updatePlayerUI();$('#audio-status').textContent=error.name==='NotAllowedError'?'재생을 눌러 다시 시작해 주세요. 루틴은 계속 진행돼요.':'음악을 재생하지 못했어요. 재생을 눌러 다시 시도하거나 음악 없이 쉬어도 좋아요.';toast($('#audio-status').textContent);}
}
function pauseAudio(){playRequest++;audio.pause();playerState='paused';data.playback.position=Number.isFinite(audio.currentTime)?audio.currentTime:0;save();updatePlayerUI();}
function toggleAudio(){if(!audio.paused)pauseAudio();else playAudio();}
function stopAudio(persist=true){playRequest++;audio.pause();try{audio.currentTime=0;}catch{}playerState='stopped';data.playback.position=0;if(persist)save();updatePlayerUI();}
function changeTrack(direction,auto=false){if(!tracks.length)return;const index=tracks.findIndex(t=>t.id===selectedTrack?.id);let next=index+direction;if(auto&&next>=tracks.length){playerState='ended';updatePlayerUI();return;}next=(next+tracks.length)%tracks.length;loadTrack(tracks[next]);playAudio();renderTracks();}
function openPlayer(){if(!selectedTrack){toast('등록된 음악이 없습니다. 음악 없이 루틴을 진행해 주세요.');return;}showDialog('player-dialog');updatePlayerUI();updateTimerDescription();}
function updatePlayerUI(){
  const isPlaying=!audio.paused&&!audio.ended;
  for(const id of ['play-toggle','mini-toggle']){const b=$(`#${id}`);b.innerHTML=icon(isPlaying?'pause':'play');b.setAttribute('aria-label',isPlaying?'일시정지':'재생');}
  $('#audio-status').textContent={idle:'재생을 눌러 시작하세요',loading:'음악을 불러오고 있어요…',playing:'재생 중',paused:'일시정지 · 타이머는 계속 진행돼요',ended:'곡이 끝났어요',stopped:'음악이 멈췄어요',error:'음악을 불러오지 못했어요. 재생을 눌러 다시 시도해 주세요.'}[playerState];
  $('#last-track').hidden=!data.settings.lastTrackId;$('#player-routine').hidden=!data.active;
  updateMini();if(currentTab==='sounds')renderTracks();
}
function updateMini(){
  const active=data.active;const visible=Boolean(active||data.playback.endsAtMs||['playing','paused','loading','error'].includes(playerState));$('#mini-player').hidden=!visible;
  $('#mini-title').textContent=active&&!active.trackId?'나를 위한 고요한 쉼':selectedTrack?.title||'고요하게 쉬기';
  const end=active?.endsAtMs||data.playback.endsAtMs;
  $('#mini-status').textContent=`${active?'루틴 진행 중':{playing:'재생 중',paused:'일시정지',loading:'불러오는 중',error:'재생 다시 시도',ended:'음악 종료',stopped:'음악 정지',idle:'재생 준비'}[playerState]}${end?' · '+clock(Math.ceil(Math.max(0,end-Date.now())/1000))+' 남음':''}`;
  $('#mini-toggle').hidden=Boolean(active&&!active.trackId)||!selectedTrack;
  $('#resume-routine').hidden=!active;if(active)$('#resume-time').textContent=clock(Math.ceil((active.endsAtMs-Date.now())/1000));
}
function updateTimerDescription(){const end=data.active?.endsAtMs||data.playback.endsAtMs;$('#music-timer').disabled=Boolean(data.active);$('#timer-description').textContent=end?`${timeOf(end)}에 ${data.active?'루틴과 음악':'음악 재생'}이 끝나요. ${clock(Math.ceil(Math.max(0,end-Date.now())/1000))} 남음`:'별도 타이머 없음 · 선택한 재생 방식에 따라 음악이 끝나요.';$('#music-timer').value=data.active?'routine':String(data.playback.endsAtMs?data.settings.timerMinutes:0);}
function updateFavorite(){const isFav=selectedTrack&&data.settings.favoriteTrackIds.includes(selectedTrack.id);$('#favorite').setAttribute('aria-pressed',String(Boolean(isFav)));$('#favorite').setAttribute('aria-label',isFav?'즐겨찾기 해제':'즐겨찾기에 추가');}
function toggleFavorite(id){const list=data.settings.favoriteTrackIds;const index=list.indexOf(id);if(index>=0)list.splice(index,1);else list.push(id);if(save())toast(index>=0?'즐겨찾기를 해제했어요.':'즐겨찾기에 저장했어요.');else toast('즐겨찾기가 저장되지 않았어요.');updateFavorite();renderTracks();}
function renderTracks(){
  const shown=tracks.filter(t=>!selectedOnly||data.settings.favoriteTrackIds.includes(t.id));const root=$('#track-list');root.replaceChildren();
  if(!shown.length){root.innerHTML=`<div class="empty-state">${icon('sound')}<h2>${tracks.length?'아직 담아 둔 음악이 없어요.':'아직 등록된 음악이 없어요.'}</h2><p>${tracks.length?'좋아하는 곡의 하트를 눌러 보세요.':'음악 없이도 편안한 루틴을 시작할 수 있어요.'}</p><button class="secondary" id="empty-music-action">${tracks.length?'전체 음악 보기':'음악 없이 루틴 시작'}</button></div>`;$('#empty-music-action').onclick=()=>{if(tracks.length){selectedOnly=false;$('#favorites-filter').setAttribute('aria-pressed','false');renderTracks();}else renderRoutinePreview();};return;}
  for(const t of shown){const card=document.createElement('article');card.className='music-card';card.style.marginBottom='18px';const fav=data.settings.favoriteTrackIds.includes(t.id);const selected=t.id===selectedTrack?.id;
    card.innerHTML=`<button class="music-select" aria-label="${escape(t.title)} 상세 보기"><div class="music-cover"><div class="flow-art" aria-hidden="true"><div class="glow"></div><div class="ripple r1"></div><div class="ripple r2"></div><div class="ripple r3"></div></div><span class="cover-caption">A softer<br>kind of night.</span></div></button><div class="music-card-body"><div class="music-card-row"><h2>${escape(t.title)}</h2><span class="track-selected">${failedTracks.has(t.id)?'재생 실패':selected?(playerState==='playing'?'재생 중':'선택됨 ✓'):''}</span></div><p>자장가 · ${clock(durationOf(t))} · ${escape(t.artist)}</p><div class="music-actions"><button class="primary music-play">${icon(selected&&!audio.paused?'pause':'play')}${selected&&!audio.paused?'일시정지':'음악 듣기'}</button><button class="icon-button music-fav" aria-label="${fav?'즐겨찾기 해제':'즐겨찾기에 추가'}" aria-pressed="${fav}">${icon('heart')}</button></div></div>`;
    $('.music-select',card).onclick=()=>{if(!selected)loadTrack(t);openPlayer();};$('.music-play',card).onclick=()=>{if(!selected)loadTrack(t);toggleAudio();};$('.music-fav',card).onclick=()=>toggleFavorite(t.id);root.append(card);
  }
}
audio.addEventListener('loadedmetadata',()=>{if(!selectedTrack||!Number.isFinite(audio.duration))return;durations.set(selectedTrack.id,audio.duration);$('#seek').max=audio.duration;$('#total').textContent=clock(audio.duration);if(restorePosition>0){audio.currentTime=Math.min(restorePosition,audio.duration);restorePosition=0;}renderTracks();});
audio.addEventListener('timeupdate',()=>{$('#elapsed').textContent=clock(audio.currentTime);$('#seek').value=Number.isFinite(audio.currentTime)?audio.currentTime:0;if(Date.now()-lastPersisted>5000){data.playback.position=Number.isFinite(audio.currentTime)?audio.currentTime:0;save();lastPersisted=Date.now();}});
audio.addEventListener('playing',()=>{playerState='playing';updatePlayerUI();});
audio.addEventListener('pause',()=>{if(playerState==='playing'){playerState='paused';updatePlayerUI();}});
audio.addEventListener('waiting',()=>{if(!audio.paused){playerState='loading';updatePlayerUI();}});
audio.addEventListener('error',()=>{if(!selectedTrack)return;failedTracks.add(selectedTrack.id);playerState='error';data.playback.position=Number.isFinite(audio.currentTime)?audio.currentTime:0;save();updatePlayerUI();toast('음악 파일을 불러오지 못했어요. 음악 없이도 루틴은 계속돼요.');if(data.settings.playMode==='all'&&tracks.length>1){const remaining=tracks.slice(tracks.indexOf(selectedTrack)+1).find(t=>!failedTracks.has(t.id));if(remaining){loadTrack(remaining);playAudio();}}});
audio.addEventListener('ended',()=>{const activeBefore=data.active;const timedBefore=data.playback.endsAtMs;tick();if((activeBefore&&!data.active)||(timedBefore&&!data.playback.endsAtMs))return;data.playback.position=0;if(data.settings.playMode==='repeat')playAudio();else if(data.settings.playMode==='all')changeTrack(1,true);else{playerState='ended';save();updatePlayerUI();}});
$('#play-toggle').onclick=toggleAudio;$('#mini-toggle').onclick=toggleAudio;$('#stop-audio').onclick=()=>stopAudio();$('#previous').onclick=()=>changeTrack(-1);$('#next').onclick=()=>changeTrack(1);
$('#seek').oninput=()=>{if(Number.isFinite(audio.duration)){audio.currentTime=Number($('#seek').value);data.playback.position=audio.currentTime;save();}};
$('#volume').value=data.settings.volume;audio.volume=data.settings.volume;$('#volume-value').textContent=`${Math.round(audio.volume*100)}%`;
$('#volume').oninput=()=>{audio.volume=Number($('#volume').value);data.settings.volume=audio.volume;$('#volume-value').textContent=`${Math.round(audio.volume*100)}%`;save();};
$('#play-mode').value=data.settings.playMode;$('#play-mode').onchange=()=>{data.settings.playMode=$('#play-mode').value;save();};
$('#music-timer').onchange=()=>{const value=Number($('#music-timer').value);data.settings.timerMinutes=value;data.playback.endsAtMs=value?Date.now()+value*60000:null;save();updateTimerDescription();updateMini();};
$('#favorite').onclick=()=>selectedTrack&&toggleFavorite(selectedTrack.id);$('#favorites-filter').onclick=()=>{selectedOnly=!selectedOnly;$('#favorites-filter').setAttribute('aria-pressed',String(selectedOnly));renderTracks();};
$('#home-track').onclick=()=>{if(!selectedTrack&&tracks.length)loadTrack(tracks[0]);openPlayer();};$('#last-track').onclick=()=>{playAudio();openPlayer();};
$('#mini-open').onclick=()=>data.active?openActive():openPlayer();$('#player-routine').onclick=openActive;$('#resume-routine').onclick=openActive;
$('#quick-start').onclick=()=>startRoutine(selectedTrack?.id||null);$('#routine-preview').onclick=renderRoutinePreview;

const feelings={1:'많이 피곤해요',2:'조금 피곤해요',3:'보통이에요',4:'괜찮아요',5:'개운해요'};
const onset={unknown:'입면 느낌 모름',quick:'금방 잠든 느낌',medium:'조금 걸린 느낌',slow:'오래 걸린 느낌'};
const waking={unknown:'밤중 깸 기억 안 남',none:'깨지 않음',some:'한두 번 깸',often:'여러 번 깸'};
function renderJournal(){
  const summary=$('#journal-summary'),list=$('#session-list');summary.replaceChildren();list.replaceChildren();
  const sessions=[...data.sessions].sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt));
  if(!sessions.length){summary.innerHTML=`<div class="empty-state card">${icon('moon')}<h2>당신의 첫 번째 밤을 기다려요.</h2><p>짧은 루틴으로 하루를 마무리하고,<br>아침의 느낌을 가볍게 남겨 보세요.</p><button class="primary" id="journal-start">오늘 밤 시작하기</button></div>`;$('#journal-start').onclick=()=>goTab('tonight');return;}
  const latest=sessions[0],note=data.morningNotes.find(n=>n.sessionId===latest.id);
  summary.innerHTML=`<div class="summary-card card"><span class="eyebrow">YOUR LAST MOMENT OF REST</span><h2>${note?'아침의 느낌을 남겼어요.':'지난 쉼은 어떠셨나요?'}</h2><p>${note?escape(feelings[note.morningFeel]):'다음 날, 기억나는 느낌만 남겨 보세요.'}</p><button id="latest-note" class="secondary">${note?'아침 기록 수정':'아침 기록 남기기'}</button></div><div class="section-heading"><h2>차곡차곡, 나의 밤</h2><span>${sessions.length}번의 쉼</span></div>`;$('#latest-note').onclick=()=>openNote(latest.id);
  for(const r of sessions){const n=data.morningNotes.find(n=>n.sessionId===r.id);const row=document.createElement('article');row.className='session-card';const actual=Math.max(1,Math.round((Date.parse(r.endedAt)-Date.parse(r.startedAt))/60000));
    row.innerHTML=`<div class="session-head"><h3>${escape(new Date(r.startedAt).toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'}))} · ${escape(timeOf(Date.parse(r.startedAt)))}</h3><span class="status-pill">${r.status==='completed'?'루틴 완료':'여기까지 쉼'}</span></div><p class="session-meta">${moods[r.mood]} · ${r.status==='completed'?r.plannedMinutes:actual}분의 쉼</p>${n?`<p class="note-content">${escape(feelings[n.morningFeel])} · ${escape(onset[n.sleepOnsetFeel])}<br>${escape(waking[n.nightWakings])}${n.note?'<br>'+escape(n.note):''}</p><p class="session-meta">아침 기록 · ${escape(n.localDate)}</p>`:''}<div class="session-actions"><button class="text-button edit-note">${n?'아침 기록 수정':'아침 기록 남기기'}</button>${n?'<button class="text-button danger delete-note">아침 기록 삭제</button>':''}<button class="text-button danger delete-session">밤 기록 삭제</button></div>`;
    $('.edit-note',row).onclick=()=>openNote(r.id);$('.delete-session',row).onclick=async()=>{if(await confirmAction('이 밤의 기록을 삭제할까요?','연결된 아침 기록도 함께 삭제됩니다.')){data.sessions=data.sessions.filter(s=>s.id!==r.id);data.morningNotes=data.morningNotes.filter(x=>x.sessionId!==r.id);const ok=save();renderJournal();toast(ok?'기록을 삭제했어요.':'삭제 내용을 저장하지 못했어요.');}};
    if(n)$('.delete-note',row).onclick=async()=>{if(await confirmAction('아침 기록을 삭제할까요?','밤의 루틴 기록은 남아 있어요.')){data.morningNotes=data.morningNotes.filter(x=>x.id!==n.id);const ok=save();renderJournal();toast(ok?'아침 기록을 삭제했어요.':'삭제 내용을 저장하지 못했어요.');}};
    list.append(row);
  }
}
function openNote(sessionId){editingSession=sessionId;const n=data.morningNotes.find(x=>x.sessionId===sessionId);const form=$('#note-form');form.reset();if(n)for(const key of ['sleepOnsetFeel','nightWakings','morningFeel','note'])form.elements[key].value=n[key];showDialog('note-dialog');}
$('#note-form').onsubmit=e=>{e.preventDefault();if(!data.sessions.some(s=>s.id===editingSession))return;const form=e.currentTarget;const old=data.morningNotes.find(n=>n.sessionId===editingSession);const note={id:old?.id||uuid(),sessionId:editingSession,localDate:old?.localDate||localDate(),sleepOnsetFeel:form.elements.sleepOnsetFeel.value,nightWakings:form.elements.nightWakings.value,morningFeel:Number(form.elements.morningFeel.value),note:form.elements.note.value.trim().slice(0,500)};data.morningNotes=data.morningNotes.filter(n=>n.sessionId!==editingSession);data.morningNotes.push(note);const ok=save();renderJournal();if(ok){$('#note-dialog').close();toast('아침의 느낌을 저장했어요.');}else toast('저장되지 않았습니다. 기록을 내보내거나 다시 저장해 주세요.');};
function download(filename,content){const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export-data').onclick=()=>download(`jelly-flow-${localDate()}.json`,JSON.stringify(data,null,2));
$('#import-data').onclick=()=>{if(data.active){toast('진행 중인 루틴을 마친 뒤 기록을 가져와 주세요.');return;}$('#import-file').click();};
$('#import-file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>2*1024*1024)throw new Error('2MB 이하의 기록 파일을 선택해 주세요.');const next=validateData(JSON.parse(await file.text()));if(next.active)throw new Error('진행 중인 루틴이 포함된 파일입니다. 루틴 종료 후 내보낸 파일을 선택해 주세요.');if(await confirmAction('기록을 가져올까요?',`${next.sessions.length}개의 밤 기록으로 현재 기록과 설정을 교체합니다. 필요한 기록은 먼저 내보내 주세요.`)){stopAudio(false);data=next;data.playback.endsAtMs=null;saveBlocked=false;const ok=save();audio.volume=data.settings.volume;$('#volume').value=audio.volume;$('#volume-value').textContent=`${Math.round(audio.volume*100)}%`;$('#play-mode').value=data.settings.playMode;selectedTrack=tracks.find(t=>t.id===data.settings.lastTrackId)||tracks[0]||null;if(selectedTrack)loadTrack(selectedTrack);renderJournal();renderTracks();updateFavorite();toast(ok?'기록을 가져왔어요.':'기록을 불러왔지만 저장하지 못했어요.');}}catch(error){toast(error instanceof SyntaxError?'JSON 기록 파일을 읽을 수 없어요.':error.message);}};
$('#delete-all').onclick=async()=>{if(data.active){toast('진행 중인 루틴을 마친 뒤 기록을 삭제해 주세요.');return;}if(await confirmAction('모든 기록을 삭제할까요?','밤 기록과 아침 기록이 모두 삭제됩니다. 이 작업은 되돌릴 수 없어요.')){data.sessions=[];data.morningNotes=[];const ok=save();renderJournal();toast(ok?'모든 기록을 삭제했어요.':'삭제 내용을 저장하지 못했어요.');}};
$('#retry-save').onclick=async()=>{if(saveBlocked){if(rawBackup)download(`jelly-flow-original-${localDate()}.json`,rawBackup);if(!await confirmAction('현재 기록으로 저장할까요?','읽을 수 없는 이전 기록을 현재 화면의 기록으로 교체합니다. 읽을 수 있었던 원본 파일은 먼저 내려받습니다.'))return;saveBlocked=false;}if(save())toast('현재 기록을 저장했어요.');else toast('아직 저장할 수 없어요. 기록을 파일로 내보내 주세요.');};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')tick('recovered');else{data.playback.position=Number.isFinite(audio.currentTime)?audio.currentTime:0;save();}});
window.addEventListener('pagehide',()=>{data.playback.position=Number.isFinite(audio.currentTime)?audio.currentTime:0;save();});
if('mediaSession' in navigator){try{navigator.mediaSession.setActionHandler('play',playAudio);navigator.mediaSession.setActionHandler('pause',pauseAudio);navigator.mediaSession.setActionHandler('previoustrack',()=>changeTrack(-1));navigator.mediaSession.setActionHandler('nexttrack',()=>changeTrack(1));navigator.mediaSession.setActionHandler('stop',()=>stopAudio());}catch{}}
if(selectedTrack){const persisted={...data.playback};const activeTrack=data.active?.trackId;const track=tracks.find(t=>t.id===(activeTrack||persisted.trackId))||selectedTrack;loadTrack(track);data.playback.endsAtMs=persisted.endsAtMs;restorePosition=persisted.trackId===track.id?persisted.position:0;data.playback.position=restorePosition;if(data.active&&!activeTrack)data.active.trackId=null;}
else{$('#home-track').hidden=true;}
updateSelection();renderTracks();renderJournal();updatePlayerUI();tick('recovered');save();
setInterval(()=>tick(document.visibilityState==='visible'?'observed':'recovered'),500);
// Optional browser agent interface, using the same state as visible controls.
if(document.modelContext?.registerTool){const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});try{Promise.resolve(document.modelContext.registerTool({name:'preview_evening_routine',title:'저녁 루틴 미리보기',description:'상태와 시간을 선택하고 루틴 미리보기를 엽니다. 음악 재생이나 기록 저장은 시작하지 않습니다.',inputSchema:{type:'object',properties:{mood:{type:'string',enum:Object.keys(moods)},minutes:{type:'integer',enum:[5,10,15]}},required:['mood','minutes'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||Object.keys(input).some(k=>!['mood','minutes'].includes(k)))throw new Error('잘못된 입력입니다.');const plan=recommendRoutine(input);if(data.active)throw new Error('이미 루틴이 진행 중입니다.');mood=input.mood;minutes=input.minutes;goTab('tonight');updateSelection();renderRoutinePreview();return{routineId:plan.id,minutes,reason:plan.reason};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}}
