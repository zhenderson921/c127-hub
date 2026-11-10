import type { Church, Coach, Guest, Interest } from './types';

export type Track = 'church-has-fam' | 'church-no-fam' | 'no-church';

export interface Routed {
  track: Track;
  trackLabel: string;
  from: string;
  subject: string;
  body: string;
  steps: { day: number; label: string }[];
}

const WANTS: Record<Interest, string> = {
  'Bring a meal': 'bring a meal',
  'Join a Care Community': 'join a Care Community',
  'Start a FAM at my church': 'start a FAM at your church',
  'Foster or adopt': 'foster or adopt',
  Give: 'give',
  Pray: 'pray',
  'Bring a friend': 'bring a friend',
};

const NEXT_STEP: Record<Interest, string> = {
  'Bring a meal': 'sign up for one meal this month',
  'Join a Care Community': 'come to the next Care Community orientation',
  'Start a FAM at my church': 'grab coffee with us and bring one other person from your church',
  'Foster or adopt': 'join the next foster and adoption interest night',
  Give: 'become a monthly partner',
  Pray: 'join the weekly prayer email',
  'Bring a friend': 'pick a date to bring a friend through the Experience',
};

/**
 * The rule Betsey described: the email comes from a different person depending
 * on the guest's church, and says something different depending on whether that
 * church already has a Family Advocacy Ministry.
 */
export function routeGuest(guest: Guest, churches: Church[], coaches: Coach[]): Routed {
  const church = guest.churchId ? churches.find((c) => c.id === guest.churchId) : undefined;
  const coach = church ? coaches.find((c) => c.id === church.coachId) : undefined;
  const first = guest.name.split(' ')[0];
  const step = NEXT_STEP[guest.interests[0]];
  const wants = guest.interests.map((i) => WANTS[i]).join(' and ');
  const hasFam = church && (church.stage === 'Active FAM' || church.stage === 'Launching');

  if (church && hasFam) {
    return {
      track: 'church-has-fam',
      trackLabel: 'Their church has a FAM',
      from: `${coach?.name ?? 'Your C127 coach'}, C127 coach for ${church.name}`,
      subject: `${first}, ${church.name} already has a place for you`,
      body: `Hi ${first},\n\nThank you for walking through the Experience. You told us you want to ${wants}.\n\nGood news: ${church.name} already has a Family Advocacy Ministry, led by ${church.advocate}. The simplest next step is to ${step}. I have copied ${church.advocate.split(' ')[0]} so the two of you can connect this week.\n\n${coach?.name.split(' ')[0] ?? 'The C127 team'}`,
      steps: [
        { day: 0, label: 'Thank-you from the church coach' },
        { day: 3, label: `Introduce the FAM advocate (${church.advocate})` },
        { day: 10, label: 'Invite to a specific date' },
        { day: 21, label: 'Coach gets a task to call' },
      ],
    };
  }

  if (church) {
    return {
      track: 'church-no-fam',
      trackLabel: 'Their church has no FAM yet',
      from: `${coach?.name ?? 'Your C127 coach'}, C127 coach for ${church.town}`,
      subject: `${first}, would you help start something at ${church.name}?`,
      body: `Hi ${first},\n\nThank you for walking through the Experience. You told us you want to ${wants}.\n\n${church.name} does not have a Family Advocacy Ministry yet. Every FAM in our network started with one or two people like you asking the question. Would you be open to a 20 minute conversation about what that could look like?\n\nIn the meantime you can still ${step} through a nearby church.\n\n${coach?.name.split(' ')[0] ?? 'The C127 team'}`,
      steps: [
        { day: 0, label: 'Thank-you and the question: would you start a FAM?' },
        { day: 4, label: 'Send the Start a FAM overview' },
        { day: 12, label: 'Story from a church that launched' },
        { day: 21, label: 'Coach gets a task to call' },
      ],
    };
  }

  return {
    track: 'no-church',
    trackLabel: guest.churchName ? 'Church not in our network' : 'No church listed',
    from: 'Commission 127 team',
    subject: `${first}, here is your next step`,
    body: `Hi ${first},\n\nThank you for walking through the Experience. You told us you want to ${wants}.\n\nThe simplest next step is to ${step}. We will match you with the closest church that is already serving families near you.\n\nThe C127 team`,
    steps: [
      { day: 0, label: 'Thank-you with one clear next step' },
      { day: 5, label: 'Closest serving church near them' },
      { day: 14, label: 'Invite to a specific date' },
      { day: 28, label: 'Move to the newsletter list' },
    ],
  };
}
