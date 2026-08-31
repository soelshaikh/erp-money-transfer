import Toast from 'react-native-toast-message';

export const showToast = (
  type: 'success' | 'error' | 'info' | 'warning',
  title: string,
  message?: string,
) => {
  Toast.show({
    type,
    text1: title,
    text2: message,
    position: 'top',
    visibilityTime: (type === 'error' || type === 'warning') ? 4000 : 2500,
    topOffset: 100,
  });
};
