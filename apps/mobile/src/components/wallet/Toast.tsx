import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ToastConfig {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

interface ToastProps {
  config: ToastConfig;
  onHide: () => void;
}

export const Toast: React.FC<ToastProps> = ({ config, onHide }) => {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (config.visible) {
      Animated.sequence([
        Animated.spring(translateY, { toValue: 50, useNativeDriver: true, friction: 8 }),
        Animated.delay(2000),
        Animated.timing(translateY, { toValue: -100, duration: 300, useNativeDriver: true }),
      ]).start(() => onHide());
    }
  }, [config.visible]);

  if (!config.visible) return null;

  const bgColor = config.type === 'success' ? '#00D4AA' : config.type === 'error' ? '#FF4757' : '#3498db';
  const icon = config.type === 'success' ? 'checkmark-circle' : config.type === 'error' ? 'alert-circle' : 'information-circle';

  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColor, transform: [{ translateY }] }]}>
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={styles.text}>{config.message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
    gap: 10,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});
