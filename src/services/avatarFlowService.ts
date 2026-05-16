/**
 * Deterministic state machine for the Avatar Builder flow.
 *
 * The SKILL document is the source of truth for prompt copy. We encode it
 * verbatim here so generations are reproducible and LLM drift cannot leak
 * into the user-facing questions. The LLM is only used for:
 *   - vagueness checks (rubric per step, in avatarPromptsService)
 *   - coach mode replies (when user types `help`)
 *   - phase summaries + final avatar synthesis
 */

import { AvatarSession } from '@/repositories/avatarRepository';

export type AvatarInputType = 'text' | 'choice' | 'paste-loop' | 'confirm';

export interface AvatarChoice {
  id: string;
  label: string;
}

export interface AvatarStep {
  id: string;
  questionNumber: number | null; // 1..25, or null for transitions/summaries
  prompt: (ctx: AnswerContext) => string;
  inputType: AvatarInputType;
  choices?: AvatarChoice[];
  /** Whether the answer should be run through an LLM vagueness check. */
  vaguenessCheck?: boolean;
  /** Computes the next step id from the current answer + accumulated context. */
  next: (answer: string, ctx: AnswerContext) => string;
}

export type AnswerContext = Record<string, any> & {
  /** Convenience flag set by controller after 2.0 paste-loop completes. */
  hasClientData?: boolean;
};

const PROGRESS_HINT = (n: number) => `[Question ${n} of 25]`;

/**
 * Phase 1 — Backstory.
 */
const STEP_1_1: AvatarStep = {
  id: '1.1',
  questionNumber: 1,
  inputType: 'choice',
  choices: [
    { id: 'A', label: 'A — I went through the struggle myself' },
    { id: 'B', label: 'B — I learned this from the inside' },
  ],
  prompt: () => `**${PROGRESS_HINT(1)}**

Right — let's build an avatar that's going to keep every single one of your videos focused on the right person.

Before we get into who your VIEWER is, I need to understand YOUR story first. Because your backstory is the foundation that makes everything else work — it's what makes your content feel real instead of recycled.

Quick question — which of these sounds more like you?

**A) I went through the struggle myself.** I had the exact problem my audience has, I figured it out, and now I help others do the same.

**B) I learned this from the inside.** I worked in the industry, built expertise helping others, and discovered what most people get wrong — even if I didn't personally go through the struggle my clients face.

Type A or B.

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: (answer) => (answer.trim().toUpperCase() === 'A' ? '1.2A.1' : '1.2B.1'),
};

const STEP_1_2A_1: AvatarStep = {
  id: '1.2A.1',
  questionNumber: 2,
  inputType: 'text',
  vaguenessCheck: true,
  prompt: () => `**${PROGRESS_HINT(2)}**

Nice — the personal transformation story is gold for video. Let's dig into it.

But first — quick heads up before you tell me your story. This is important.

You probably have MORE than one story you could tell. Most people do. But **the story you lead with determines who you attract.**

If you used to be broke and you tell that story, you'll attract broke people. If you used to rely on referrals and cold outreach and tell THAT story, you'll attract people stuck on referrals and cold outreach. Same person, different story, completely different audience.

So when you tell me your backstory, think about it from your IDEAL client's perspective. Will they hear it and think 'that sounds like me'? Tell the version of your story that tracks to the experience of the person you actually want to attract.

OK — with that in mind:

What's the problem you solved in your own life or business? Not the service you sell — the actual struggle you went through. And make sure it's a struggle your ideal client would recognise in themselves.

Give me the raw version. What was happening?

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '1.2A.2',
};

const STEP_1_2A_2: AvatarStep = {
  id: '1.2A.2',
  questionNumber: 3,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(3)}**

Good. Now — what did you figure out? What was the turning point or discovery that changed things for you?

I don't need your whole methodology — just the moment or realization where things started to shift.

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '1.2A.3',
};

const STEP_1_2A_3: AvatarStep = {
  id: '1.2A.3',
  questionNumber: 4,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(4)}**

And what does life look like now on the other side of that transformation? What's different?

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '1.2A.4',
};

const STEP_1_2A_4: AvatarStep = {
  id: '1.2A.4',
  questionNumber: 5,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(5)}**

Last backstory question — have you helped OTHER people get this same kind of result? Clients, students, anyone?

If yes, give me a rough idea — how many people, and what kind of results did they get?

If not yet, that's totally fine — just say so and we'll work with what you've got.

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '2.0',
};

const STEP_1_2B_1: AvatarStep = {
  id: '1.2B.1',
  questionNumber: 2,
  inputType: 'text',
  vaguenessCheck: true,
  prompt: () => `**${PROGRESS_HINT(2)}**

Got it — the insider expertise story is just as powerful, it just works a bit differently. Let's map it out.

But first — quick heads up before you tell me your story. This is important.

You probably have MORE than one story you could tell. Most people do. But **the story you lead with determines who you attract.**

For example — if your story is about how you helped startups, you'll attract startups. If your story is about how you discovered what Fortune 500 companies get wrong, you'll attract people who aspire to that level. Same expertise, different framing, completely different audience.

So when you tell me your backstory, think about it from your IDEAL client's perspective. Will they hear it and think 'this person understands my world'? Tell the version of your story that tracks to the experience of the person you actually want to attract.

OK — with that in mind:

Where did you build your expertise? What environment were you in — agency, corporate, freelance, working with clients — and for how long?

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '1.2B.2',
};

const STEP_1_2B_2: AvatarStep = {
  id: '1.2B.2',
  questionNumber: 3,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(3)}**

What did you discover that most people in your space get wrong? What's the thing you kept seeing over and over — the mistake, the gap, the blind spot — that you now help people fix?

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '1.2B.3',
};

const STEP_1_2B_3: AvatarStep = {
  id: '1.2B.3',
  questionNumber: 4,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(4)}**

How many people have you helped with this, and what kind of results did they get?

Give me whatever you've got — client numbers, specific outcomes, transformations. Even rough numbers work.

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '1.2B.4',
};

const STEP_1_2B_4: AvatarStep = {
  id: '1.2B.4',
  questionNumber: 5,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(5)}**

Last one — why did you decide to go out on your own and build something around this? What was the moment or realization that made you think 'I need to teach this more broadly'?

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '2.0',
};

/**
 * Phase 2 — The Viewer.
 */
const STEP_2_0: AvatarStep = {
  id: '2.0',
  questionNumber: 6,
  inputType: 'paste-loop',
  prompt: () => `**${PROGRESS_HINT(6)}**

Now we're going to figure out who your viewer is — but before I start asking questions, I want to check something.

Do you have any real data from your IDEAL clients — the ones you want to attract MORE of? This could be:

→ **Onboarding forms** — what they filled in when they joined your program/service
→ **Sales call transcripts** — conversations where they told you their struggles and why they bought
→ **Survey responses** — anything where they described their situation in their own words

If you have this kind of data, paste it in now. **The more you add, the better** — one form gives me anecdotes, five or ten gives me patterns. You can paste multiple submissions; type \`done\` when finished or \`skip\` if you don't have any yet.

**Important:** Only share data from the TYPE of client you want MORE of.

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '2.1', // controller handles the paste-loop / done / skip explicitly
};

const STEP_2_1: AvatarStep = {
  id: '2.1',
  questionNumber: 7,
  inputType: 'text',
  vaguenessCheck: true,
  prompt: (ctx) => {
    const lead = ctx.hasClientData
      ? "Great — that data is going to make everything sharper. Now let me ask a few more questions to round out the picture.\n\n"
      : "Now let's flip it. Your backstory is solid — now we need to figure out who your VIEWER is. This is the person who's stuck where you used to be (or stuck where your clients were before you helped them).\n\n";
    return `**${PROGRESS_HINT(7)}**

${lead}We're building ONE specific person here — not a market, not a segment. One human.

Let's start simple. Tell me about them:

→ What's their age range?
→ Male, female, or mixed audience?
→ What do they do for work? (Job title, industry, business type)
→ Where are they in their career? (Early stage, mid-career, established?)

Just give me the basics for now — we'll go deeper in a sec.

(Type 'help' anytime if you're stuck and want to talk it through.)`;
  },
  next: () => '2.15',
};

const STEP_2_15: AvatarStep = {
  id: '2.15',
  questionNumber: 8,
  inputType: 'text',
  vaguenessCheck: true,
  prompt: (ctx) => {
    const ageHint = typeof ctx['2.1'] === 'string' ? ctx['2.1'] : 'your viewer';
    return `**${PROGRESS_HINT(8)}**

Quick one before we go deeper — based on what you just told me about ${ageHint.length > 80 ? 'your viewer' : 'them'}, the generation they're in shapes how they think about risk, trust, and where they get their information — and it's going to affect what kind of content lands and what bounces off.

I want you to think about three things:

**1. How do they consume information?** Are they text-first (LinkedIn posts, newsletters, long reads)? Video-first? Podcast? What format feels most natural and trustworthy to them — not what they produce, but what they actually consume and trust?

**2. How do they feel about spending money on solutions?** Are they loose with budget or cautious? Do they need to feel personally confident before pitching a spend upward? Have they been burned before in a way that makes them gun-shy?

**3. How do they decide who to trust?** Do they check credentials and case studies? Ask in communities first? Google you and stalk your LinkedIn? Need a referral from someone they know? What's the actual trust-building sequence for this person?

Don't overthink it — just tell me what you've seen. We'll shape it up.

(Type 'help' anytime if you're stuck and want to talk it through.)`;
  },
  next: () => '2.2',
};

const STEP_2_2: AvatarStep = {
  id: '2.2',
  questionNumber: 9,
  inputType: 'choice',
  choices: [
    { id: 'A', label: "A — Hasn't started yet" },
    { id: 'B', label: 'B — Started but stuck' },
    { id: 'C', label: 'C — Already doing it, wants to do it better' },
  ],
  prompt: () => `**${PROGRESS_HINT(9)}**

Good. Now this is important — where is your viewer in their journey with the problem you solve?

**A) Hasn't started yet** — They know the problem but haven't really tried to fix it. They need convincing that your approach is the right one.

**B) Started but stuck** — They've tried things, maybe spent money, but aren't getting results. They're frustrated and looking for a better way.

**C) Already doing it, wants to do it better** — They're getting some results but want to optimise, scale, or build systems around it.

Type A, B, or C.

This matters more than you think — it determines the kind of content you should be making and the language you should use. If you pick the wrong level, you'll either bore them or lose them.

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '2.3',
};

const STEP_2_3: AvatarStep = {
  id: '2.3',
  questionNumber: 10,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(10)}**

Now — what has your viewer already tried that hasn't worked?

This is huge because it tells us what they're skeptical of, what language to avoid, and what content angles will make them roll their eyes vs. actually pay attention.

What approaches, tools, courses, strategies, or solutions have they already thrown money or time at — and failed with?

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '2.35',
};

const STEP_2_35: AvatarStep = {
  id: '2.35',
  questionNumber: 11,
  inputType: 'text',
  vaguenessCheck: true,
  prompt: () => `**${PROGRESS_HINT(11)}**

Good — now I want to get even more specific.

We know what they've tried. But I want to know **when** the pain actually shows up — not the abstract problem, but the real scene.

What's the specific moment in their week where this becomes most acute? Not 'when they're stressed about leads' — the actual situation. What are they doing? Who are they with? What just happened right before the problem hits hardest?

Here's an example of what I mean: 'She's getting ready for a leadership meeting. She knows the CMO is going to ask about the content calendar. She has nothing new to show for the third week in a row. She's scrambling to pull clips from a webinar two months ago.'

That's a micro moment — a specific scene, not a vague pain point.

Give me that scene for YOUR viewer. And one more thing — does this moment happen when they're **alone** (a private, internal experience) or **in front of other people** (felt in meetings, group chats, social situations)?

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '2.36',
};

const STEP_2_36: AvatarStep = {
  id: '2.36',
  questionNumber: 12,
  inputType: 'text',
  vaguenessCheck: true,
  prompt: () => `**${PROGRESS_HINT(12)}**

Good — now zoom out from that one moment. I want to get a sense of what a **typical day** actually looks like for your viewer when it comes to this problem.

Not the crisis moment — the ongoing texture. What does the grind look like on a normal Tuesday?

For example: 'Her morning starts with Slack chaos — sales wants a quick video, product needs an explainer by Friday, and her VP just forwarded a competitor's LinkedIn post. Video keeps getting bumped on the content calendar because it's the hardest thing to produce. When footage does come in, editing takes forever — either she's doing it herself at 9pm or waiting weeks for an internal team that's backed up.'

What does that look like for YOUR viewer? Walk me through what their week actually feels like when this problem is running in the background.

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '2.4',
};

const STEP_2_4: AvatarStep = {
  id: '2.4',
  questionNumber: 13,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(13)}**

Last viewer backstory question — what does your viewer currently believe about their problem that might be WRONG or incomplete?

These are the limiting beliefs they carry around. The assumptions that are keeping them stuck.

For example: 'They think they need to post every day to grow' or 'They believe hiring an agency is the only way to get leads' or 'They think their market is too boring for video.'

What's YOUR viewer convinced of that you know isn't true?

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '3.1',
};

/**
 * Phase 3 — The Wake-Up Thought.
 */
const STEP_3_1: AvatarStep = {
  id: '3.1',
  questionNumber: 14,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(14)}**

OK — this is the most important part of the whole process. We're going to nail your viewer's Wake-Up Thought.

This is the ONE sentence running through their head at 6am. The problem that won't leave them alone. The reason they end up on YouTube or LinkedIn searching for answers — and the reason they'll click on YOUR video instead of someone else's.

A great Wake-Up Thought has three layers:
1. **Their current reality** — what's actually happening right now
2. **Their awareness** — what they know needs to change
3. **The blocker** — what's stopping them from fixing it

Here's an example of what a strong one looks like:

*'I keep losing deals to competitors who seem to be everywhere online. I know I need to build my personal brand, but every time I sit down to create content, I overthink it and nothing gets published.'*

See how that's not just 'I want more clients'? It captures a specific situation, a specific awareness, and a specific blocker.

Now — based on everything you've told me about your backstory and your viewer… what's YOUR viewer's Wake-Up Thought?

Give me your best shot — even if it's rough. We'll refine it together.

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '4.1',
};

/**
 * Phase 4 — Psychographic Layer.
 */
const STEP_4_1: AvatarStep = {
  id: '4.1',
  questionNumber: 15,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(15)}**

Now let's go a layer deeper. We know WHO your viewer is and WHAT keeps them up at night. Now I want to understand what DRIVES them.

What does your viewer value most? What matters to them beyond just solving the problem?

For example — is it freedom and flexibility? Security and stability? Status and recognition? Creative expression? Family time? Growth and learning?

Give me their top 2-3 values — the things that matter most to them when they think about their work and life.

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '4.2',
};

const STEP_4_2: AvatarStep = {
  id: '4.2',
  questionNumber: 16,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(16)}**

Good. Now — what does 'making it' actually look like for your viewer?

Not the generic version. THEIR version. What does success look like to THIS specific person when they picture the life they want?

For example — is it quitting their job? Hitting a revenue number? Having a full calendar of dream clients? Working 4 days a week? Being seen as the go-to expert? Having a team that runs without them?

What's their version of winning?

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '4.3',
};

const STEP_4_3: AvatarStep = {
  id: '4.3',
  questionNumber: 17,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(17)}**

This next one is just as important as knowing what they want — maybe more.

Who does your viewer NOT want to be? What kind of people, content, or behaviour makes them cringe or scroll past?

Think about:
→ What type of creators do they actively avoid?
→ What marketing tactics make them roll their eyes?
→ What 'version of success' do they reject?
→ What would they be embarrassed to be associated with?

This is their anti-identity — and it's going to shape what your content should NEVER look or sound like.

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '4.4',
};

const STEP_4_4: AvatarStep = {
  id: '4.4',
  questionNumber: 18,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(18)}**

Who does your viewer already follow and respect?

Give me 2-3 creators, thought leaders, or public figures that your viewer looks up to. These are people whose content they already consume and trust.

This tells us the vibe and style your viewer is drawn to — and it's useful for everything from your video style to your thumbnail approach.

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '4.45',
};

const STEP_4_45: AvatarStep = {
  id: '4.45',
  questionNumber: 19,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(19)}**

One more before we go into the emotional layer.

When your viewer is deciding whether to trust something — a claim, a brand, a solution — what kind of evidence actually works on them?

This isn't about what sounds logical. It's about what actually moves them from 'this seems interesting' to 'okay, I actually believe this.'

→ **Peer stories** — 'Someone exactly like me did this and it worked'
→ **Data and stats** — 'The numbers back this up'
→ **Authority endorsements** — 'An expert or institution I already trust says so'
→ **Case studies** — 'Show me the full before-and-after from a situation like mine'
→ **Their own experience first** — 'Let me try it before I commit to anything'

What's the proof format that actually shifts them?

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '4.5',
};

const STEP_4_5: AvatarStep = {
  id: '4.5',
  questionNumber: 20,
  inputType: 'text',
  vaguenessCheck: true,
  prompt: () => `**${PROGRESS_HINT(20)}**

Almost done — two more questions that are going to make your avatar dramatically sharper for scripting, hooks, and sales conversations.

First one: **what's the primary emotion your viewer carries into every interaction about this problem?**

I don't need a one-word answer. I need the *specific flavor*. For example:

→ **Anticipatory anxiety** — they know what needs to happen but keep having to justify it to others before they can act
→ **Compounding frustration** — they've been grinding at this a while, wins don't land the way losses do, and the cycle never ends
→ **Quiet embarrassment** — they feel like they should have cracked this by now and admitting they haven't feels like failure
→ **Urgency dread** — the window is closing, they can feel it, and they're scared of what happens if they miss it

What does your viewer's emotional state actually look like when they come to you?

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '4.5b',
};

const STEP_4_5B: AvatarStep = {
  id: '4.5b',
  questionNumber: 21,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(21)}**

Good. Two quick calibration questions — these are going to sharpen the tone we use in the final output.

First: is this emotion **chronic** — something they've been carrying for a long time, a slow grind that never fully goes away — or more **acute** — triggered recently by something specific that made it suddenly urgent?

Second: does this emotion show up when they're **alone** (a private, internal experience — felt at their desk, in their head) or **in front of other people** (felt in meetings, on calls, in group chats)?

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '4.5c',
};

const STEP_4_5C: AvatarStep = {
  id: '4.5c',
  questionNumber: 22,
  inputType: 'text',
  vaguenessCheck: true,
  prompt: () => `**${PROGRESS_HINT(22)}**

Last piece on this — I want to know what this emotion actually **looks and sounds like** when you're talking to them.

Think about a sales call, a DM, or even a comment they leave. How do they talk about this problem? What kind of language do they use? Are they guarded? Over-explaining? Minimising it?

And here's the important one: **when does the energy shift?** What's the moment in a conversation where they go from evaluating you to actually opening up? What did you say — or what did they hear — right before that happened?

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '4.6',
};

const STEP_4_6: AvatarStep = {
  id: '4.6',
  questionNumber: 23,
  inputType: 'text',
  prompt: () => `**${PROGRESS_HINT(23)}**

Last one — and this is gold for scripts, hooks, and sales content.

What's the moment when your viewer's skepticism drops? Think about a real call or conversation where you could feel the dynamic shift — where they went from guarded to 'okay, I think this could actually work.'

What happened right before that moment? What did you say, show, or ask?

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '4.7',
};

const STEP_4_7: AvatarStep = {
  id: '4.7',
  questionNumber: 24,
  inputType: 'text',
  vaguenessCheck: true,
  prompt: () => `**${PROGRESS_HINT(24)}**

One of the most underrated things in avatar building is capturing your viewer's EXACT language. Not what they mean — what they actually SAY.

When your viewer describes their problem — to a colleague, in a community, on a sales call — what phrases do they use? I'm talking verbatim. The kind of thing you'd hear in the first five minutes of a discovery call before they explain what they want.

For example: 'We keep starting and stopping.' Or: 'We tried hiring someone but it just plateaued.' Or: 'I can't get my exec to commit to camera time.'

Give me 6-10 exact phrases — the more verbatim the better.

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => '4.8',
};

const STEP_4_8: AvatarStep = {
  id: '4.8',
  questionNumber: 25,
  inputType: 'text',
  vaguenessCheck: true,
  prompt: () => `**${PROGRESS_HINT(25)}**

Last one — this is where avatar knowledge turns into content decisions.

What content makes your viewer actually stop, click, and engage? Not what you think they should want — what you've seen them actually respond to.

Think about:
→ What topics make them comment, share, or DM you?
→ What hooks make them click even when they're busy?
→ What did your best clients send you or reference BEFORE they became clients?
→ What do they screenshot and send to a colleague?

Give me 5-6 content angles or formats that you know land for her.

(Type 'help' anytime if you're stuck and want to talk it through.)`,
  next: () => 'complete',
};

export const STEPS: Record<string, AvatarStep> = {
  '1.1': STEP_1_1,
  '1.2A.1': STEP_1_2A_1,
  '1.2A.2': STEP_1_2A_2,
  '1.2A.3': STEP_1_2A_3,
  '1.2A.4': STEP_1_2A_4,
  '1.2B.1': STEP_1_2B_1,
  '1.2B.2': STEP_1_2B_2,
  '1.2B.3': STEP_1_2B_3,
  '1.2B.4': STEP_1_2B_4,
  '2.0': STEP_2_0,
  '2.1': STEP_2_1,
  '2.15': STEP_2_15,
  '2.2': STEP_2_2,
  '2.3': STEP_2_3,
  '2.35': STEP_2_35,
  '2.36': STEP_2_36,
  '2.4': STEP_2_4,
  '3.1': STEP_3_1,
  '4.1': STEP_4_1,
  '4.2': STEP_4_2,
  '4.3': STEP_4_3,
  '4.4': STEP_4_4,
  '4.45': STEP_4_45,
  '4.5': STEP_4_5,
  '4.5b': STEP_4_5B,
  '4.5c': STEP_4_5C,
  '4.6': STEP_4_6,
  '4.7': STEP_4_7,
  '4.8': STEP_4_8,
};

export const STARTING_STEP_ID = '1.1';

export const getStep = (id: string): AvatarStep | null => STEPS[id] || null;

export const buildAnswerContext = (session: AvatarSession): AnswerContext => ({
  ...session.answers,
  hasClientData: Array.isArray(session.client_data) && session.client_data.length > 0,
});

/** Helper for choice steps: validates the user's pick is one of the allowed ids. */
export const normalizeChoice = (step: AvatarStep, raw: string): string | null => {
  if (!step.choices) return null;
  const upper = raw.trim().toUpperCase();
  const match = step.choices.find((c) => c.id.toUpperCase() === upper);
  return match ? match.id : null;
};
