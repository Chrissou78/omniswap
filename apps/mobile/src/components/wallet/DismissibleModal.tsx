import React from 'react';
import {
  Modal,
  View,
  TouchableWithoutFeedback,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';

interface DismissibleModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  fullHeight?: boolean;
}

export const DismissibleModal: React.FC<DismissibleModalProps> = ({
  visible,
  onClose,
  children,
  fullHeight = false,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[styles.content, fullHeight && styles.fullHeight]}
            >
              <Pressable style={styles.dragIndicator} onPress={onClose}>
                <View style={styles.dragHandle} />
              </Pressable>
              {children}
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#12121a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 40,
  },
  fullHeight: {
    height: '95%',
  },
  dragIndicator: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#3a3a4e',
    borderRadius: 2,
  },
});
