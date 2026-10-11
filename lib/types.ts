import type { CATEGORIES, ORG_TYPES } from './constants';

export type OrgType = (typeof ORG_TYPES)[number];
export type Category = (typeof CATEGORIES)[number];
export type Role = 'volunteer' | 'paid';
export type ParticipantStatus = 'registered' | 'attended' | 'negotiating' | 'agreed' | 'paid';

export type Activity = {
  id: string;
  owner_id: string;
  title: string;
  category: Category;
  org_name: string;
  org_type: OrgType;
  description: string;
  location_name: string;
  lat: number;
  lng: number;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM[:SS]
  end_time: string;
  max_participants: number | null;
  target_benih: number | null;
  collected_benih: number;
  participant_count: number;
  photos: string[];
};

export type Participant = {
  id: string;
  activity_id: string;
  user_id: string;
  role: Role;
  status: ParticipantStatus;
  agreed_benih: number | null;
  created_at: string;
  profile?: { full_name: string | null } | null;
};

export type JoinWithActivity = Participant & {
  activity: Pick<Activity, 'id' | 'title' | 'org_name' | 'date' | 'start_time' | 'end_time'> | null;
};

/** Profil publik member (tanpa saldo). locked: dikunci dan yang melihat bukan pemiliknya. */
export type Member = {
  id: string;
  full_name: string | null;
  created_at: string | null;
  locked: boolean;
  is_private: boolean;
  bio: string | null;
  city: string | null;
  attended: number;
};

export type ChatMessage = { id: string; sender_id: string; body: string; created_at: string; read_at?: string | null };

export type Conversation = {
  kind: 'direct' | 'activity';
  otherId: string;
  otherName: string;
  activityTitle: string | null;
  url: string;
  lastBody: string;
  lastAt: string;
  lastFromMe: boolean;
  unread: number;
};
