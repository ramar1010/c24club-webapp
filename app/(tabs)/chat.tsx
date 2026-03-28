/**
 * chat.tsx — C24 Club Video Chat Screen
 *
 * State machine: idle → searching → connected → ended
 * Matchmaking uses the real waiting_queue + rooms Supabase tables.
 * Minutes are credited via the atomic_increment_minutes RPC.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  CheckCircle,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Star,
  User,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import {
  earnMinutes,
  joinWaitingQueue,
  leaveWaitingQueue,
  findMatchInQueue,
  createRoom,
  endRoom,
} from '@/lib/chat-utils';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  bg: '#1A1A2E',
  bgDeep: '#0A0A1A',
  surface: '#1E1E38',
  red: '#EF4444',
  redDark: '#DC2626',
  green: '#22C55E',
  yellow: '#FACC15',
  white: '#FFFFFF',
  grayText: '#A1A1AA',
  divider: '#2A2A4A',
  inactive: '#71717A',
  controlBarBg: 'rgba(10, 10, 26, 0.85)',
  toastBg: 'rgba(34, 197, 94, 0.9)',
};

const MATCH_TIMEOUT_MS = 30_000; // 30 seconds before giving up
const POLL_INTERVAL_MS = 2_000;  // poll every 2 seconds

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ChatState = 'idle' | 'searching' | 'connected' | 'ended';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { user, profile, minutes, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();

  // ── State machine ─────────────────────────────────────────────────────────
  const [chatState, setChatState] = useState<ChatState>('idle');

  // ── Matchmaking ───────────────────────────────────────────────────────────
  // Channel ID assigned when we join the queue
  const myChannelRef = useRef<string | null>(null);
  // Active room ID for the current connected session
  const roomIdRef = useRef<string | null>(null);
  // Realtime subscription for being claimed by a match
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Timers ────────────────────────────────────────────────────────────────
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [searchSeconds, setSearchSeconds] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll interval for finding a match
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 30s hard timeout when no match found
  const matchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Camera ────────────────────────────────────────────────────────────────
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [isMuted, setIsMuted] = useState(false);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const minuteToastOpacity = useRef(new Animated.Value(0)).current;

  // ── Earned minutes for ended state ────────────────────────────────────────
  const [earnedMinutes, setEarnedMinutes] = useState(0);

  // ── Star rating ───────────────────────────────────────────────────────────
  const [rating, setRating] = useState(0);

  // ── Animations ───────────────────────────────────────────────────────────

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    pulseLoopRef.current = pulseLoop;
    pulseLoop.start();

    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spinLoopRef.current = spinLoop;
    spinLoop.start();

    return () => {
      pulseLoop.stop();
      spinLoop.stop();
    };
  }, []);

  // Request camera permission on mount
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
      unsubscribeRealtime();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  function clearAllTimers() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (matchTimeoutRef.current) {
      clearTimeout(matchTimeoutRef.current);
      matchTimeoutRef.current = null;
    }
  }

  function unsubscribeRealtime() {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
  }

  function showMinuteEarned() {
    Animated.sequence([
      Animated.timing(minuteToastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(minuteToastOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Matchmaking logic
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Called when a match is found (either by us or by the other party).
   * matchChannelId: the other person's channel id
   * matchMemberId: the other person's member_id
   */
  const handleMatchFound = useCallback(
    async (matchMemberId: string, matchChannelId: string) => {
      if (!user?.id || !myChannelRef.current) return;

      // Stop polling / timeout / search timer
      clearAllTimers();
      unsubscribeRealtime();

      // Create the room
      const { data: room, error: roomError } = await createRoom(
        user.id,
        myChannelRef.current,
        matchMemberId,
        matchChannelId,
      );

      if (roomError || !room) {
        console.error('[chat] createRoom error:', roomError);
        // Remove self from queue and go back to idle
        await leaveWaitingQueue(user.id);
        myChannelRef.current = null;
        setChatState('idle');
        Alert.alert('Matchmaking Error', 'Could not create a room. Please try again.');
        return;
      }

      roomIdRef.current = room.id as string;

      // Remove both members from the queue
      await leaveWaitingQueue(user.id);
      await leaveWaitingQueue(matchMemberId);

      handleConnected();
    },
    [user],
  );

  /**
   * Subscribe to Realtime so we can detect when our queue row is deleted
   * (meaning the other side picked us as a match).
   */
  const subscribeToBeingClaimed = useCallback(
    (memberId: string) => {
      unsubscribeRealtime();

      const channel = supabase
        .channel(`queue_watch_${memberId}`)
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'waiting_queue',
            filter: `member_id=eq.${memberId}`,
          },
          async () => {
            // Our row was deleted — someone else picked us.
            // Find the room that was just created for us.
            if (!user?.id) return;
            const { data: room } = await supabase
              .from('rooms')
              .select('*')
              .or(`member1.eq.${memberId},member2.eq.${memberId}`)
              .eq('status', 'connected')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (room) {
              roomIdRef.current = room.id as string;
              clearAllTimers();
              unsubscribeRealtime();
              handleConnected();
            }
          },
        )
        .subscribe();

      realtimeChannelRef.current = channel;
    },
    [user],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // State Transitions
  // ─────────────────────────────────────────────────────────────────────────

  /** idle → searching */
  const handleStartChat = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Sign In Required', 'Please sign in to start chatting.');
      return;
    }

    // Reset state
    elapsedRef.current = 0;
    setElapsedSeconds(0);
    setSearchSeconds(0);
    setRating(0);
    setIsMuted(false);
    roomIdRef.current = null;

    setChatState('searching');

    // Join the waiting queue
    const { data: queueEntry, error: queueError, channelId } = await joinWaitingQueue(
      user.id,
      profile?.gender ?? undefined,
    );

    if (queueError || !queueEntry) {
      console.error('[chat] joinWaitingQueue error:', queueError);
      setChatState('idle');
      Alert.alert('Error', 'Could not join matchmaking queue. Please try again.');
      return;
    }

    myChannelRef.current = channelId;

    // Start search elapsed counter
    searchTimerRef.current = setInterval(() => {
      setSearchSeconds((s) => s + 1);
    }, 1000);

    // Subscribe to Realtime in case the other side picks us first
    subscribeToBeingClaimed(user.id);

    // Poll every 2s to find someone already waiting
    pollRef.current = setInterval(async () => {
      const match = await findMatchInQueue(user.id);
      if (match) {
        await handleMatchFound(match.member_id as string, match.channel_id as string);
      }
    }, POLL_INTERVAL_MS);

    // 30s hard timeout
    matchTimeoutRef.current = setTimeout(async () => {
      clearAllTimers();
      unsubscribeRealtime();
      if (user?.id) await leaveWaitingQueue(user.id);
      myChannelRef.current = null;
      setChatState('idle');
      Alert.alert('No Matches', 'No matches right now, try again!');
    }, MATCH_TIMEOUT_MS);
  }, [user, profile, subscribeToBeingClaimed, handleMatchFound]);

  /** searching → connected */
  const handleConnected = useCallback(() => {
    clearAllTimers();
    unsubscribeRealtime();

    elapsedRef.current = 0;
    setElapsedSeconds(0);
    setChatState('connected');

    // Start call timer — earns +1 min every 60 seconds
    timerRef.current = setInterval(async () => {
      elapsedRef.current += 1;
      setElapsedSeconds(elapsedRef.current);

      if (elapsedRef.current > 0 && elapsedRef.current % 60 === 0) {
        showMinuteEarned();
        if (user?.id) {
          await earnMinutes(user.id, 1);
          refreshProfile();
        }
      }
    }, 1000);
  }, [user, refreshProfile]);

  /** Cancel while searching → idle */
  const handleCancel = useCallback(async () => {
    clearAllTimers();
    unsubscribeRealtime();
    if (user?.id) await leaveWaitingQueue(user.id);
    myChannelRef.current = null;
    setChatState('idle');
  }, [user]);

  /** End the current call → ended */
  const handleEndCall = useCallback(async () => {
    clearAllTimers();
    unsubscribeRealtime();

    const totalMinutesEarned = Math.floor(elapsedRef.current / 60);
    setEarnedMinutes(totalMinutesEarned);

    // End the room in DB
    if (roomIdRef.current) {
      await endRoom(roomIdRef.current);
      roomIdRef.current = null;
    }

    // Clean up queue entry (in case it was never removed)
    if (user?.id) await leaveWaitingQueue(user.id);
    myChannelRef.current = null;

    setChatState('ended');
    refreshProfile();
  }, [user, refreshProfile]);

  /** "Next →" button: end current call and go to ended */
  const handleNext = useCallback(async () => {
    await handleEndCall();
  }, [handleEndCall]);

  /** ended → idle */
  const handleGoHome = useCallback(() => {
    setChatState('idle');
    setRating(0);
  }, []);

  /** ended → searching */
  const handleChatAgain = useCallback(() => {
    setRating(0);
    handleStartChat();
  }, [handleStartChat]);

  // ─────────────────────────────────────────────────────────────────────────
  // Derived animation values
  // ─────────────────────────────────────────────────────────────────────────

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Render: IDLE
  // ─────────────────────────────────────────────────────────────────────────

  if (chatState === 'idle') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.idleContainer}>

          {/* Minutes badge (top-right) */}
          {minutes !== null && (
            <View style={styles.minutesBadge}>
              <Text style={styles.minutesBadgeText}>
                {minutes.total_minutes} mins
              </Text>
            </View>
          )}

          {/* Pulsing red circle */}
          <View style={styles.pulseWrapper}>
            <Animated.View
              style={[
                styles.glowRing,
                { opacity: glowOpacity, transform: [{ scale: pulseAnim }] },
              ]}
            />
            <Animated.View
              style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}
            />
          </View>

          {/* Copy */}
          <Text style={styles.idleTitle}>Ready to Chat?</Text>
          <Text style={styles.idleSubtitle}>
            Match with someone new and earn +1 min per chat minute!
          </Text>

          {/* CTA */}
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartChat}
            activeOpacity={0.85}
          >
            <Text style={styles.startButtonText}>Start Chatting</Text>
          </TouchableOpacity>

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>18+ only · Be respectful</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: SEARCHING
  // ─────────────────────────────────────────────────────────────────────────

  if (chatState === 'searching') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.searchingContainer}>

          {/* Spinning ring */}
          <View style={styles.spinnerWrapper}>
            <Animated.View
              style={[
                styles.spinnerRing,
                { transform: [{ rotate: spinInterpolate }] },
              ]}
            />
            <View style={styles.spinnerInner} />
          </View>

          {/* Copy */}
          <Text style={styles.searchingTitle}>Finding your match...</Text>
          <Text style={styles.searchingSubtitle}>Usually takes a few seconds</Text>

          {/* Elapsed counter */}
          <Text style={styles.searchingTimer}>{searchSeconds}s</Text>

          {/* Cancel button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: CONNECTED
  // ─────────────────────────────────────────────────────────────────────────

  if (chatState === 'connected') {
    const cameraPermissionGranted = permission?.granted ?? false;

    return (
      <View style={styles.connectedRoot}>

        {/* Remote video area (full screen) */}
        {/* TODO: replace with WebRTC remote stream when building native binary */}
        <View style={styles.remoteVideo}>
          <User color="#52525B" size={80} />
          <Text style={styles.strangerLabel}>Stranger</Text>
        </View>

        {/* Local camera (top-right corner) */}
        <View style={styles.localCameraContainer}>
          {cameraPermissionGranted ? (
            (() => {
              try {
                return (
                  <CameraView
                    style={styles.localCamera}
                    facing={cameraFacing}
                  />
                );
              } catch {
                return <View style={styles.cameraPlaceholder} />;
              }
            })()
          ) : (
            <View style={styles.cameraPlaceholder} />
          )}
        </View>

        {/* Timer overlay (top-left) */}
        <View style={[styles.timerOverlay, { top: insets.top + 16 }]}>
          <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
        </View>

        {/* +1 min toast */}
        <Animated.View
          style={[styles.minuteToast, { opacity: minuteToastOpacity }]}
          pointerEvents="none"
        >
          <Text style={styles.minuteToastText}>+1 min earned!</Text>
        </Animated.View>

        {/* Bottom control bar */}
        <View style={[styles.controlBar, { paddingBottom: insets.bottom + 16 }]}>

          {/* Mute toggle */}
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setIsMuted((m) => !m)}
            activeOpacity={0.75}
          >
            {isMuted ? (
              <MicOff color={COLORS.red} size={26} />
            ) : (
              <Mic color={COLORS.white} size={26} />
            )}
          </TouchableOpacity>

          {/* Camera flip */}
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setCameraFacing((f) => (f === 'front' ? 'back' : 'front'))}
            activeOpacity={0.75}
          >
            <RotateCcw color={COLORS.white} size={26} />
          </TouchableOpacity>

          {/* Next → (prominent, flex 1) */}
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextButtonText}>Next →</Text>
          </TouchableOpacity>

          {/* End call */}
          <TouchableOpacity
            style={styles.endCallBtn}
            onPress={handleEndCall}
            activeOpacity={0.85}
          >
            <PhoneOff color={COLORS.white} size={22} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: ENDED
  // ─────────────────────────────────────────────────────────────────────────

  if (chatState === 'ended') {
    const earnedLabel =
      earnedMinutes === 0
        ? 'Keep chatting to earn minutes!'
        : `You earned ${earnedMinutes} minute${earnedMinutes !== 1 ? 's' : ''}`;

    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.endedContainer}>

          {/* Check icon */}
          <CheckCircle color={COLORS.green} size={80} />

          {/* Copy */}
          <Text style={styles.endedTitle}>Chat Ended!</Text>
          <Text
            style={[
              styles.endedEarned,
              earnedMinutes === 0 && styles.endedEarnedZero,
            ]}
          >
            {earnedLabel}
          </Text>

          {/* Star rating */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                activeOpacity={0.75}
                style={styles.starBtn}
              >
                <Star
                  color={star <= rating ? COLORS.yellow : COLORS.inactive}
                  fill={star <= rating ? COLORS.yellow : 'transparent'}
                  size={36}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Actions */}
          <TouchableOpacity
            style={styles.chatAgainButton}
            onPress={handleChatAgain}
            activeOpacity={0.85}
          >
            <Text style={styles.chatAgainButtonText}>Chat Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.goHomeButton}
            onPress={handleGoHome}
            activeOpacity={0.85}
          >
            <Text style={styles.goHomeButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Fallback (should never reach)
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Shared ──────────────────────────────────────────────────────────────
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // ── IDLE ────────────────────────────────────────────────────────────────
  idleContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  minutesBadge: {
    position: 'absolute',
    top: 16,
    right: 20,
    backgroundColor: 'rgba(250, 204, 21, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.4)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  minutesBadgeText: {
    color: COLORS.yellow,
    fontSize: 13,
    fontWeight: '600',
  },
  pulseWrapper: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  glowRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  pulseCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.red,
    shadowColor: COLORS.red,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  idleTitle: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  idleSubtitle: {
    color: COLORS.grayText,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 44,
  },
  startButton: {
    width: '100%',
    backgroundColor: COLORS.red,
    borderRadius: 50,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  startButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  disclaimer: {
    color: COLORS.inactive,
    fontSize: 12,
    textAlign: 'center',
  },

  // ── SEARCHING ───────────────────────────────────────────────────────────
  searchingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  spinnerWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  spinnerRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: COLORS.red,
    borderRightColor: 'rgba(239, 68, 68, 0.4)',
  },
  spinnerInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.surface,
  },
  searchingTitle: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  searchingSubtitle: {
    color: COLORS.grayText,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  searchingTimer: {
    color: COLORS.yellow,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 48,
  },
  cancelButton: {
    borderWidth: 2,
    borderColor: COLORS.red,
    borderRadius: 50,
    paddingHorizontal: 48,
    paddingVertical: 14,
  },
  cancelButtonText: {
    color: COLORS.red,
    fontSize: 16,
    fontWeight: '600',
  },

  // ── CONNECTED ───────────────────────────────────────────────────────────
  connectedRoot: {
    flex: 1,
    backgroundColor: COLORS.bgDeep,
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strangerLabel: {
    color: COLORS.grayText,
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  localCameraContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 110,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  localCamera: {
    width: 110,
    height: 160,
  },
  cameraPlaceholder: {
    width: 110,
    height: 160,
    backgroundColor: '#18182E',
  },
  timerOverlay: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  timerText: {
    color: COLORS.yellow,
    fontSize: 15,
    fontWeight: '700',
  },
  minuteToast: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    backgroundColor: COLORS.toastBg,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  minuteToastText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  controlBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.controlBarBg,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    borderRadius: 26,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.red,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  nextButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  endCallBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── ENDED ────────────────────────────────────────────────────────────────
  endedContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  endedTitle: {
    color: COLORS.white,
    fontSize: 30,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  endedEarned: {
    color: COLORS.yellow,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 36,
  },
  endedEarnedZero: {
    color: COLORS.grayText,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 48,
  },
  starBtn: {
    padding: 4,
  },
  chatAgainButton: {
    width: '100%',
    backgroundColor: COLORS.red,
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: COLORS.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  chatAgainButtonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
  goHomeButton: {
    width: '100%',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
  },
  goHomeButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});