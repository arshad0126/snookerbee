import { useSettings } from './useSettings';

export type Theme = 'dark' | 'light';

/**
 * Light/dark for screens that still offer a quick toggle. The source of
 * truth is the app settings (which also allow Auto); toggling here picks an
 * explicit mode.
 */
export function useTheme() {
  const { resolvedMode, update } = useSettings();

  const setTheme = (t: Theme) => update({ mode: t });
  const toggleTheme = () => update({ mode: resolvedMode === 'dark' ? 'light' : 'dark' });

  return { theme: resolvedMode as Theme, setTheme, toggleTheme };
}
