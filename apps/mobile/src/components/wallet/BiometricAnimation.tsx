import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BiometricAnimationProps {
  isAnimating: boolean;
}

export const BiometricAnimation: React.FC<BiometricAnimationProps> = ({ isAnimating }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isAnimating) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(glowAnim, { toValue: 0.8, duration: 1000, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(ringAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
            Animated.timing(ringAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0.3);
      ringAnim.setValue(0);
    }
  }, [isAnimating]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.outerRing,
          {
            opacity: ringAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 0.4, 0] }),
            transform: [{ scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
          },
        ]}
      />
      <Animated.View style={[styles.glowCircle, { opacity: glowAnim }]} />
      <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Ionicons name="finger-print" size={80} color="#00D4AA" />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: '#00D4AA',
  },
  glowCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#00D4AA',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#00D4AA',
  },
});
