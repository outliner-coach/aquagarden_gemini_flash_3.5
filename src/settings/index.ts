import { load, type Store } from '@tauri-apps/plugin-store';

// 설정 영속화 래퍼 스텁. tauri-plugin-store가 앱 config 디렉토리에 저장한다 (ADR-008: 쓰기 범위 한정).
// 불투명도·도킹·조명·플랜 한도 등 실제 키는 후속 step에서 추가한다.

const STORE_FILE = 'settings.json';

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  storePromise ??= load(STORE_FILE, { defaults: {}, autoSave: true });
  return storePromise;
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const value = await (await getStore()).get<T>(key);
  return value ?? undefined;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await (await getStore()).set(key, value);
}
