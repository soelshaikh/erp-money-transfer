# Mobile Coding Rules — ERP Money Transfer

> Read these rules BEFORE writing or editing any mobile code.
> These rules are the result of lessons learned across multiple sessions.

---

## 0. Expo SDK

**Always read the exact versioned docs before using any API:**
https://docs.expo.dev/versions/v56.0.0/

Never assume an API exists — Expo SDK 56 dropped or changed several APIs from SDK 54/55.
Do NOT add new npm packages without first checking Expo SDK 56 compatibility.

---

## 1. Safe Area — Non-Negotiable

React Navigation handles the **top** safe area (header) automatically.
You are responsible for the **bottom** — the home indicator / gesture bar on iPhone and Android edge-to-edge devices.

**For FlatList and ScrollView screens inside the tab navigator:**
```tsx
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

const tabBarHeight = useBottomTabBarHeight();
// then in FlatList:
contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
```

**Never write `paddingBottom: 100` or any hardcoded value.** The tab bar height varies per device and OS version.

**For modal/full-screen views that sit outside the tab bar**, use `useSafeAreaInsets().bottom` from `react-native-safe-area-context` (already installed via Expo).

---

## 2. KeyboardAvoidingView — Both Platforms Must Work

```tsx
// CORRECT
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
>

// WRONG — Android gets undefined = keyboard covers the form
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
>
```

Always pair with `keyboardShouldPersistTaps="handled"` on the inner ScrollView.

---

## 3. Responsive Typography

Typography is already scaled in `TenantThemeProvider.tsx`:
- Screens narrower than 375px get fonts at 90% size automatically
- **Do not hardcode font sizes.** Always use `theme.typography.*`

**For layout-critical numbers** (amounts, badges, token numbers) — these must NOT grow with the user's accessibility font size setting, or they will overflow their containers:
```tsx
<Text style={...} allowFontScaling={false}>₹{amount}</Text>
```

Apply `allowFontScaling={false}` to: currency amounts in cards, badge counts, token numbers, stat card values.

---

## 4. AppInput — forwardRef + Keyboard Navigation

`AppInput` (`shared/components/AppInput.tsx`) is a `forwardRef` component. In every form screen, wire up a keyboard focus chain so the user can advance fields with the keyboard's Next key without tapping each field.

```tsx
const usernameRef = useRef<TextInput>(null);
const passwordRef = useRef<TextInput>(null);

<AppInput
  label="Username"
  returnKeyType="next"
  onSubmitEditing={() => passwordRef.current?.focus()}
/>
<AppInput
  ref={passwordRef}
  label="Password"
  returnKeyType="done"
  onSubmitEditing={handleSubmit}
  secureTextEntry
/>
```

Supported new props on AppInput: `returnKeyType`, `onSubmitEditing`, `blurOnSubmit`, `autoCorrect`.

---

## 5. No `Alert.prompt` — It Is iOS Only

`Alert.prompt` silently does nothing on Android. It must never be used.

**Instead: show an inline input** that appears when the action requires user input (e.g., rejection reason):

```tsx
const [showReasonInput, setShowReasonInput] = useState(false);
const [reason, setReason] = useState('');

// When user taps "Reject":
// → setShowReasonInput(true)

// In JSX:
{showReasonInput && (
  <View>
    <AppInput label="Reason" value={reason} onChangeText={setReason} returnKeyType="done" />
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <AppButton title="Cancel" variant="outline" onPress={() => setShowReasonInput(false)} style={{ flex: 1 }} />
      <AppButton title="Confirm" variant="danger" onPress={() => reason.trim() && submitReject(reason)} style={{ flex: 1 }} />
    </View>
  </View>
)}
```

---

## 6. FlatList — Always Include Performance Props

Every FlatList must have these props to avoid jank on low-RAM old Android devices:

```tsx
<FlatList
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={5}
  initialNumToRender={10}
  keyboardShouldPersistTaps="handled"
  ...
/>
```

---

## 7. Color Opacity — Use `withAlpha()`, Never String Concat

```tsx
// WRONG — breaks if tenant uses a non-hex color format
backgroundColor: theme.colors.primary + '20'

// CORRECT
import { withAlpha } from '../../../utils/colors';
backgroundColor: withAlpha(theme.colors.primary, 0.12)
```

Common alpha values:
| Old suffix | Alpha decimal |
|---|---|
| `'10'` | 0.06 |
| `'12'` | 0.07 |
| `'15'` | 0.08 |
| `'20'` | 0.12 |
| `'30'` | 0.18 |
| `'40'` | 0.25 |
| `'60'` | 0.38 |
| `'80'` | 0.50 |

---

## 8. Notification / Count Badges — Use `BadgeCount` Component

```tsx
import { BadgeCount } from '../../../shared/components/BadgeCount';

// CORRECT — consistent size, allowFontScaling built in
<View>
  <Ionicons name="notifications-outline" size={24} color={theme.colors.primary} />
  <BadgeCount count={unreadCount} color={theme.colors.error} />
</View>

// WRONG — inline badge JSX duplicated everywhere with inconsistent sizes
<View style={{ position: 'absolute', top: -4, right: -8, width: 16 ... }}>
  <Text>{count}</Text>
</View>
```

---

## 9. Platform-Specific Font Families

```tsx
// WRONG — 'monospace' doesn't exist on iOS
fontFamily: 'monospace'

// CORRECT
import { Platform } from 'react-native';
fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' })
```

---

## 10. General Rules

- **Never hardcode spacing/radius values.** Use `theme.spacing.*` and `theme.borderRadius.*`.
- **Never hardcode colors.** Use `theme.colors.*` — even for white (`theme.colors.surface`).
- **`gap` is available** — React Native 0.76 (Expo SDK 56) supports it. Use freely.
- **`useTheme()` is the only way to access tokens** — no imports from `defaultTheme.ts` directly in screens.
- **Shared component first** — before writing inline card/badge/button JSX, check `shared/components/`.
- **`any` casts are acceptable** (TypeScript strict is off) but keep them at API boundaries, not in UI logic.
