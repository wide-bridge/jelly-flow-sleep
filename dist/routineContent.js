export const moods = { 'busy-mind': '생각 많음', tense: '긴장', noise: '주변 소음', calm: '평온' };
const content = {
  breathe: { kind: 'settle', title: '자연스럽게 호흡하기', prompt: '편안한 자세를 찾아요.\n호흡은 자연스럽게 두세요.', skippable: true },
  thoughts: { kind: 'release', title: '생각 내려놓기', prompt: '떠오르는 생각을 붙잡지 않아도 돼요.\n지금 닿는 감각으로 돌아와요.', skippable: true },
  release: { kind: 'release', title: '몸의 힘 내려놓기', prompt: '얼굴부터 발끝까지,\n차례로 힘을 놓아 보세요.', skippable: true,
    prompts: ['눈가와 턱의 힘을\n부드럽게 놓아 보세요.', '어깨가 편안히 내려오도록\n그대로 두세요.', '팔과 손의 무게를\n침대에 맡겨 보세요.', '다리와 발끝까지\n힘을 천천히 놓아 보세요.'] },
  imagine: { kind: 'imagine', title: '편안한 장면 떠올리기', prompt: '잔잔한 물 위에 떠 있듯,\n몸이 편안해지는 장면을 떠올려요.', skippable: true },
  listen: { kind: 'listen', title: '소리에 머무르기', prompt: '이제 음악만 들어도 좋아요.\n화면은 내려놓아도 괜찮아요.', skippable: false },
  quiet: { kind: 'quiet', title: '고요하게 쉬기', prompt: '무언가를 하려 애쓰지 않아도 돼요.\n잠시, 이대로 쉬어 가요.', skippable: false }
};
const plans = {
  'busy-mind': { 5: [['breathe',1],['thoughts',2],['listen',2]], 10: [['breathe',2],['thoughts',3],['release',2],['listen',3]], 15: [['breathe',2],['thoughts',4],['release',3],['listen',6]] },
  tense: { 5: [['breathe',1],['release',3],['quiet',1]], 10: [['breathe',2],['release',4],['imagine',1],['listen',3]], 15: [['breathe',2],['release',6],['imagine',2],['listen',5]] },
  noise: { 5: [['listen',5]], 10: [['listen',10]], 15: [['listen',15]] },
  calm: { 5: [['quiet',5]], 10: [['quiet',10]], 15: [['quiet',15]] }
};
export function recommendRoutine({ mood, minutes, wakeTime = '' }) {
  if (!Object.hasOwn(moods,mood) || ![5,10,15].includes(minutes)) throw new Error('올바른 상태와 시간을 선택해 주세요.');
  if (wakeTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(wakeTime)) throw new Error('기상 시간을 확인해 주세요.');
  const reasons = { 'busy-mind': '생각이 많은 밤에는 호흡과 감각에 잠시 머물러요.', tense: '긴장한 몸이 편안해지도록 차례로 힘을 내려놓아요.', noise: '주변 소음에서 부드러운 선율로 주의를 옮겨 보세요.', calm: '평온한 마음 그대로, 조용한 쉼을 이어가요.' };
  return { id: `${mood}-${minutes}`, mood, minutes, reason: reasons[mood], steps: plans[mood][minutes].map(([key,min])=>({ key, ...content[key], durationSec:min*60 })) };
}
export function stepPrompt(step, elapsedSec) {
  if (!step.prompts) return step.prompt;
  return step.prompts[Math.min(step.prompts.length-1,Math.floor(Math.max(0,elapsedSec)/step.durationSec*step.prompts.length))];
}
