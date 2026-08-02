import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  Alert, ActivityIndicator, StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/TenantThemeProvider';
import { uploadToCloudinary } from '../../utils/uploadImage';

interface Props {
  label?: string;
  value: string | null;
  onChange: (url: string | null) => void;
}

export function ImagePickerButton({ label, value, onChange }: Props) {
  const theme = useTheme();
  const [uploading, setUploading] = useState(false);

  const pickFromSource = async (source: 'camera' | 'gallery') => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Camera access is required to take a photo.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Gallery access is required to pick a photo.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      }

      if (result.canceled || !result.assets?.[0]) return;

      setUploading(true);
      try {
        const url = await uploadToCloudinary(result.assets[0].uri);
        onChange(url);
      } catch {
        Alert.alert('Upload failed', 'Could not upload image. Please check your connection and try again.');
      } finally {
        setUploading(false);
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const showOptions = () => {
    Alert.alert('Upload Photo', 'Choose source', [
      { text: 'Camera', onPress: () => pickFromSource('camera') },
      { text: 'Gallery', onPress: () => pickFromSource('gallery') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 6 }]}>
          {label}
        </Text>
      ) : null}

      {value ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: value }} style={[styles.preview, { borderRadius: theme.borderRadius.md }]} resizeMode="cover" />
          <TouchableOpacity
            onPress={() => onChange(null)}
            style={[styles.removeBtn, { backgroundColor: theme.colors.error }]}
          >
            <Ionicons name="close" size={13} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={showOptions}
          disabled={uploading}
          activeOpacity={0.7}
          style={[
            styles.placeholder,
            {
              borderColor: theme.colors.border,
              borderRadius: theme.borderRadius.md,
              backgroundColor: theme.colors.inputBackground,
            },
          ]}
        >
          {uploading ? (
            <>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 6 }]}>
                Uploading...
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="camera-outline" size={28} color={theme.colors.textSecondary} />
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 6 }]}>
                Tap to add photo
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  placeholder: {
    height: 110,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewWrap: { position: 'relative', alignSelf: 'flex-start' },
  preview: { width: 130, height: 130 },
  removeBtn: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
