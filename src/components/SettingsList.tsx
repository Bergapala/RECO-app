import { Feather } from '@expo/vector-icons';
import { Children, cloneElement, isValidElement, useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

/**
 * Bloc réutilisable "liste groupée" pour les écrans sous src/app/settings/
 * (carte arrondie + titre optionnel + séparateurs entre lignes) — voir
 * SettingsRow ci-dessous pour le contenu de chaque ligne. Un seul fichier
 * pour les deux : ils ne s'utilisent jamais l'un sans l'autre, et
 * partagent les mêmes styles de séparateur/carte.
 */

type SettingsSectionProps = {
  /** Omis pour un groupe sans titre (ex. le mode sombre, seul en haut du
   * hub principal). */
  title?: string;
  children: ReactNode;
};

export function SettingsSection({ title, children }: SettingsSectionProps) {
  const theme = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          gap: theme.spacing.sm,
        },
        title: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontTitle}_700Bold`,
          fontSize: theme.fontSizes.sm,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          paddingHorizontal: theme.spacing.xs,
        },
        card: {
          backgroundColor: theme.colors.card,
          borderRadius: theme.borderRadius.md,
          overflow: 'hidden',
        },
      }),
    [theme],
  );

  // Injecte isLast sur le dernier &lt;SettingsRow&gt; enfant pour que l'appelant
  // n'ait jamais à le faire manuellement dans le cas courant — la prop
  // reste disponible sur SettingsRow pour les lignes composées hors
  // SettingsSection (ex. "Supprimer mon compte").
  const items = Children.toArray(children).filter(isValidElement);
  const lastIndex = items.length - 1;

  return (
    <View style={styles.wrapper}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.card}>
        {items.map((child, index) =>
          index === lastIndex
            ? cloneElement(child as ReactElement<{ isLast?: boolean }>, { isLast: true })
            : child,
        )}
      </View>
    </View>
  );
}

export type SettingsRowAccessory = 'chevron' | 'external' | 'switch' | 'none';

type SettingsRowProps = {
  label: string;
  onPress?: () => void;
  variant?: 'default' | 'destructive';
  /** Par défaut : 'chevron' si onPress est fourni, sinon 'none'. */
  accessory?: SettingsRowAccessory;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  disabled?: boolean;
  /** Remplace l'accessoire par un spinner (ex. suppression en cours). */
  loading?: boolean;
  /** Masque le séparateur du bas — SettingsSection le gère automatiquement
   * pour son dernier enfant direct ; utile aussi pour une ligne composée
   * hors SettingsSection (ex. "Supprimer mon compte", volontairement
   * isolée plutôt que dans une carte groupée). */
  isLast?: boolean;
};

export function SettingsRow({
  label,
  onPress,
  variant = 'default',
  accessory,
  switchValue,
  onSwitchChange,
  disabled,
  loading,
  isLast,
}: SettingsRowProps) {
  const theme = useTheme();

  const resolvedAccessory: SettingsRowAccessory = accessory ?? (onPress ? 'chevron' : 'none');
  const isDestructive = variant === 'destructive';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          minHeight: 52,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        },
        separator: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.border,
          marginLeft: theme.spacing.md,
        },
        disabled: {
          opacity: 0.5,
        },
        label: {
          flex: 1,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.md,
          color: isDestructive ? theme.colors.error : theme.colors.text,
        },
      }),
    [theme, isDestructive],
  );

  function renderAccessory() {
    if (loading) {
      return <ActivityIndicator size="small" color={theme.colors.muted} />;
    }
    switch (resolvedAccessory) {
      case 'chevron':
        return <Feather name="chevron-right" size={20} color={theme.colors.muted} />;
      case 'external':
        return <Feather name="external-link" size={18} color={theme.colors.muted} />;
      case 'switch':
        return (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            disabled={disabled}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            thumbColor="#FFFFFF"
          />
        );
      case 'none':
      default:
        return null;
    }
  }

  const content = (
    <View>
      <View style={[styles.row, disabled && styles.disabled]}>
        <Text style={styles.label}>{label}</Text>
        {renderAccessory()}
      </View>
      {!isLast && <View style={styles.separator} />}
    </View>
  );

  // Une ligne "switch" ne doit pas aussi réagir au tap sur toute sa
  // largeur (le Switch a déjà sa propre zone tactile) — seules les lignes
  // de navigation/action sont enveloppées dans un Pressable.
  if (!onPress || resolvedAccessory === 'switch') {
    return content;
  }

  return (
    <Pressable onPress={onPress} disabled={disabled}>
      {content}
    </Pressable>
  );
}
