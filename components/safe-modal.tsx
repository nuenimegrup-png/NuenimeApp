import React, { useEffect } from "react";
import { Modal as RNModal, Platform, type ModalProps } from "react-native";

/**
 * Wrapper Modal yang menangani focus management di Web agar tidak muncul warning:
 * "Blocked aria-hidden on an element because its descendant retained focus."
 * Di iOS dan Android perilakunya 100% identik dengan Modal bawaan React Native.
 */
export function SafeModal({ visible, children, ...props }: ModalProps) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const active = document.activeElement;
    if (active && typeof (active as HTMLElement).blur === "function" && active !== document.body) {
      (active as HTMLElement).blur();
    }
  }, [visible]);

  return (
    <RNModal
      visible={visible}
      accessibilityViewIsModal={props.accessibilityViewIsModal ?? true}
      {...props}
    >
      {children}
    </RNModal>
  );
}

