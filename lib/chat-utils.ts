import { supabase } from './supabase';

// Use the atomic RPC function to safely increment minutes
export async function earnMinutes(userId: string, minutesToAdd: number) {
  try {
    const { data, error } = await supabase.rpc('atomic_increment_minutes', {
      p_amount: minutesToAdd,
      p_user_id: userId,
    });
    if (error) console.error('[chat-utils] earnMinutes error:', error);
    return data; // returns new total
  } catch (err) {
    console.error('[chat-utils] earnMinutes error:', err);
  }
}

// Add to waiting queue for matchmaking
export async function joinWaitingQueue(
  memberId: string,
  gender?: string,
  genderPreference?: string,
) {
  const channelId = `ch_${memberId}_${Date.now()}`;
  const { data, error } = await supabase
    .from('waiting_queue')
    .insert({
      member_id: memberId,
      channel_id: channelId,
      member_gender: gender ?? null,
      gender_preference: genderPreference ?? 'Both',
      voice_mode: false,
    })
    .select()
    .single();
  return { data, error, channelId };
}

// Remove from waiting queue
export async function leaveWaitingQueue(memberId: string) {
  await supabase.from('waiting_queue').delete().eq('member_id', memberId);
}

// Find a match from waiting queue (someone else waiting)
export async function findMatchInQueue(memberId: string) {
  const { data } = await supabase
    .from('waiting_queue')
    .select('*')
    .neq('member_id', memberId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

// Create a room when matched
export async function createRoom(
  member1Id: string,
  member1Channel: string,
  member2Id: string,
  member2Channel: string,
) {
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      member1: member1Id,
      member2: member2Id,
      channel1: member1Channel,
      channel2: member2Channel,
      status: 'connected',
      connected_at: new Date().toISOString(),
    })
    .select()
    .single();
  return { data, error };
}

// End a room
export async function endRoom(roomId: string) {
  await supabase
    .from('rooms')
    .update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
    .eq('id', roomId);
}

// Insert a redemption record
export async function redeemReward(
  userId: string,
  reward: {
    id: string;
    title: string;
    minutes_cost: number;
    image_url?: string | null;
    rarity?: string;
    type?: string;
  },
) {
  const { data, error } = await supabase
    .from('member_redemptions')
    .insert({
      user_id: userId,
      reward_id: reward.id,
      reward_title: reward.title,
      minutes_cost: reward.minutes_cost,
      reward_image_url: reward.image_url ?? null,
      reward_rarity: reward.rarity ?? 'common',
      reward_type: reward.type ?? 'physical',
      status: 'pending',
    })
    .select()
    .single();
  return { data, error };
}