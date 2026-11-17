/**
 * MeMo 💕 Reminder copy — everything Burmese, all warm, nothing robotic.
 *
 * Two pools, both used in place of the generic "N days" reminder copy:
 *
 *  1. Period care messages (the user's own words, verbatim) — during the
 *     period days, MeMo sends one of these a day instead of the technical
 *     "your period in X days" nag. The same message is scheduled on both
 *     paired devices, so he is prompted to care too.
 *  2. Anniversary congratulation lines (drafted by MeMo for this feature —
 *     edit freely) — when an anniversary comes into the reminder window,
 *     the alert is a congratulation, not a countdown report.
 */

/** The user's care messages, exactly as written. One is sent per period day. */
export const PERIOD_CARE_MESSAGES: string[] = [
  'ကိုယ် ကိုယ်တိုင် အနားမှာ ရှိမနေပေးနိုင်ပေမဲ့ ခလေးကို အမြဲ သတိရပြီး စိတ်ပူနေပါတယ်နော်။',
  'ဗိုက်နာနေလားဟင်၊ အရမ်းနာနေရင် ကိုယ့်ကို ပြောနော်၊ ကိုယ် ဖုန်းဆက်ပြီး အဖော်လုပ်ပေးမယ်။',
  'ဒီရက်ပိုင်း ခန္ဓာကိုယ်ရော စိတ်ခံစားချက်ပါ ပင်ပန်းလွယ်တာ သဘာဝမို့လို့ စိတ်မဖိစီးနဲ့နော်၊ ကိုယ် အကုန်နားလည်ပါတယ်။',
  'ရေနွေးကြမ်းလေး (သို့) နွေးနွေးထွေးထွေးလေး တစ်ခုခု သောက်နော်၊ အအေးစာတွေ လုံးဝမစားနဲ့ဦး။',
  'ဗိုက်ကို နွေးနွေးထွေးထွေး ထားပေးနော်၊ ရေနွေးအိတ်လေး ကပ်ထားလိုက်ပါလား။',
  'စိတ်တွေ ရှုပ်နေတာ၊ mood မကောင်းတာဖြစ်ရင် ကိုယ့်ကို ရင်ဖွင့်လို့ရပါတယ်၊ ကိုယ် အမြဲ နားထောင်ပေးဖို့ အသင့်ရှိတယ်။',
  'အလုပ်တွေ အကုန်ဘေးဖယ်ထားပြီး ဒီရက်ပိုင်း အိပ်ရေးဝဝအိပ်၊ များများအနားယူလိုက်နော် ခလေး။',
  'ဆေးသောက်ဖို့ မမေ့နဲ့နော်၊ ဗိုက်ထဲ အစာမရှိဘဲ ဆေးမသောက်နဲ့ဦး၊ အစာလည်း မှန်မှန်စားပါ။',
  'အပြင်ထွက်စရာရှိရင် ပူပူနွေးနွေးလေး ဝတ်သွားနော်၊ အအေးမိရင် ပိုဆိုးလိမ့်မယ်။',
  'အခုချိန် ကိုယ် အနားမှာရှိရင် ခလေးကို ဖက်ထားပြီး ဗိုက်လေးကို ပွတ်ပေးနေမိမှာပဲ။',
  'စကားမပြောချင်ဘဲ တိတ်တိတ်လေး နားချင်ရင်လည်း ရတယ်နော်၊ ဖုန်းလိုင်းလေး ဖွင့်ထားပြီး ကိုယ် အနားမှာ ရှိနေပေးမယ်။',
  'ခလေး ဘာစားချင်လဲဟင်၊ စားချင်တာရှိရင် ပြောနော်၊ ကိုယ် မှာပေးမယ် (Delivery ပို့ပေးမယ်)။',
  'ဒီရက်ပိုင်း ဘာမှ စိတ်ထဲ မထားနဲ့၊ ကိုယ့်ကို စိတ်ကောက်ချင်လည်း ကောက်လို့ရတယ်၊ ကိုယ် အကုန်ချော့မယ်။',
  'အရမ်းပင်ပန်းနေရင် ခဏလောက် မျက်လုံးမှိတ်ပြီး မှိန်းနေလိုက်နော်၊ ကိုယ် စောင့်ပေးနေမယ်။',
  'ရေချိုးရင် ရေနွေးလေးနဲ့ပဲ ချိုးနော်၊ ရေအေးနဲ့ မချိုးပါနဲ့။',
  'ခလေး နေမကောင်းဖြစ်နေချိန်မှာ ကိုယ် အဝေးရောက်နေရလို့ စိတ်မကောင်းဘူးကွာ၊ မြန်မြန်သက်သာပါစေနော်။',
  'ညဘက် အိပ်မပျော်ရင် ကိုယ့်ကို ဖုန်းခေါ်လိုက်နော်၊ အချိန်မရွေး ကိုယ် ရှိနေပေးမယ်။',
  'အချိုလေးတွေ စားချင်နေလား၊ ချောကလက်ပူပူလေး တစ်ခွက်လောက် သောက်လိုက်ရင် စိတ်သက်သာသွားလိမ့်မယ်။',
  'ကိုယ် ခလေးကို အရမ်းချစ်တယ်နော်၊ ဒီရက်ပိုင်းလေးကို ခဏပဲ သည်းခံလိုက်နော် ခလေးလေး။',
  'အခု ဘယ်လိုနေသေးလဲဟင်၊ မနက်ကထက်စာရင် နည်းနည်း သက်သာသွားပြီလား။',
];

/** Stable pick for the Nth period day of a run (same cycle → same message order). */
export const careMessageForDay = (runStart: string, dayIndex: number): string => {
  // Vary the starting offset per cycle so the cadence doesn't repeat verbatim
  let h = 0;
  for (let i = 0; i < runStart.length; i += 1) h = (h * 31 + runStart.charCodeAt(i)) | 0;
  const offset = Math.abs(h) % PERIOD_CARE_MESSAGES.length;
  return PERIOD_CARE_MESSAGES[(offset + dayIndex) % PERIOD_CARE_MESSAGES.length];
};

/** The title every care notification carries */
export const CARE_TITLE = 'MeMo 💕 ဂရုစိုက်ချက်';

/** Burmese digits for the countdown text (၀-၉) */
const mmDigit = (value: number | string): string =>
  String(value).replace(/[0-9]/g, d => '၀၁၂၃၄၅၆၇၈၉'[Number(d)]);

/** Anniversary congratulation line for the day itself */
export const anniversaryCongratsToday = (label: string): string =>
  `ဒီနေ့ ${label} — နှစ်ပတ်လည်နေ့ကို ပျော်ရွှင်စွာ ဆင်နွှဲပါစေ 💍💕`;

/** Anniversary congratulation line while the day is still approaching */
export const anniversaryCongratsSoon = (label: string, daysUntil: number): string =>
  daysUntil <= 1
    ? `မနက်ဖြန် ${label} — အထိမ်းအမှတ်နေ့ ရောက်တော့မယ် 💕`
    : `${label} — နောက်ထပ် ${mmDigit(daysUntil)} ရက်အတွင်း ရောက်တော့မယ် 💍💕`;
