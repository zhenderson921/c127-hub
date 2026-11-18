import type { Track } from './types';

// The words for each kind of follow-up. Staff copy these, change what they
// like, and send from their own email or phone. Nothing is sent by the hub.
// Keep them plain and warm, and short enough to read on a phone.

export interface DraftContext {
  first: string; // the guest's first name
  sender: string; // the first name of whoever is sending
  church: string; // the guest's church, '' when unknown
  churchHasFam: boolean;
}
export interface Draft {
  subject: string;
  email: string;
  text: string;
}

const hello = (c: DraftContext) => `Hi ${c.first || 'there'},`;
const thanks = 'Thank you for walking through the Vulnerable Child Experience with us.';
const sign = (c: DraftContext) => `${c.sender || 'The Commission 127 team'}\nCommission 127`;

export function draftFor(track: Track, c: DraftContext): Draft {
  const at = c.church ? ` at ${c.church}` : '';
  switch (track) {
    case 'Serve':
      return c.church && c.churchHasFam
        ? {
            subject: `${c.church} has a place for you`,
            email: `${hello(c)}\n\n${thanks} You said you might bring a meal or help a foster or adoptive family, and I am so glad.\n\nGood news: ${c.church} already has a Family Advocacy Ministry, with Care Communities wrapped around families right now. The simplest next step is to meet the people leading it. I would love to introduce you this week.\n\nWould a quick call or an email introduction work better for you?\n\n${sign(c)}`,
            text: `Hi ${c.first}, it's ${c.sender} from Commission 127. Thank you for coming through the Experience! ${c.church} already has a team caring for foster and adoptive families. Can I introduce you to them this week?`,
          }
        : {
            subject: 'Your next step after the Experience',
            email: `${hello(c)}\n\n${thanks} You said you might bring a meal or help a foster or adoptive family, and I am so glad.\n\n${c.church ? `${c.church} does not have a Family Advocacy Ministry yet, but that does not have to stop you.` : 'You do not need to be part of a particular church to help.'} There are families near you who would be blessed by a meal, and I can connect you with a Care Community that has room for one more.\n\nCould we find ten minutes to talk this week?\n\n${sign(c)}`,
            text: `Hi ${c.first}, it's ${c.sender} from Commission 127. Thank you for coming through the Experience! You mentioned helping a family with a meal. Could we talk for ten minutes this week about how?`,
          };
    case 'Start a FAM':
      return {
        subject: c.church ? `Starting a Family Advocacy Ministry at ${c.church}` : 'Starting a Family Advocacy Ministry at your church',
        email: `${hello(c)}\n\n${thanks} You said you would be interested in helping start or lead this ministry${at}, and that is exactly how every one of them began: with one person willing to go first.\n\n${c.churchHasFam && c.church ? `${c.church} already has a Family Advocacy Ministry, and they would love another leader. I can introduce you to the team.` : 'The first step is simple. Let us grab coffee, and bring one other person from your church if you can. I will walk you through what it looks like and what we do to help.'}\n\nWhat does your week look like?\n\n${sign(c)}`,
        text: `Hi ${c.first}, it's ${c.sender} from Commission 127. Thank you for coming through the Experience! I'd love to talk about starting a Family Advocacy Ministry${at}. Coffee this week?`,
      };
    case 'Give':
      return {
        subject: 'Thank you',
        email: `${hello(c)}\n\n${thanks} You said you would like to give, and I wanted to say thank you personally. Gifts are what let us stand with churches as they care for foster, adoptive and kinship families.\n\nYou can give at c127.org/donate whenever you are ready. If you would like to hear more about where it goes, I would be glad to tell you.\n\n${sign(c)}`,
        text: `Hi ${c.first}, it's ${c.sender} from Commission 127. Thank you for coming through the Experience, and for wanting to give. Here is the link whenever you are ready: c127.org/donate`,
      };
    case 'Foster':
      return {
        subject: 'Learning more about fostering',
        email: `${hello(c)}\n\n${thanks} You asked to learn more about fostering. That is a big and good question to be asking, and you do not have to work it out alone.\n\nThe next step is an information session, where you can hear what it involves and ask anything. I can send you the next dates, and I am happy to talk it through first if that would help.\n\n${sign(c)}`,
        text: `Hi ${c.first}, it's ${c.sender} from Commission 127. Thank you for coming through the Experience! You asked about fostering. Can I send you the next information session dates?`,
      };
    case 'Pray':
      return {
        subject: 'Praying with us',
        email: `${hello(c)}\n\n${thanks} You said you would love to pray, and we mean it when we say that matters.\n\nI have added you to our prayer email, so you will hear specific ways to pray for children, families and churches in Central Florida. If you would rather not receive it, just tell me.\n\n${sign(c)}`,
        text: `Hi ${c.first}, it's ${c.sender} from Commission 127. Thank you for coming through the Experience, and for praying with us. I've added you to our prayer email.`,
      };
    case 'Talk to someone':
      return {
        subject: 'Following up from the Experience',
        email: `${hello(c)}\n\n${thanks} You said you were not sure what your next step is and would like to talk with someone. I would love to be that person.\n\nIs there a good time for a short call this week?\n\n${sign(c)}`,
        text: `Hi ${c.first}, it's ${c.sender} from Commission 127. Thank you for coming through the Experience! You asked to talk with someone about what's next. When is a good time for a quick call?`,
      };
    case 'Already involved':
      return {
        subject: 'Thank you for coming',
        email: `${hello(c)}\n\n${thanks} You are already part of this work, and we are grateful for it.\n\nIf there is someone you would like to bring through the Experience, or anything we can do to support you, please tell me.\n\n${sign(c)}`,
        text: `Hi ${c.first}, it's ${c.sender} from Commission 127. Thank you for coming through the Experience, and for all you already do. Is there anyone you'd like to bring through?`,
      };
    default:
      return { subject: 'Thank you for coming', email: `${hello(c)}\n\n${thanks}\n\n${sign(c)}`, text: `Hi ${c.first}, thank you for coming through the Experience!` };
  }
}
