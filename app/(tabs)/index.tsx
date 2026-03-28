import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { flattenStyle } from "@/utils/flatten-style";

const STEPS = [
  {
    emoji: "💬",
    title: "Chat",
    desc: "Video chat 1-on-1 with strangers. Earn +1 minute per chat!",
  },
  {
    emoji: "🎁",
    title: "Earn",
    desc: "Every minute chatting earns you reward minutes to spend in the store.",
  },
  {
    emoji: "🛍️",
    title: "Shop",
    desc: "Redeem your minutes for real prizes: clothes, gift cards & more.",
  },
];

const COMPARISON = [
  { feature: "Earn rewards", c24: true, others: false },
  { feature: "Safe & moderated", c24: true, others: false },
  { feature: "1-on-1 video", c24: true, others: true },
  { feature: "Free to use", c24: true, others: true },
];

export default function HomeScreen() {
  const [warningDismissed, setWarningDismissed] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Text style={styles.logoC24}>C24</Text>
            <Text style={styles.logoClub}> CLUB</Text>
          </View>
          <Text style={styles.tagline}>The Omegle Alternative</Text>
        </View>

        {/* Age Warning Banner */}
        {!warningDismissed && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              🔞 18+ Only — By using C24 Club you confirm you are 18 years or older
            </Text>
            <TouchableOpacity
              onPress={() => setWarningDismissed(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <X size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stepsScroll}
          >
            {STEPS.map((step) => (
              <View key={step.title} style={styles.stepCard}>
                <Text style={styles.stepEmoji}>{step.emoji}</Text>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Why C24 Comparison */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why C24?</Text>
          <View style={styles.comparisonCard}>
            {/* Table Header */}
            <View style={styles.tableRow}>
              <Text style={flattenStyle([styles.tableCell, styles.tableFeatureHeader])}>
                Feature
              </Text>
              <Text style={flattenStyle([styles.tableCell, styles.tableHeaderRed])}>
                C24 Club
              </Text>
              <Text style={flattenStyle([styles.tableCell, styles.tableHeaderGray])}>
                Others
              </Text>
            </View>
            <View style={styles.divider} />
            {COMPARISON.map((row, i) => (
              <View
                key={row.feature}
                style={flattenStyle([
                  styles.tableRow,
                  i < COMPARISON.length - 1 && styles.tableRowBorder,
                ])}
              >
                <Text style={flattenStyle([styles.tableCell, styles.tableFeatureText])}>
                  {row.feature}
                </Text>
                <View style={flattenStyle([styles.tableCell, styles.tableCellCenter])}>
                  {row.c24 ? (
                    <Check size={18} color="#22C55E" />
                  ) : (
                    <X size={18} color="#EF4444" />
                  )}
                </View>
                <View style={flattenStyle([styles.tableCell, styles.tableCellCenter])}>
                  {row.others ? (
                    <Check size={18} color="#22C55E" />
                  ) : (
                    <X size={18} color="#EF4444" />
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* CTA Button */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity style={styles.ctaButton} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Start Chatting Now →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  scroll: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  logoC24: {
    fontSize: 52,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  logoClub: {
    fontSize: 52,
    fontWeight: "900",
    color: "#EF4444",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: "#A1A1AA",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  warningBanner: {
    backgroundColor: "#EF4444",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  warningText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginLeft: 20,
    marginBottom: 14,
  },
  stepsScroll: {
    paddingLeft: 20,
    paddingRight: 8,
    gap: 12,
  },
  stepCard: {
    backgroundColor: "#1E1E38",
    borderRadius: 24,
    padding: 20,
    width: 200,
  },
  stepEmoji: {
    fontSize: 32,
    marginBottom: 10,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 13,
    color: "#A1A1AA",
    lineHeight: 18,
  },
  comparisonCard: {
    backgroundColor: "#1E1E38",
    borderRadius: 20,
    marginHorizontal: 20,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A4A",
  },
  divider: {
    height: 1,
    backgroundColor: "#2A2A4A",
  },
  tableCell: {
    flex: 1,
  },
  tableCellCenter: {
    alignItems: "center",
  },
  tableFeatureHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#71717A",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableHeaderRed: {
    fontSize: 13,
    fontWeight: "800",
    color: "#EF4444",
    textAlign: "center",
  },
  tableHeaderGray: {
    fontSize: 13,
    fontWeight: "700",
    color: "#71717A",
    textAlign: "center",
  },
  tableFeatureText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  ctaContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  ctaButton: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: "center",
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  bottomPad: {
    height: 16,
  },
});