import { Capacitor, registerPlugin, SystemBars, SystemBarsStyle } from '@capacitor/core';

interface NativeFile {
  url: string;
  name: string;
  type: string;
}

interface MonetaNative {
  shareFiles(options: { files: NativeFile[] }): Promise<void>;
  openMaily(options: { url: string }): Promise<void>;
  setSystemBarsColor(options: { color: string }): Promise<void>;
}

const native = registerPlugin<MonetaNative>('MonetaNative');

export function isAndroidShell(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function shareNativeFiles(files: NativeFile[]): Promise<void> {
  await native.shareFiles({ files });
}

export async function openMailyApp(url: string): Promise<void> {
  await native.openMaily({ url });
}

// Where the WebView can't draw under the system bars (WebView before 140, or a
// page without viewport-fit=cover such as the SSO login), Capacitor insets it
// and the strips around it show the native window. Paint them like the page.
// SystemBars resets that background on every style change, so the colour goes
// second.
export async function paintNativeSystemBars(dark: boolean, color: string): Promise<void> {
  // Capacitor names the bar background, so a dark style gives light icons.
  await SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
  await native.setSystemBarsColor({ color });
}
