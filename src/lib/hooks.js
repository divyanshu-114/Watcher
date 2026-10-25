// React hooks over the app's external stores
import { useSyncExternalStore } from 'react';
import { subscribe, getState } from './store.js';
import { subscribeFocus, getFocusSnapshot } from './focus.js';
import { subscribeToasts, getToasts } from './toast.js';

export const useStore = () => useSyncExternalStore(subscribe, getState);
export const useFocus = () => useSyncExternalStore(subscribeFocus, getFocusSnapshot);
export const useToasts = () => useSyncExternalStore(subscribeToasts, getToasts);
