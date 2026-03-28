import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Star } from "lucide-react-native";

export default function PromosScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <Star size={64} color="#FACC15" fill="#FACC15" />
        <Text style={styles.title}>Promotions</Text>
        <Text style={styles.subtitle}>
          Discover &amp; share promos from the community
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Coming Soon</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  container: {
    flex: 1,
    backgroundColor: "#1A1A2E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#A1A1AA",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 22,
  },
  badge: {
    backgroundColor: "#FACC15",
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  badgeText: {
    color: "#1A1A2E",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});